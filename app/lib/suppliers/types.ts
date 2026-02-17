/**
 * Shared Supplier Types
 *
 * Common interfaces that normalize product data across suppliers
 * (SS Activewear, SanMar, and any future suppliers).
 * These types are used by the frontend components so they don't need
 * to know which supplier they're talking to.
 */

export type SupplierKey = 'sanmar' | 'ss'

export interface SupplierConfig {
  key: SupplierKey
  name: string
  shortName: string
}

export const SUPPLIERS: Record<SupplierKey, SupplierConfig> = {
  sanmar: {
    key: 'sanmar',
    name: 'SanMar',
    shortName: 'SM',
  },
  ss: {
    key: 'ss',
    name: 'S&S Activewear',
    shortName: 'SS',
  },
}

export const DEFAULT_SUPPLIER: SupplierKey = 'sanmar'

/**
 * Normalized product returned from any supplier search/lookup.
 * This is what the frontend components work with.
 */
export interface SupplierProduct {
  supplier: SupplierKey
  styleID: string            // Unique ID within the supplier (SS numeric ID or SanMar style#)
  styleName: string          // Display style number (e.g., "G8000", "PC61")
  brandName: string
  category: string
  description: string
  productThumbnail: string
  colors: SupplierColor[]
  productImages?: string[]
}

export interface SupplierColor {
  colorID: string
  colorName: string
  catalogColor?: string      // SanMar mainframe color (used for ordering)
  colorHex?: string
  colorSwatchUrl?: string
  colorImages?: string[]
  sizes: SupplierSize[]
}

export interface SupplierSize {
  sizeID: string
  sizeName: string
  sizeIndex?: number         // SanMar size index
  inventoryKey?: number      // SanMar inventory key
  uniqueKey?: string         // SanMar unique key (inventoryKey + sizeIndex)
  wholesalePrice: number     // Our cost
  casePrice?: number         // SanMar case price
  retailPrice: number        // MSRP / retail
  salePrice?: number         // Current sale price if applicable
  caseSize?: number          // Units per case
}

export interface SupplierInventory {
  warehouse: string
  warehouseId?: number
  qty: number
  available: boolean
}

export interface SupplierSizeInventory {
  colorName: string
  sizeName: string
  inventory: SupplierInventory[]
  totalQty: number
}

export interface SupplierProductInventory {
  supplier: SupplierKey
  styleID: string
  items: SupplierSizeInventory[]
}
