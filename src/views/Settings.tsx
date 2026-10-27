import { useState } from 'react'
import type { PantryData, Pal, Person, Settings as S, SyncConfig } from '../types'
import { replaceData, saveSettings, setConfig, syncNow, useStore } from '../store'
import { testConnection } from '../github'
import { NumInput } from '../components'
import { fmtDate, n0, PAL_LABEL, perPackage, personNeed, sortBatches, todayISO, uid } from '../calc'

export function Settings({ data }: { data: PantryData }) {
  return (
    <div className="settings">
      <PeopleSettings s={data.settings} />
      <WarnSettings s={data.settings} />
      <SyncSettings />
      <DataSettings data={data} />
    </div>
  )
}

function PeopleSettings({ s }: { s: S }) {
  const upd = (p: Person) => saveSettings({ ...s, people: s.people.map((x) => (x.id === p.id ? p : x)) })
  return (
    <section className="card">
      <h2>Haushalt</h2>
      <ul className="people">
        {s.people.map((p) => {
          const need = personNeed(p)
          return (
            <li key={p.id}>
              <div className="person-fields">
                <input aria-label="Name" value={p.name} onChange={(e) => upd({ ...p, name: e.target.value })} />
                <select aria-label="Geschlecht" value={p.sex} onChange={(e) => upd({ ...p, sex: e.target.value as Person['sex'] })}>
                  <option value="m">männlich</option>
                  <option value="w">weiblich</option>
                </select>
                <label className="inline">
                  <NumInput aria-label="Alter" min={1} max={110} value={p.age} onChange={(v) => v && upd({ ...p, age: Math.round(v) })} />
                  J.
                </label>
              </div>
              <div className="person-fields">
                <select aria-label="Aktivität" value={p.pal} onChange={(e) => upd({ ...p, pal: +e.target.value as Pal })}>
                  {([1.4, 1.6, 1.8] as Pal[]).map((v) => (
                    <option key={v} value={v}>
                      {PAL_LABEL[v]}
                    </option>
                  ))}
                </select>
                <label className="inline">
                  <NumInput
                    aria-label="eigener Kalorienbedarf"
                    placeholder="auto"
                    optional
                    min={500}
                    max={6000}
                    value={p.kcalOverride}
                    onChange={(v) => upd({ ...p, kcalOverride: v })}
                  />
                  kcal
                </label>
                <span className="muted small need-out">
                  = {n0(need.kcal)} kcal · {n0(need.protein)} g Eiweiss
                </span>
                {s.people.length > 1 && (
                  <button
                    className="icon-btn sm"
                    aria-label={`${p.name} entfernen`}
                    onClick={() => confirm(`${p.name} entfernen?`) && saveSettings({ ...s, people: s.people.filter((x) => x.id !== p.id) })}
                  >
                    ✕
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      <button
        className="btn"
        onClick={() => saveSettings({ ...s, people: [...s.people, { id: uid(), name: 'Person', sex: 'w', age: 30, pal: 1.6 }] })}
      >
        + Person
      </button>
      <p className="muted small">
        Richtwerte für die Energiezufuhr nach D-A-CH/DGE; Eiweiss nach DGE-Referenzwerten, Fett als 30 % der Energie. Ein
        eigener kcal-Wert überschreibt den Richtwert.
      </p>
    </section>
  )
}

function WarnSettings({ s }: { s: S }) {
  return (
    <section className="card">
      <h2>Warnungen &amp; Wasser</h2>
      <div className="form">
        <div className="three">
          <label>
            Gelb ab (Tage)
            <NumInput min={1} max={3650} value={s.warnYellowDays} onChange={(v) => v && saveSettings({ ...s, warnYellowDays: Math.round(v) })} />
          </label>
          <label>
            Rot ab (Tage)
            <NumInput min={0} max={3650} value={s.warnRedDays} onChange={(v) => v !== undefined && saveSettings({ ...s, warnRedDays: Math.round(v) })} />
          </label>
          <label>
            Wasser l/Person/Tag
            <NumInput min={0.5} max={20} step={0.5} value={s.waterPerPersonL} onChange={(v) => v && saveSettings({ ...s, waterPerPersonL: v })} />
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={s.countExpired} onChange={(e) => saveSettings({ ...s, countExpired: e.target.checked })} />
          Abgelaufene Chargen in der Reichweite mitzählen (MHD ist kein Verbrauchsdatum)
        </label>
      </div>
    </section>
  )
}

export function SyncSettings() {
  const { config, sync } = useStore()
  const [form, setForm] = useState<SyncConfig>(
    config ?? { owner: 'webtutor9', repo: 'habits-data', branch: 'main', path: 'vorrat.json', token: '' },
  )
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const f = (k: keyof SyncConfig) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value.trim() }),
  })

  const connect = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      const r = await testConnection(form)
      setConfig(form)
      setMsg(r.private ? 'Verbunden.' : 'Verbunden – Achtung: dieses Repo ist öffentlich!')
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card">
      <h2>Synchronisierung über GitHub</h2>
      {config ? (
        <>
          <p>
            Daten in <b>{config.owner}/{config.repo}</b> → <code>{config.path}</code>
          </p>
          <p className="muted small">
            Status:{' '}
            {sync.state === 'idle'
              ? 'synchron'
              : sync.state === 'syncing'
                ? 'synchronisiere …'
                : sync.state === 'pending'
                  ? 'Änderungen warten'
                  : sync.state === 'error'
                    ? sync.message
                    : 'aus'}
          </p>
          <div className="btn-row">
            <button className="btn" onClick={() => syncNow()}>
              Jetzt synchronisieren
            </button>
            <button
              className="btn danger"
              onClick={() => confirm('Verbindung auf diesem Gerät trennen? Die Daten in GitHub bleiben erhalten.') && setConfig(null)}
            >
              Trennen
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={connect} className="form">
          <p className="muted small">
            Die Daten liegen als <code>vorrat.json</code> in deinem privaten Daten-Repo. Wenn du dafür dein Repo{' '}
            <code>habits-data</code> nutzt, funktioniert dein bestehender Token der HabitsApp. Der Token bleibt nur auf diesem
            Gerät gespeichert.
          </p>
          <label>
            GitHub-Benutzer
            <input {...f('owner')} required autoCapitalize="off" autoCorrect="off" />
          </label>
          <label>
            Daten-Repo
            <input {...f('repo')} required autoCapitalize="off" autoCorrect="off" />
          </label>
          <div className="two">
            <label>
              Branch
              <input {...f('branch')} required autoCapitalize="off" />
            </label>
            <label>
              Datei
              <input {...f('path')} required autoCapitalize="off" />
            </label>
          </div>
          <label>
            Token
            <input {...f('token')} required type="password" autoComplete="off" />
          </label>
          <button className="btn primary" disabled={busy}>
            {busy ? 'Prüfe …' : 'Verbinden'}
          </button>
        </form>
      )}
      {msg && <p className="msg">{msg}</p>}
    </section>
  )
}

function download(name: string, text: string, type: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

function DataSettings({ data }: { data: PantryData }) {
  const exportCsv = () => {
    const byId = new Map(data.products.map((p) => [p.id, p]))
    const rows = [['Produkt', 'Marke', 'Kategorie', 'Anzahl', 'MHD', 'kcal gesamt']]
    for (const b of sortBatches(data.batches)) {
      const p = byId.get(b.productId)
      if (!p) continue
      rows.push([p.name, p.brand ?? '', p.category, String(b.qty), fmtDate(b.expires), String(Math.round(perPackage(p).kcal * b.qty))])
    }
    download(`vorrat-${todayISO()}.csv`, '﻿' + rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(';')).join('\n'), 'text/csv')
  }
  const importFile = async (file: File) => {
    try {
      const d = JSON.parse(await file.text()) as PantryData
      if (!Array.isArray(d.products) || !Array.isArray(d.batches)) throw new Error('Unbekanntes Format')
      if (confirm('Alle Daten durch das Backup ersetzen?')) replaceData({ ...d, version: 1 })
    } catch (e) {
      alert('Import fehlgeschlagen: ' + (e instanceof Error ? e.message : e))
    }
  }
  return (
    <section className="card">
      <h2>Daten</h2>
      <div className="btn-row">
        <button className="btn" onClick={exportCsv}>
          Bestand als CSV
        </button>
        <button className="btn" onClick={() => download(`vorrat-backup-${todayISO()}.json`, JSON.stringify(data, null, 1), 'application/json')}>
          JSON-Backup
        </button>
        <label className="btn">
          Backup laden
          <input type="file" accept=".json,application/json" hidden onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
        </label>
      </div>
    </section>
  )
}
