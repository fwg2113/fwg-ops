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
  decoration_type: string
  applies_to: string[]
  quantity_breaks: QuantityBreak[]
  created_at: string
  updated_at: string
}

export interface QuantityBreak {
  min: number
  max: number
  markup_pct: number
  decoration_prices: DecorationPrices
}

export interface DecorationPrices {
  // For embroidery (caps and polos)
  up_to_10k?: number
  '10k_to_20k'?: number
  // For DTF
  front?: number
  back?: number
  left_sleeve?: number
  right_sleeve?: number
  extra?: number
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
 * Find the applicable quantity break for a given quantity
 */
export function findQuantityBreak(
  quantity: number,
  quantityBreaks: QuantityBreak[]
): QuantityBreak | null {
  if (!quantityBreaks || quantityBreaks.length === 0) {
    return null
  }

  // Sort quantity breaks by min to ensure correct order
  const sortedBreaks = [...quantityBreaks].sort((a, b) => a.min - b.min)

  // Find the applicable quantity break
  for (const breakPoint of sortedBreaks) {
    const meetsMin = quantity >= breakPoint.min
    const meetsMax = quantity <= breakPoint.max

    if (meetsMin && meetsMax) {
      return breakPoint
    }
  }

  // If no exact break found, return the last (highest quantity) break
  return sortedBreaks[sortedBreaks.length - 1]
}

/**
 * Calculate decoration price based on quantity and location
 */
export function calculateDecorationPrice(
  quantity: number,
  quantityBreaks: QuantityBreak[],
  location: string = 'front',
  stitchCount: number = 5000
): number {
  const qtyBreak = findQuantityBreak(quantity, quantityBreaks)
  if (!qtyBreak) return 0

  const prices = qtyBreak.decoration_prices

  // For embroidery (based on stitch count)
  if (prices.up_to_10k !== undefined) {
    return stitchCount <= 10000 ? prices.up_to_10k : (prices['10k_to_20k'] || prices.up_to_10k)
  }

  // For DTF (based on location)
  if (location === 'front' && prices.front) return prices.front
  if (location === 'back' && prices.back) return prices.back
  if (location === 'left_sleeve' && prices.left_sleeve) return prices.left_sleeve
  if (location === 'right_sleeve' && prices.right_sleeve) return prices.right_sleeve
  if (prices.extra) return prices.extra

  // Default to first available price
  return Object.values(prices)[0] || 0
}

// ============================================================================
// MARKUP CALCULATOR
// ============================================================================

/**
 * Calculate markup percentage for a given quantity
 */
export function getMarkupPercentage(
  quantity: number,
  quantityBreaks: QuantityBreak[]
): number {
  const qtyBreak = findQuantityBreak(quantity, quantityBreaks)
  return qtyBreak ? qtyBreak.markup_pct : 200 // Default 200% markup
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
  let markupPct = 200 // Default

  if (lineItem.decoration_type && pricingMatrixId) {
    const matrix = await getPricingMatrixById(pricingMatrixId)
    if (matrix) {
      decorationCost = calculateDecorationPrice(
        lineItem.quantity,
        matrix.quantity_breaks,
        'front', // Default location
        5000 // Default stitch count
      )
      markupPct = getMarkupPercentage(lineItem.quantity, matrix.quantity_breaks)
    }
  } else if (lineItem.manual_override?.decoration_price !== undefined) {
    decorationCost = lineItem.manual_override.decoration_price
  }

  // 3. Calculate totals (no size upcharge in current schema)
  const subtotal = wholesaleCost + decorationCost
  const total = subtotal * lineItem.quantity

  return {
    line_item: lineItem,
    wholesale_cost: wholesaleCost,
    decoration_cost: decorationCost,
    size_upcharge: 0,
    subtotal: subtotal,
    total: total,
    breakdown: {
      base_wholesale: wholesalePrice,
      quantity_discount: 0,
      decoration_base: decorationCost,
      decoration_multiplier: lineItem.decoration_locations || 1,
      size_upcharge: 0,
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
