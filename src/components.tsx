import { useEffect, useState, type ReactNode } from 'react'
import { daysUntil, endOfMonth, expiryLevel, fmtDate, relDays } from './calc'
import type { Settings } from './types'

export function Sheet({ title, sub, onClose, children }: { title: string; sub?: ReactNode; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <div className="sheet-title">{title}</div>
            {sub && <div className="muted small">{sub}</div>}
          </div>
          <button className="icon-btn sm" onClick={onClose} aria-label="Schliessen">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function ExpiryTag({ iso, settings }: { iso: string; settings: Settings }) {
  const lvl = expiryLevel(iso, settings)
  const d = daysUntil(iso)
  return (
    <span className={`tag exp-${lvl}`} title={`Mindestens haltbar bis ${fmtDate(iso)}`}>
      {lvl === 'ok' ? fmtDate(iso) : relDays(d)}
    </span>
  )
}

/**
 * Zahlenfeld, das beim Tippen nicht auf einen Ersatzwert springt:
 * leer/ungültig wird erst beim Verlassen des Felds auf den letzten gültigen Wert zurückgesetzt.
 */
export function NumInput({ value, onChange, min = 0, max = Infinity, step, optional, ...rest }: {
  value: number | undefined
  onChange: (v: number | undefined) => void
  min?: number
  max?: number
  step?: number
  optional?: boolean
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'min' | 'max' | 'step'>) {
  const [text, setText] = useState(value === undefined ? '' : String(value))
  const [focus, setFocus] = useState(false)
  const shown = focus ? text : value === undefined ? '' : String(value)
  const parse = (t: string) => {
    const v = parseFloat(t.replace(',', '.'))
    return Number.isFinite(v) && v >= min && v <= max ? v : null
  }
  return (
    <input
      {...rest}
      type="text"
      inputMode={step && step < 1 ? 'decimal' : 'numeric'}
      value={shown}
      onFocus={() => {
        setText(value === undefined ? '' : String(value))
        setFocus(true)
      }}
      onChange={(e) => {
        setText(e.target.value)
        const v = parse(e.target.value)
        if (v !== null) onChange(v)
        else if (optional && e.target.value.trim() === '') onChange(undefined)
      }}
      onBlur={() => setFocus(false)}
    />
  )
}

export function Stepper({ value, onChange, min = 1 }: { value: number; onChange: (v: number) => void; min?: number }) {
  return (
    <div className="stepper">
      <button type="button" className="icon-btn" onClick={() => onChange(Math.max(min, value - 1))} aria-label="weniger">
        −
      </button>
      <NumInput value={value} min={min} onChange={(v) => v !== undefined && onChange(Math.round(v))} aria-label="Anzahl" />
      <button type="button" className="icon-btn" onClick={() => onChange(value + 1)} aria-label="mehr">
        +
      </button>
    </div>
  )
}

/** Datumseingabe für das MHD: exakter Tag oder „Ende Monat“ (wie auf vielen Packungen) */
export function ExpiryInput({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const [mode, setMode] = useState<'day' | 'month'>(() => {
    if (!value) return 'month'
    const [y, m] = value.split('-').map(Number)
    return endOfMonth(y, m) === value ? 'month' : 'day'
  })
  return (
    <div className="expiry-input">
      <div className="seg">
        <button type="button" className={mode === 'month' ? 'on' : ''} onClick={() => setMode('month')}>
          Ende Monat
        </button>
        <button type="button" className={mode === 'day' ? 'on' : ''} onClick={() => setMode('day')}>
          Tag
        </button>
      </div>
      {mode === 'day' ? (
        <input type="date" required value={value} min="2000-01-01" onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input
          type="month"
          required
          defaultValue={value.slice(0, 7)}
          placeholder="JJJJ-MM"
          onChange={(e) => {
            // Browser ohne Monatsauswahl liefern Freitext: "2027-06" oder "06.2027"
            const v = e.target.value.trim()
            const iso = /^(\d{4})-(\d{1,2})$/.exec(v)
            const ch = /^(\d{1,2})[./](\d{4})$/.exec(v)
            const [y, m] = iso ? [+iso[1], +iso[2]] : ch ? [+ch[2], +ch[1]] : [0, 0]
            if (y > 1999 && m >= 1 && m <= 12) onChange(endOfMonth(y, m))
          }}
        />
      )}
    </div>
  )
}
