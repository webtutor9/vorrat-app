import type { Batch, Nutrition, PantryData, Pal, Person, Product, Settings } from './types'

// ---------- Datum ----------
export const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function daysUntil(iso: string, from = todayISO()) {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10))
  const b = Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))
  return Math.round((b - a) / 86400000)
}

export const fmtDate = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`

export function endOfMonth(year: number, month: number) {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`
}

export function defaultExpiry() {
  const t = todayISO()
  return endOfMonth(+t.slice(0, 4) + 1, +t.slice(5, 7))
}

export type ExpiryLevel = 'expired' | 'red' | 'yellow' | 'ok'

export function expiryLevel(iso: string, s: Settings, from = todayISO()): ExpiryLevel {
  const d = daysUntil(iso, from)
  if (d < 0) return 'expired'
  if (d <= s.warnRedDays) return 'red'
  if (d <= s.warnYellowDays) return 'yellow'
  return 'ok'
}

export function relDays(d: number) {
  if (d < 0) return d === -1 ? 'seit gestern abgelaufen' : `seit ${-d} Tagen abgelaufen`
  if (d === 0) return 'läuft heute ab'
  if (d === 1) return 'läuft morgen ab'
  if (d < 60) return `noch ${d} Tage`
  const m = Math.round(d / 30.4)
  return m < 24 ? `noch ${m} Monate` : `noch ${(d / 365).toFixed(1).replace('.', ',')} Jahre`
}

// ---------- Bedarf (D-A-CH / DGE-Richtwerte, kcal/Tag nach PAL 1,4 / 1,6 / 1,8) ----------
type Band = { from: number; to: number; m: [number, number, number]; w: [number, number, number]; protein: [number, number] }
const BANDS: Band[] = [
  { from: 4, to: 7, m: [1300, 1500, 1700], w: [1200, 1400, 1600], protein: [18, 18] },
  { from: 7, to: 10, m: [1600, 1800, 2100], w: [1500, 1700, 1900], protein: [24, 24] },
  { from: 10, to: 13, m: [1900, 2200, 2400], w: [1700, 2000, 2200], protein: [34, 35] },
  { from: 13, to: 15, m: [2200, 2500, 2800], w: [1900, 2200, 2400], protein: [46, 45] },
  { from: 15, to: 19, m: [2500, 2800, 3200], w: [1900, 2200, 2500], protein: [60, 46] },
  { from: 19, to: 25, m: [2400, 2800, 3100], w: [1900, 2200, 2500], protein: [59, 48] },
  { from: 25, to: 51, m: [2300, 2600, 3000], w: [1800, 2100, 2400], protein: [57, 48] },
  { from: 51, to: 65, m: [2200, 2500, 2800], w: [1700, 2000, 2200], protein: [57, 48] },
  { from: 65, to: 200, m: [2100, 2400, 2700], w: [1700, 1900, 2100], protein: [67, 57] },
]
const PAL_IDX: Record<Pal, 0 | 1 | 2> = { 1.4: 0, 1.6: 1, 1.8: 2 }
export const PAL_LABEL: Record<Pal, string> = {
  1.4: 'wenig aktiv (1,4)',
  1.6: 'mässig aktiv (1,6)',
  1.8: 'aktiv / Sport (1,8)',
}

export interface Need {
  kcal: number
  protein: number
  fat: number
}

export function personNeed(p: Person): Need {
  const band = BANDS.find((b) => p.age >= b.from && p.age < b.to) ?? BANDS[6]
  const ref = band[p.sex][PAL_IDX[p.pal]]
  const kcal = p.kcalOverride && p.kcalOverride > 0 ? p.kcalOverride : ref
  return {
    kcal,
    protein: band.protein[p.sex === 'm' ? 0 : 1],
    // DGE: 30 % der Energie aus Fett (Kinder bis 35 %); Untergrenze für die Reichweite
    fat: (kcal * 0.3) / 9,
  }
}

export function householdNeed(people: Person[]): Need {
  return people.reduce<Need>(
    (a, p) => {
      const n = personNeed(p)
      return { kcal: a.kcal + n.kcal, protein: a.protein + n.protein, fat: a.fat + n.fat }
    },
    { kcal: 0, protein: 0, fat: 0 },
  )
}

// ---------- Mengen ----------
export const edible = (p: Product) => p.edibleAmount ?? p.netAmount

/** Nährwerte einer Packung */
export function perPackage(p: Product): Nutrition {
  const f = edible(p) / 100
  return {
    kcal: p.per100.kcal * f,
    protein: p.per100.protein * f,
    fat: p.per100.fat * f,
    carbs: p.per100.carbs * f,
  }
}

export interface Totals extends Nutrition {
  waterL: number
  packages: number
}

export function totals(data: PantryData, opts: { includeExpired: boolean; from?: string }): Totals {
  const byId = new Map(data.products.map((p) => [p.id, p]))
  const from = opts.from ?? todayISO()
  const t: Totals = { kcal: 0, protein: 0, fat: 0, carbs: 0, waterL: 0, packages: 0 }
  for (const b of data.batches) {
    const p = byId.get(b.productId)
    if (!p || b.qty <= 0) continue
    if (!opts.includeExpired && daysUntil(b.expires, from) < 0) continue
    const n = perPackage(p)
    t.kcal += n.kcal * b.qty
    t.protein += n.protein * b.qty
    t.fat += n.fat * b.qty
    t.carbs += n.carbs * b.qty
    t.waterL += (p.waterL ?? 0) * b.qty
    t.packages += b.qty
  }
  return t
}

export interface Reach {
  kcal: number
  protein: number
  fat: number
  water: number
  /** Reichweite = Kalorien; Eiweiss/Fett/Wasser werden separat ausgewiesen */
  days: number
}

export function reach(t: Totals, s: Settings): Reach {
  const need = householdNeed(s.people)
  const div = (a: number, b: number) => (b > 0 ? a / b : 0)
  const r = {
    kcal: div(t.kcal, need.kcal),
    protein: div(t.protein, need.protein),
    fat: div(t.fat, need.fat),
    water: div(t.waterL, s.waterPerPersonL * s.people.length),
  }
  return { ...r, days: r.kcal }
}

export function sortBatches(b: Batch[]) {
  return [...b].sort((x, y) => x.expires.localeCompare(y.expires))
}

// ---------- Formatierung ----------
const nf0 = new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 })
const nf1 = new Intl.NumberFormat('de-CH', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
export const n0 = (v: number) => nf0.format(v)
export const n1 = (v: number) => nf1.format(v)

export function fmtDays(d: number) {
  if (d <= 0) return '0 Tage'
  if (d < 1) return `${n1(d * 24)} h`.replace(',0', '')
  if (d < 14) return `${n1(d)} Tage`
  if (d < 60) return `${n0(d)} Tage`
  return `${n0(d)} Tage (≈ ${n1(d / 30.4)} Mt.)`
}

export const uid = () => Math.random().toString(36).slice(2, 10)

export function slug(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'produkt'
  ) + '-' + uid().slice(0, 4)
}
