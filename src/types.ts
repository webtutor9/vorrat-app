export type Unit = 'g' | 'ml'

export type Category =
  | 'Teigwaren & Getreide'
  | 'Brot & Backwaren'
  | 'Konserven Gemüse & Hülsenfrüchte'
  | 'Konserven Fisch & Fleisch'
  | 'Fertiggerichte'
  | 'Saucen & Würze'
  | 'Öle & Fette'
  | 'Nüsse & Snacks'
  | 'Getränke & Wasser'
  | 'Sonstiges'

export const CATEGORIES: Category[] = [
  'Teigwaren & Getreide',
  'Brot & Backwaren',
  'Konserven Gemüse & Hülsenfrüchte',
  'Konserven Fisch & Fleisch',
  'Fertiggerichte',
  'Saucen & Würze',
  'Öle & Fette',
  'Nüsse & Snacks',
  'Getränke & Wasser',
  'Sonstiges',
]

/** Nährwerte pro 100 g bzw. 100 ml */
export interface Nutrition {
  kcal: number
  protein: number
  fat: number
  carbs: number
}

export interface Product {
  id: string
  name: string
  brand?: string
  category: Category
  unit: Unit
  /** Füllmenge laut Packung (z.B. 500 g, 200 g netto) */
  netAmount: number
  /** Menge, auf die sich die Nährwerte beziehen (z.B. Abtropfgewicht 155 g) – Standard: netAmount */
  edibleAmount?: number
  per100: Nutrition
  /** Wasser/Getränk in Litern pro Packung, zählt für den Wasservorrat */
  waterL?: number
  /** Nährwerte geschätzt (Etikett nicht lesbar) */
  estimated?: boolean
  ean?: string
  note?: string
}

export interface Batch {
  id: string
  productId: string
  qty: number
  /** Mindestens haltbar bis, YYYY-MM-DD */
  expires: string
  addedAt: string
}

export type Sex = 'm' | 'w'
export type Pal = 1.4 | 1.6 | 1.8

export interface Person {
  id: string
  name: string
  sex: Sex
  age: number
  pal: Pal
  /** manueller Kalorienbedarf, überschreibt den Richtwert */
  kcalOverride?: number
}

export interface Settings {
  people: Person[]
  warnYellowDays: number
  warnRedDays: number
  waterPerPersonL: number
  /** abgelaufene Chargen in der Reichweite mitzählen */
  countExpired: boolean
}

export interface PantryData {
  version: 1
  products: Product[]
  batches: Batch[]
  settings: Settings
  updatedAt: string
}

export interface SyncConfig {
  owner: string
  repo: string
  branch: string
  path: string
  token: string
}

export type Op =
  | { kind: 'product'; product: Product }
  | { kind: 'product-del'; id: string }
  | { kind: 'batch'; batch: Batch }
  | { kind: 'batch-del'; id: string }
  | { kind: 'settings'; settings: Settings }
