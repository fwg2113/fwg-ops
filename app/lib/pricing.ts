/**
 * Pricing Engine
 *
 * Handles all pricing calculations for apparel decoration quotes including:
 * - Quantity break pricing from apparel_pricing_matrices
 * - Decoration costs (embroidery, DTF, screen printing, etc.)
 * - Size upcharges (2XL+, 3XL+, etc.)
 * - Manual price overrides
 * - Total quote calculations
 */

import { supabase } from '@/app/lib/supabase'

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface PricingMatrix {
  id: string
  name: string
  description: string | null
  decoration_type: string
  base_price: number
  quantity_breaks: QuantityBreak[]
  size_upcharges: SizeUpcharge[]
  created_at: string
  updated_at: string
}

export interface QuantityBreak {
  min_qty: number
  max_qty: number | null
  price_per_unit: number
}

export interface SizeUpcharge {
  size: string
  upcharge_amount: number
}

export interface QuoteLineItem {
  style_id: number
  style_name: string
  color_name: string
  size: string
  quantity: number
  wholesale_price: number
  decoration_type?: string
  decoration_locations?: number
  manual_override?: {
    wholesale_price?: number
    decoration_price?: number
    total_price?: number
  }
}

export interface QuoteCalculation {
  line_item: QuoteLineItem
  wholesale_cost: number
  decoration_cost: number
  size_upcharge: number
  subtotal: number
  total: number
  breakdown: {
    base_wholesale: number
    quantity_discount: number
    decoration_base: number
    decoration_multiplier: number
    size_upcharge: number
    manual_override: boolean
  }
}

export interface QuoteSummary {
  line_items: QuoteCalculation[]
  total_wholesale_cost: number
  total_decoration_cost: number
  total_size_upcharges: number
  grand_total: number
  item_count: number
}

// ============================================================================
// PRICING MATRIX QUERIES
// ============================================================================

/**
 * Get all pricing matrices from database
 */
export async function getAllPricingMatrices(): Promise<PricingMatrix[]> {
  const { data, error } = await supabase
    .from('apparel_pricing_matrices')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching pricing matrices:', error)
    throw new Error('Failed to fetch pricing matrices')
  }

  return data || []
}

/**
 * Get pricing matrix by ID
 */
export async function getPricingMatrixById(id: string): Promise<PricingMatrix | null> {
  const { data, error } = await supabase
    .from('apparel_pricing_matrices')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error(`Error fetching pricing matrix ${id}:`, error)
    return null
  }

  return data
}

/**
 * Get pricing matrix by decoration type
 */
export async function getPricingMatrixByType(decorationType: string): Promise<PricingMatrix | null> {
  const { data, error } = await supabase
    .from('apparel_pricing_matrices')
    .select('*')
    .eq('decoration_type', decorationType)
    .limit(1)
    .single()

  if (error) {
    console.error(`Error fetching pricing matrix for type ${decorationType}:`, error)
    return null
  }

  return data
}

// ============================================================================
// QUANTITY BREAK CALCULATOR
// ============================================================================

/**
 * Calculate the price per unit based on quantity breaks
 */
export function calculateQuantityBreakPrice(
  quantity: number,
  quantityBreaks: QuantityBreak[]
): number {
  if (!quantityBreaks || quantityBreaks.length === 0) {
    return 0
  }

  // Sort quantity breaks by min_qty to ensure correct order
  const sortedBreaks = [...quantityBreaks].sort((a, b) => a.min_qty - b.min_qty)

  // Find the applicable quantity break
  for (const breakPoint of sortedBreaks) {
    const meetsMin = quantity >= breakPoint.min_qty
    const meetsMax = breakPoint.max_qty === null || quantity <= breakPoint.max_qty

    if (meetsMin && meetsMax) {
      return breakPoint.price_per_unit
    }
  }

  // If no break found, return the last (highest quantity) break price
  return sortedBreaks[sortedBreaks.length - 1].price_per_unit
}

// ============================================================================
// SIZE UPCHARGE CALCULATOR
// ============================================================================

/**
 * Calculate size upcharge for a given size
 */
export function calculateSizeUpcharge(
  size: string,
  sizeUpcharges: SizeUpcharge[]
): number {
  if (!sizeUpcharges || sizeUpcharges.length === 0) {
    return 0
  }

  const normalizedSize = size.toUpperCase().trim()

  const upcharge = sizeUpcharges.find(
    (u) => u.size.toUpperCase().trim() === normalizedSize
  )

  return upcharge ? upcharge.upcharge_amount : 0
}

/**
 * Check if a size qualifies for upcharge (2XL, 3XL, 4XL, etc.)
 */
export function isSizeWithUpcharge(size: string): boolean {
  const normalizedSize = size.toUpperCase().trim()
  const upchargeSizes = ['2XL', '3XL', '4XL', '5XL', '6XL', 'XXL', 'XXXL', 'XXXXL']
  return upchargeSizes.includes(normalizedSize)
}

