import { useMemo } from 'react'
import type { PantryData } from '../types'
import { CATEGORIES } from '../types'
import {
  daysUntil,
  expiryLevel,
  fmtDate,
  fmtDays,
  householdNeed,
  n0,
  n1,
  perPackage,
  personNeed,
  reach,
  relDays,
  sortBatches,
  totals,
} from '../calc'
import { saveSettings } from '../store'

export function Overview({ data, onOpenProduct }: { data: PantryData; onOpenProduct: (id: string) => void }) {
  const s = data.settings
  const t = useMemo(() => totals(data, { includeExpired: s.countExpired }), [data, s.countExpired])
  const tExpired = useMemo(() => totals(data, { includeExpired: true }), [data])
  const r = reach(t, s)
  const need = householdNeed(s.people)
  const byId = new Map(data.products.map((p) => [p.id, p]))

  const warnings = sortBatches(data.batches).filter((b) => expiryLevel(b.expires, s) !== 'ok' && byId.has(b.productId))
  const expiredKcal = tExpired.kcal - totals(data, { includeExpired: false }).kcal

  // Energie nach Kategorie
  const cat = new Map<string, number>()
  for (const b of data.batches) {
    const p = byId.get(b.productId)
    if (!p) continue
    if (!s.countExpired && daysUntil(b.expires) < 0) continue
    cat.set(p.category, (cat.get(p.category) ?? 0) + perPackage(p).kcal * b.qty)
  }
  const catRows = CATEGORIES.filter((c) => (cat.get(c) ?? 0) > 0).map((c) => ({ c, kcal: cat.get(c)! }))
  const maxCat = Math.max(1, ...catRows.map((x) => x.kcal))

  if (!data.batches.length)
    return (
      <div className="empty">
        <h1>Noch kein Bestand</h1>
        <p className="muted">
          {data.products.length} Produkte sind im Katalog. Wechsle zu <b>Bestand</b> und trage bei jedem Produkt Anzahl und
          Ablaufdatum ein.
        </p>
      </div>
    )

  const people = s.people.map((p) => p.name).join(', ')

  return (
    <div className="overview">
      <section className="card hero">
        <h2>Reichweite für {s.people.length} Personen</h2>
        <div className="hero-num">{fmtDays(r.days)}</div>
        <p className="muted small">
          {people} · Bedarf {n0(need.kcal)} kcal und {n0(need.protein)} g Eiweiss pro Tag
        </p>
        {r.protein < r.kcal * 0.8 && r.days > 0 && (
          <p className="small warn-text">
            Eiweiss reicht nur {fmtDays(r.protein)} – für eine ausgewogene Versorgung mehr Hülsenfrüchte, Fisch- oder
            Fleischkonserven einlagern.
          </p>
        )}
        <div className="meters">
          <Meter label="Energie" days={r.kcal} value={`${n0(t.kcal)} kcal`} max={Math.max(r.kcal, r.protein, r.fat, r.water, 1)} />
          <Meter label="Eiweiss" days={r.protein} value={`${n0(t.protein)} g`} max={Math.max(r.kcal, r.protein, r.fat, r.water, 1)} />
          <Meter label="Fett" days={r.fat} value={`${n0(t.fat)} g`} max={Math.max(r.kcal, r.protein, r.fat, r.water, 1)} />
          <Meter
            label="Wasser"
            days={r.water}
            value={`${n1(t.waterL)} l`}
            max={Math.max(r.kcal, r.protein, r.fat, r.water, 1)}
            warn={r.water < Math.min(3, r.days)}
          />
        </div>
        {r.water < 3 && (
          <p className="small warn-text">
            Wasser reicht {t.waterL > 0 ? `nur ${fmtDays(r.water)}` : 'gar nicht – noch kein Wasser erfasst'}. Empfohlen
            sind mindestens 3 Tage ({n0(s.waterPerPersonL * s.people.length * 3)} l für den Haushalt).
          </p>
        )}
      </section>

      <div className="kpis">
        <div className="card kpi-card">
          <h2>Kalorien</h2>
          <div className="kpi">{n0(t.kcal)}</div>
          <div className="muted small">kcal gesamt</div>
        </div>
        <div className="card kpi-card">
          <h2>Packungen</h2>
          <div className="kpi">{n0(t.packages)}</div>
          <div className="muted small">{data.products.filter((p) => data.batches.some((b) => b.productId === p.id)).length} Produkte</div>
        </div>
        <div className="card kpi-card">
          <h2>Warnungen</h2>
          <div className={`kpi ${warnings.some((b) => daysUntil(b.expires) <= s.warnRedDays) ? 'red' : ''}`}>{warnings.length}</div>
          <div className="muted small">Chargen</div>
        </div>
      </div>

      <section className="card">
        <h2>Läuft bald ab</h2>
        {!warnings.length ? (
          <p className="muted small">Nichts läuft in den nächsten {s.warnYellowDays} Tagen ab.</p>
        ) : (
          <ul className="warn-list">
            {warnings.map((b) => {
              const p = byId.get(b.productId)!
              const lvl = expiryLevel(b.expires, s)
              return (
                <li key={b.id}>
                  <button className="row" onClick={() => onOpenProduct(p.id)}>
                    <span className={`dot-lvl ${lvl}`} />
                    <span className="row-name">
                      <b>{p.name}</b>
                      <span className="muted small">
                        {b.qty} × · MHD {fmtDate(b.expires)}
                      </span>
                    </span>
                    <span className={`tag exp-${lvl}`}>{relDays(daysUntil(b.expires))}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {expiredKcal > 0 && (
          <label className="check small">
            <input type="checkbox" checked={s.countExpired} onChange={(e) => saveSettings({ ...s, countExpired: e.target.checked })} />
            Abgelaufenes ({n0(expiredKcal)} kcal) in der Reichweite mitzählen
          </label>
        )}
      </section>

      <section className="card">
        <h2>Energie nach Kategorie</h2>
        {catRows.map(({ c, kcal }) => (
          <div className="bar-row" key={c}>
            <span className="bar-label">{c}</span>
            <span className="bar-track">
              <span className="bar" style={{ width: `${(kcal / maxCat) * 100}%` }} />
            </span>
            <span className="bar-val">{n1(kcal / need.kcal)} T</span>
          </div>
        ))}
        <p className="muted small">T = Tage für den ganzen Haushalt</p>
      </section>

      <section className="card">
        <h2>Tagesbedarf</h2>
        <table className="need">
          <thead>
            <tr>
              <th />
              <th>kcal</th>
              <th>Eiweiss</th>
              <th>Wasser</th>
            </tr>
          </thead>
          <tbody>
            {s.people.map((p) => {
              const n = personNeed(p)
              return (
                <tr key={p.id}>
                  <th>{p.name}</th>
                  <td>{n0(n.kcal)}</td>
                  <td>{n0(n.protein)} g</td>
                  <td>{n1(s.waterPerPersonL)} l</td>
                </tr>
              )
            })}
            <tr className="sum">
              <th>Haushalt</th>
              <td>{n0(need.kcal)}</td>
              <td>{n0(need.protein)} g</td>
              <td>{n1(s.waterPerPersonL * s.people.length)} l</td>
            </tr>
          </tbody>
        </table>
        <p className="muted small">Richtwerte D-A-CH/DGE nach Alter, Geschlecht und Aktivität – anpassbar unter Einstellungen.</p>
      </section>
    </div>
  )
}

function Meter({ label, days, value, max, warn }: { label: string; days: number; value: string; max: number; warn?: boolean }) {
  return (
    <div className={`meter ${warn ? 'warn' : ''}`}>
      <div className="meter-head">
        <span>{label}</span>
        <b>{fmtDays(days).replace(/ \(.*\)/, '')}</b>
      </div>
      <div className="meter-track">
        <span style={{ width: `${Math.min(100, (days / max) * 100)}%` }} />
      </div>
      <div className="muted small">{value}</div>
    </div>
  )
}
