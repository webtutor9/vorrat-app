import { useState } from 'react'
import type { Batch, PantryData, Product } from '../types'
import { CATEGORIES } from '../types'
import { defaultExpiry, edible, expiryLevel, fmtDate, n0, perPackage, sortBatches } from '../calc'
import { addStock, deleteBatch, saveBatch, takeOne } from '../store'
import { ExpiryInput, ExpiryTag, Sheet, Stepper } from '../components'

export function Stock({ data, openId, setOpenId, onEditProduct }: {
  data: PantryData
  openId: string | null
  setOpenId: (id: string | null) => void
  onEditProduct: (id: string) => void
}) {
  const [q, setQ] = useState('')
  const [onlyStock, setOnlyStock] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const s = data.settings

  const stockOf = (id: string) => data.batches.filter((b) => b.productId === id && b.qty > 0)
  const products = data.products
    .filter((p) => !q || `${p.name} ${p.brand ?? ''}`.toLowerCase().includes(q.toLowerCase()))
    .filter((p) => !onlyStock || stockOf(p.id).length)
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))

  const open = openId ? data.products.find((p) => p.id === openId) : null
  const addP = adding ? data.products.find((p) => p.id === adding) : null

  return (
    <div className="stock">
      <div className="toolbar">
        <input type="search" placeholder="Suchen …" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="seg">
          <button className={!onlyStock ? 'on' : ''} onClick={() => setOnlyStock(false)}>
            Alle
          </button>
          <button className={onlyStock ? 'on' : ''} onClick={() => setOnlyStock(true)}>
            Vorhanden
          </button>
        </div>
      </div>

      {CATEGORIES.map((c) => {
        const list = products.filter((p) => p.category === c)
        if (!list.length) return null
        return (
          <section className="card" key={c}>
            <h2>{c}</h2>
            {list.map((p) => {
              const batches = sortBatches(stockOf(p.id))
              const qty = batches.reduce((a, b) => a + b.qty, 0)
              return (
                <div className={`row stock-row ${qty ? '' : 'empty-row'}`} key={p.id}>
                  <button className="row-main" onClick={() => setOpenId(p.id)}>
                    <span className="qty-badge">{qty}</span>
                    <span className="row-name">
                      <span>
                        <b>{p.name}</b>
                        {p.brand && <span className="muted"> · {p.brand}</span>}
                      </span>
                      <span className="sub">
                        {batches[0] && <ExpiryTag iso={batches[0].expires} settings={s} />}
                        {batches.length > 1 && <span className="muted small">{batches.length} Chargen</span>}
                        {qty > 0 && <span className="muted small">{n0(perPackage(p).kcal * qty)} kcal</span>}
                      </span>
                    </span>
                  </button>
                  <button className="icon-btn" disabled={!qty} onClick={() => takeOne(p.id)} aria-label={`${p.name}: eine Packung entnehmen`}>
                    −
                  </button>
                  <button className="icon-btn plus" onClick={() => setAdding(p.id)} aria-label={`${p.name}: hinzufügen`}>
                    +
                  </button>
                </div>
              )
            })}
          </section>
        )
      })}
      {!products.length && <p className="muted hint">Keine Produkte gefunden.</p>}
      <p className="muted small hint">„−“ entnimmt eine Packung aus der Charge, die zuerst abläuft.</p>

      {open && (
        <ProductSheet
          product={open}
          batches={sortBatches(stockOf(open.id))}
          data={data}
          onClose={() => setOpenId(null)}
          onAdd={() => setAdding(open.id)}
          onEdit={() => {
            setOpenId(null)
            onEditProduct(open.id)
          }}
        />
      )}
      {addP && <AddStockSheet product={addP} onClose={() => setAdding(null)} />}
    </div>
  )
}

function AddStockSheet({ product, onClose }: { product: Product; onClose: () => void }) {
  const [qty, setQty] = useState(1)
  const [expires, setExpires] = useState(defaultExpiry())
  return (
    <Sheet title={`${product.name} hinzufügen`} sub={product.brand} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          addStock(product.id, qty, expires)
          onClose()
        }}
      >
        <label>
          Anzahl Packungen
          <Stepper value={qty} onChange={setQty} />
        </label>
        <label>
          Mindestens haltbar bis
          <ExpiryInput value={expires} onChange={setExpires} />
        </label>
        <button className="btn primary">Hinzufügen</button>
      </form>
    </Sheet>
  )
}

function ProductSheet({ product, batches, data, onClose, onAdd, onEdit }: {
  product: Product
  batches: Batch[]
  data: PantryData
  onClose: () => void
  onAdd: () => void
  onEdit: () => void
}) {
  const pk = perPackage(product)
  const u = product.unit
  return (
    <Sheet
      title={product.name}
      sub={[product.brand, `${n0(product.netAmount)} ${u}`, product.edibleAmount && product.edibleAmount !== product.netAmount ? `abgetropft ${n0(product.edibleAmount)} ${u}` : null]
        .filter(Boolean)
        .join(' · ')}
      onClose={onClose}
    >
      <div className="nutri">
        <span>
          <b>{n0(pk.kcal)}</b> kcal
        </span>
        <span>
          <b>{n0(pk.protein)}</b> g Eiweiss
        </span>
        <span>
          <b>{n0(pk.fat)}</b> g Fett
        </span>
        <span className="muted small">pro Packung ({n0(edible(product))} {u})</span>
      </div>
      {product.estimated && <p className="small warn-text">Nährwerte geschätzt – Etikett war nicht lesbar.</p>}

      <h2 style={{ marginTop: 14 }}>Chargen</h2>
      {!batches.length && <p className="muted small">Kein Bestand.</p>}
      <ul className="batch-list">
        {batches.map((b) => (
          <BatchRow key={b.id} batch={b} data={data} />
        ))}
      </ul>
      <div className="btn-row">
        <button className="btn primary" onClick={onAdd}>
          + Charge hinzufügen
        </button>
        <button className="btn" onClick={onEdit}>
          Produkt bearbeiten
        </button>
      </div>
    </Sheet>
  )
}

function BatchRow({ batch, data }: { batch: Batch; data: PantryData }) {
  const [edit, setEdit] = useState(false)
  const [expires, setExpires] = useState(batch.expires)
  const lvl = expiryLevel(batch.expires, data.settings)
  return (
    <li className="batch">
      <div className="batch-main">
        <span className={`dot-lvl ${lvl}`} />
        <div className="batch-info">
          <div>
            MHD <b>{fmtDate(batch.expires)}</b> <ExpiryTag iso={batch.expires} settings={data.settings} />
          </div>
          <button className="link-btn inline" onClick={() => setEdit(!edit)}>
            {edit ? 'fertig' : 'Datum ändern'}
          </button>
        </div>
        <Stepper value={batch.qty} min={0} onChange={(v) => saveBatch({ ...batch, qty: v })} />
      </div>
      {edit && (
        <div className="batch-edit">
          <ExpiryInput value={expires} onChange={setExpires} />
          <button
            className="btn"
            onClick={() => {
              saveBatch({ ...batch, expires })
              setEdit(false)
            }}
          >
            Speichern
          </button>
          <button className="btn danger" onClick={() => confirm('Charge löschen?') && deleteBatch(batch.id)}>
            Löschen
          </button>
        </div>
      )}
    </li>
  )
}