// ============================================================================
// DECORATION COST CALCULATOR
// ============================================================================

/**
 * Calculate decoration cost based on quantity and pricing matrix
 */
export function calculateDecorationCost(
  quantity: number,
  pricingMatrix: PricingMatrix,
  locations: number = 1
): number {
  const pricePerLocation = calculateQuantityBreakPrice(
    quantity,
    pricingMatrix.quantity_breaks
  )

  return pricePerLocation * locations
}

// ============================================================================
// TOTAL QUOTE CALCULATOR
// ============================================================================

/**
 * Calculate complete pricing for a single quote line item
 */
export async function calculateLineItemPrice(
  lineItem: QuoteLineItem,
  pricingMatrixId?: string
): Promise<QuoteCalculation> {
  // Check for manual override that sets total price
  if (lineItem.manual_override?.total_price !== undefined) {
    return {
      line_item: lineItem,
      wholesale_cost: 0,
      decoration_cost: 0,
      size_upcharge: 0,
      subtotal: lineItem.manual_override.total_price,
      total: lineItem.manual_override.total_price * lineItem.quantity,
      breakdown: {
        base_wholesale: 0,
        quantity_discount: 0,
        decoration_base: 0,
        decoration_multiplier: lineItem.decoration_locations || 1,
        size_upcharge: 0,
        manual_override: true
      }
    }
  }

  // 1. Calculate wholesale cost (with manual override support)
  const wholesalePrice = lineItem.manual_override?.wholesale_price ?? lineItem.wholesale_price
  const wholesaleCost = wholesalePrice

  // 2. Calculate decoration cost
  let decorationCost = 0
  if (lineItem.decoration_type && pricingMatrixId) {
    const matrix = await getPricingMatrixById(pricingMatrixId)
    if (matrix) {
      decorationCost = calculateDecorationCost(
        lineItem.quantity,
        matrix,
        lineItem.decoration_locations || 1
      )
    }
  } else if (lineItem.manual_override?.decoration_price !== undefined) {
    decorationCost = lineItem.manual_override.decoration_price
  }

  // 3. Calculate size upcharge (if applicable)
  let sizeUpcharge = 0
  if (pricingMatrixId) {
    const matrix = await getPricingMatrixById(pricingMatrixId)
    if (matrix && matrix.size_upcharges) {
      sizeUpcharge = calculateSizeUpcharge(lineItem.size, matrix.size_upcharges)
    }
  }

  // 4. Calculate totals
  const subtotal = wholesaleCost + decorationCost + sizeUpcharge
  const total = subtotal * lineItem.quantity

  return {
    line_item: lineItem,
    wholesale_cost: wholesaleCost,
    decoration_cost: decorationCost,
    size_upcharge: sizeUpcharge,
    subtotal: subtotal,
    total: total,
    breakdown: {
      base_wholesale: wholesalePrice,
      quantity_discount: 0, // Can be enhanced to track discount amount
      decoration_base: decorationCost,
      decoration_multiplier: lineItem.decoration_locations || 1,
      size_upcharge: sizeUpcharge,
      manual_override: lineItem.manual_override !== undefined
    }
  }
}

/**
 * Calculate complete quote for multiple line items
 */
export async function calculateQuote(
  lineItems: QuoteLineItem[],
  pricingMatrixId?: string
): Promise<QuoteSummary> {
  const calculations: QuoteCalculation[] = []

  for (const item of lineItems) {
    const calc = await calculateLineItemPrice(item, pricingMatrixId)
    calculations.push(calc)
  }

  const totalWholesale = calculations.reduce((sum, calc) => sum + (calc.wholesale_cost * calc.line_item.quantity), 0)
  const totalDecoration = calculations.reduce((sum, calc) => sum + (calc.decoration_cost * calc.line_item.quantity), 0)
  const totalUpcharges = calculations.reduce((sum, calc) => sum + (calc.size_upcharge * calc.line_item.quantity), 0)
  const grandTotal = calculations.reduce((sum, calc) => sum + calc.total, 0)
  const itemCount = calculations.reduce((sum, calc) => sum + calc.line_item.quantity, 0)

  return {
    line_items: calculations,
    total_wholesale_cost: totalWholesale,
    total_decoration_cost: totalDecoration,
    total_size_upcharges: totalUpcharges,
    grand_total: grandTotal,
    item_count: itemCount
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format price to currency string
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(price)
}

/**
 * Calculate markup percentage
 */
export function calculateMarkup(cost: number, sellPrice: number): number {
  if (cost === 0) return 0
  return ((sellPrice - cost) / cost) * 100
}

/**
 * Calculate margin percentage
 */
export function calculateMargin(cost: number, sellPrice: number): number {
  if (sellPrice === 0) return 0
  return ((sellPrice - cost) / sellPrice) * 100
}
