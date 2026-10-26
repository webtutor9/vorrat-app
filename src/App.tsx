import { useEffect, useState } from 'react'
import { replaceData, syncNow, useStore } from './store'
import { seedData } from './seed'
import { daysUntil } from './calc'
import { Overview } from './views/Overview'
import { Stock } from './views/Stock'
import { Products } from './views/Products'
import { Settings, SyncSettings } from './views/Settings'

type Tab = 'overview' | 'stock' | 'products' | 'settings'
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Übersicht', icon: '◔' },
  { id: 'stock', label: 'Bestand', icon: '▤' },
  { id: 'products', label: 'Produkte', icon: '☰' },
  { id: 'settings', label: 'Einstellungen', icon: '⚙' },
]

export default function App() {
  const { data, sync } = useStore()
  const [tab, setTab] = useState<Tab>(() => (TABS.some((t) => `#${t.id}` === location.hash) ? (location.hash.slice(1) as Tab) : 'overview'))
  const [openId, setOpenId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  useEffect(() => {
    history.replaceState(null, '', `#${tab}`)
  }, [tab])
  useEffect(() => {
    syncNow()
  }, [])

  const alerts = data ? data.batches.filter((b) => daysUntil(b.expires) <= data.settings.warnRedDays).length : 0

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <span className="logo" aria-hidden>
            ▣
          </span>{' '}
          Vorrat
        </div>
        <nav className="tabs desktop">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
              {t.label}
              {t.id === 'overview' && alerts > 0 && <span className="badge">{alerts}</span>}
            </button>
          ))}
        </nav>
        <SyncDot sync={sync} onClick={() => syncNow()} />
      </header>
      <main className={`view view-${tab}`}>
        {!data ? (
          <Onboarding />
        ) : tab === 'overview' ? (
          <Overview
            data={data}
            onOpenProduct={(id) => {
              setOpenId(id)
              setTab('stock')
            }}
          />
        ) : tab === 'stock' ? (
          <Stock
            data={data}
            openId={openId}
            setOpenId={setOpenId}
            onEditProduct={(id) => {
              setEditId(id)
              setTab('products')
            }}
          />
        ) : tab === 'products' ? (
          <Products data={data} editId={editId} setEditId={setEditId} />
        ) : (
          <Settings data={data} />
        )}
      </main>
      {data && (
        <nav className="tabs mobile">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
              <span className="tab-icon" aria-hidden>
                {t.icon}
                {t.id === 'overview' && alerts > 0 && <span className="badge dot">{alerts}</span>}
              </span>
              {t.label}
            </button>
          ))}
        </nav>
      )}
    </div>
  )
}

function SyncDot({ sync, onClick }: { sync: ReturnType<typeof useStore>['sync']; onClick: () => void }) {
  const label =
    sync.state === 'off'
      ? 'Nur lokal gespeichert'
      : sync.state === 'idle'
        ? 'Synchronisiert'
        : sync.state === 'syncing'
          ? 'Synchronisiere …'
          : sync.state === 'pending'
            ? 'Änderungen warten auf Sync'
            : sync.message
  return (
    <button className={`sync-dot ${sync.state}`} onClick={onClick} title={label} aria-label={label}>
      <span />
      <span className="sync-label">{sync.state === 'error' ? 'Sync-Fehler' : sync.state === 'off' ? 'lokal' : ''}</span>
    </button>
  )
}

function Onboarding() {
  const { sync } = useStore()
  return (
    <div className="onboarding">
      <h1>Vorratshaltung</h1>
      <p className="muted">Verbinde dein privates Daten-Repo, damit Handy und Desktop denselben Bestand sehen. Der Startkatalog mit deinen Produkten wird beim ersten Verbinden angelegt.</p>
      {sync.state === 'syncing' && <p>Lade Daten …</p>}
      <SyncSettings />
      <section className="card">
        <h2>Ohne GitHub ausprobieren</h2>
        <button className="btn" onClick={() => replaceData(seedData())}>
          Nur auf diesem Gerät starten
        </button>
      </section>
    </div>
  )
}
