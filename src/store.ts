import { useSyncExternalStore } from 'react'
import type { Batch, Op, PantryData, Product, Settings, SyncConfig } from './types'
import { loadRemote, saveRemote, ConflictError } from './github'
import { seedData } from './seed'
import { todayISO, uid } from './calc'

const K_DATA = 'vorrat.data'
const K_PENDING = 'vorrat.pending'
const K_SYNC = 'vorrat.sync'

export type SyncState =
  | { state: 'off' }
  | { state: 'idle'; at: string }
  | { state: 'syncing' }
  | { state: 'pending' }
  | { state: 'error'; message: string }

interface StoreState {
  data: PantryData | null
  pending: Op[]
  sync: SyncState
  config: SyncConfig | null
}

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}
function write(key: string, v: unknown) {
  try {
    if (v === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* Speicher voll oder blockiert – GitHub behält die Daten */
  }
}

let state: StoreState = {
  data: read<PantryData | null>(K_DATA, null),
  pending: read<Op[]>(K_PENDING, []),
  config: read<SyncConfig | null>(K_SYNC, null),
  sync: { state: 'off' },
}
state.sync = state.config ? (state.pending.length ? { state: 'pending' } : { state: 'idle', at: '' }) : { state: 'off' }

const listeners = new Set<() => void>()
function set(patch: Partial<StoreState>) {
  state = { ...state, ...patch }
  if ('data' in patch) write(K_DATA, state.data)
  if ('pending' in patch) write(K_PENDING, state.pending)
  if ('config' in patch) write(K_SYNC, state.config)
  listeners.forEach((l) => l())
}

export function useStore() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

/** Änderungen auf einen Datenstand anwenden (rein). Pro Produkt/Charge gewinnt die letzte Änderung. */
export function applyOps(data: PantryData, ops: Op[]): PantryData {
  const products = new Map(data.products.map((p) => [p.id, p]))
  const batches = new Map(data.batches.map((b) => [b.id, b]))
  let settings = data.settings
  for (const op of ops) {
    if (op.kind === 'product') products.set(op.product.id, op.product)
    else if (op.kind === 'product-del') {
      products.delete(op.id)
      for (const [id, b] of batches) if (b.productId === op.id) batches.delete(id)
    } else if (op.kind === 'batch') {
      if (op.batch.qty > 0) batches.set(op.batch.id, op.batch)
      else batches.delete(op.batch.id)
    } else if (op.kind === 'batch-del') batches.delete(op.id)
    else settings = op.settings
  }
  return {
    ...data,
    products: [...products.values()],
    batches: [...batches.values()].filter((b) => products.has(b.productId)),
    settings,
    updatedAt: new Date().toISOString(),
  }
}

function commit(op: Op) {
  if (!state.data) return
  set({
    data: applyOps(state.data, [op]),
    pending: state.config ? [...state.pending, op] : [],
    sync: state.config ? { state: 'pending' } : state.sync,
  })
  scheduleSync()
}

export const saveProduct = (product: Product) => commit({ kind: 'product', product })
export const deleteProduct = (id: string) => commit({ kind: 'product-del', id })
export const saveBatch = (batch: Batch) => commit({ kind: 'batch', batch })
export const deleteBatch = (id: string) => commit({ kind: 'batch-del', id })
export const saveSettings = (settings: Settings) => commit({ kind: 'settings', settings })

/** Neue Charge anlegen – gleiche Produkt/Datum-Kombination wird zusammengelegt */
export function addStock(productId: string, qty: number, expires: string) {
  const existing = state.data?.batches.find((b) => b.productId === productId && b.expires === expires)
  if (existing) saveBatch({ ...existing, qty: existing.qty + qty })
  else saveBatch({ id: uid(), productId, qty, expires, addedAt: todayISO() })
}

/** −1 Packung: zuerst die Charge, die am frühesten abläuft */
export function takeOne(productId: string) {
  const b = state.data?.batches
    .filter((x) => x.productId === productId && x.qty > 0)
    .sort((x, y) => x.expires.localeCompare(y.expires))[0]
  if (b) saveBatch({ ...b, qty: b.qty - 1 })
}

/** Alle Daten ersetzen (Backup-Import / erster Start) */
export function replaceData(data: PantryData) {
  set({
    data,
    pending: state.config ? allOps(data) : [],
  })
  scheduleSync(0)
}

function allOps(data: PantryData): Op[] {
  return [
    { kind: 'settings', settings: data.settings },
    ...data.products.map((product): Op => ({ kind: 'product', product })),
    ...data.batches.map((batch): Op => ({ kind: 'batch', batch })),
  ]
}

export function setConfig(config: SyncConfig | null) {
  set({ config, sync: config ? { state: 'pending' } : { state: 'off' }, pending: config ? state.pending : [] })
  if (config) syncNow()
}

let timer: number | undefined
function scheduleSync(delay = 1500) {
  if (!state.config) return
  clearTimeout(timer)
  timer = window.setTimeout(syncNow, delay)
}

let running = false
export async function syncNow(): Promise<void> {
  const cfg = state.config
  if (!cfg || running) return
  if (!navigator.onLine) {
    set({ sync: { state: 'error', message: 'Offline – wird später synchronisiert' } })
    return
  }
  running = true
  set({ sync: { state: 'syncing' } })
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const ops = state.pending
      const remote = await loadRemote(cfg)
      // Datei existiert noch nicht → mit lokalem Stand oder Startkatalog anlegen
      const base: PantryData = remote ? remote.data : (state.data ?? seedData())
      if (!ops.length && remote) {
        set({ data: remote.data, sync: { state: 'idle', at: new Date().toISOString() } })
        return
      }
      const merged = applyOps(base, ops)
      try {
        await saveRemote(cfg, merged, remote?.sha)
      } catch (e) {
        if (e instanceof ConflictError) continue
        throw e
      }
      const rest = state.pending.slice(ops.length)
      set({
        data: applyOps(merged, rest),
        pending: rest,
        sync: rest.length ? { state: 'pending' } : { state: 'idle', at: new Date().toISOString() },
      })
      if (rest.length) scheduleSync(300)
      return
    }
    throw new Error('Konflikt beim Speichern – bitte erneut versuchen')
  } catch (e) {
    set({ sync: { state: 'error', message: e instanceof Error ? e.message : String(e) } })
  } finally {
    running = false
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => syncNow())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncNow()
  })
}
