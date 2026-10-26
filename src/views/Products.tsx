import { useState } from 'react'
import type { Category, PantryData, Product, Unit } from '../types'
import { CATEGORIES } from '../types'
import { n0, perPackage, slug } from '../calc'
import { deleteProduct, saveProduct } from '../store'
import { Sheet } from '../components'

export function Products({ data, editId, setEditId }: { data: PantryData; editId: string | null; setEditId: (id: string | null) => void }) {
  const editing = editId === 'new' ? null : data.products.find((p) => p.id === editId)
  const list = [...data.products].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name, 'de'))
  return (
    <div className="products">
      <div className="toolbar">
        <p className="muted small grow">
          {data.products.length} Produkte im Katalog. Neue Produkte kannst du hier erfassen oder als Etikett-Foto an Claude schicken.
        </p>
        <button className="btn primary" onClick={() => setEditId('new')}>
          + Neues Produkt
        </button>
      </div>
      <section className="card">
        <table className="catalog">
          <thead>
            <tr>
              <th>Produkt</th>
              <th>Packung</th>
              <th>kcal/100</th>
              <th>kcal/Pkg.</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} onClick={() => setEditId(p.id)}>
                <td>
                  <b>{p.name}</b>
                  {p.estimated && <span className="tag exp-yellow" title="Nährwerte geschätzt">geschätzt</span>}
                  <div className="muted small">
                    {p.brand ? `${p.brand} · ` : ''}
                    {p.category}
                  </div>
                </td>
                <td>
                  {n0(p.netAmount)} {p.unit}
                  {p.edibleAmount && p.edibleAmount !== p.netAmount && <div className="muted small">abgetr. {n0(p.edibleAmount)}</div>}
                </td>
                <td>{n0(p.per100.kcal)}</td>
                <td>{n0(perPackage(p).kcal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {editId && (
        <ProductForm
          product={editing ?? undefined}
          inUse={!!editing && data.batches.some((b) => b.productId === editing.id)}
          onClose={() => setEditId(null)}
        />
      )}
    </div>
  )
}

type Form = {
  name: string
  brand: string
  category: Category
  unit: Unit
  netAmount: string
  edibleAmount: string
  kcal: string
  protein: string
  fat: string
  carbs: string
  waterL: string
  estimated: boolean
  ean: string
  note: string
}

const num = (s: string) => {
  const v = parseFloat(s.replace(',', '.'))
  return Number.isFinite(v) ? v : 0
}
const str = (v: number | undefined) => (v === undefined ? '' : String(v))

function ProductForm({ product, inUse, onClose }: { product?: Product; inUse: boolean; onClose: () => void }) {
  const [f, setF] = useState<Form>(() => ({
    name: product?.name ?? '',
    brand: product?.brand ?? '',
    category: product?.category ?? 'Sonstiges',
    unit: product?.unit ?? 'g',
    netAmount: str(product?.netAmount),
    edibleAmount: product?.edibleAmount && product.edibleAmount !== product.netAmount ? str(product.edibleAmount) : '',
    kcal: str(product?.per100.kcal),
    protein: str(product?.per100.protein),
    fat: str(product?.per100.fat),
    carbs: str(product?.per100.carbs),
    waterL: str(product?.waterL),
    estimated: product?.estimated ?? false,
    ean: product?.ean ?? '',
    note: product?.note ?? '',
  }))
  const bind = (k: keyof Form) => ({
    value: f[k] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value }),
  })
  const water = f.category === 'Getränke & Wasser'

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const p: Product = {
      id: product?.id ?? slug(f.name),
      name: f.name.trim(),
      category: f.category,
      unit: f.unit,
      netAmount: num(f.netAmount),
      per100: { kcal: num(f.kcal), protein: num(f.protein), fat: num(f.fat), carbs: num(f.carbs) },
    }
    if (f.brand.trim()) p.brand = f.brand.trim()
    if (f.edibleAmount && num(f.edibleAmount) > 0) p.edibleAmount = num(f.edibleAmount)
    if (num(f.waterL) > 0) p.waterL = num(f.waterL)
    if (f.estimated) p.estimated = true
    if (f.ean.trim()) p.ean = f.ean.trim()
    if (f.note.trim()) p.note = f.note.trim()
    saveProduct(p)
    onClose()
  }

  return (
    <Sheet title={product ? 'Produkt bearbeiten' : 'Neues Produkt'} onClose={onClose}>
      <form className="form scroll" onSubmit={submit}>
        <label>
          Name
          <input {...bind('name')} required />
        </label>
        <div className="two">
          <label>
            Marke
            <input {...bind('brand')} />
          </label>
          <label>
            Kategorie
            <select {...bind('category')}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="three">
          <label>
            Einheit
            <select {...bind('unit')}>
              <option value="g">g</option>
              <option value="ml">ml</option>
            </select>
          </label>
          <label>
            Füllmenge
            <input {...bind('netAmount')} inputMode="decimal" required />
          </label>
          <label>
            Abtropfgew.
            <input {...bind('edibleAmount')} inputMode="decimal" placeholder="–" />
          </label>
        </div>
        <fieldset>
          <legend>Nährwerte pro 100 {f.unit}{f.edibleAmount ? ' (abgetropft)' : ''}</legend>
          <div className="four">
            <label>
              kcal
              <input {...bind('kcal')} inputMode="decimal" required />
            </label>
            <label>
              Eiweiss g
              <input {...bind('protein')} inputMode="decimal" required />
            </label>
            <label>
              Fett g
              <input {...bind('fat')} inputMode="decimal" required />
            </label>
            <label>
              KH g
              <input {...bind('carbs')} inputMode="decimal" />
            </label>
          </div>
        </fieldset>
        {water && (
          <label>
            Trinkwasser pro Packung (Liter)
            <input {...bind('waterL')} inputMode="decimal" placeholder="z.B. 1.5" />
          </label>
        )}
        <label className="check">
          <input type="checkbox" checked={f.estimated} onChange={(e) => setF({ ...f, estimated: e.target.checked })} />
          Nährwerte geschätzt
        </label>
        <div className="two">
          <label>
            EAN
            <input {...bind('ean')} inputMode="numeric" />
          </label>
          <label>
            Notiz
            <input {...bind('note')} />
          </label>
        </div>
        <div className="btn-row">
          <button className="btn primary">Speichern</button>
          {product && (
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                if (confirm(inUse ? 'Produkt samt Bestand löschen?' : 'Produkt löschen?')) {
                  deleteProduct(product.id)
                  onClose()
                }
              }}
            >
              Löschen
            </button>
          )}
        </div>
      </form>
    </Sheet>
  )
}
