import { NextRequest, NextResponse } from 'next/server'
import { getSanMarClient } from '../../../lib/suppliers/sanmar'

/**
 * POST /api/purchase-orders/check-inventory
 *
 * Batch-checks SanMar inventory for multiple styles.
 * Accepts unique style numbers, fetches inventory in parallel,
 * returns a lookup map keyed by "style:color:size" → { total, warehouses }.
 *
 * Body: { styles: string[] }
 * Response: { inventory: Record<string, { total: number, warehouses: { name: string, qty: number }[] }> }
 */
export async function POST(request: NextRequest) {
  try {
    const { styles } = await request.json()

    if (!styles || !Array.isArray(styles) || styles.length === 0) {
      return NextResponse.json({ error: 'No styles provided' }, { status: 400 })
    }

    // Cap at 20 styles per request to avoid overloading
    const uniqueStyles = [...new Set(styles as string[])].slice(0, 20)

    const client = getSanMarClient()

    // Fetch inventory for all styles in parallel
    const results = await Promise.allSettled(
      uniqueStyles.map(style => client.getInventory(style))
    )

    // Build the lookup map: "STYLE:COLOR:SIZE" → { total, warehouses }
    const inventory: Record<string, { total: number; warehouses: { name: string; qty: number }[] }> = {}

    for (let i = 0; i < uniqueStyles.length; i++) {
      const result = results[i]
      if (result.status !== 'fulfilled' || !result.value) continue

      const productInventory = result.value
      for (const item of productInventory.items) {
        // Normalize the key: uppercase style, original color/size
        const key = `${uniqueStyles[i].toUpperCase()}:${item.colorName}:${item.sizeName}`

        const warehouses = item.inventory
          .filter(w => w.qty > 0)
          .map(w => ({ name: w.warehouse, qty: w.qty }))
          .sort((a, b) => b.qty - a.qty) // Highest stock first

        inventory[key] = {
          total: item.totalQty,
          warehouses,
        }
      }
    }

    return NextResponse.json({ inventory })
  } catch (error) {
    console.error('Inventory check error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check inventory' },
      { status: 500 }
    )
  }
}
