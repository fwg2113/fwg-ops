import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

/**
 * PATCH /api/line-items/skip
 *
 * Marks a line item as customer-provided by setting custom_fields.customer_provided = true.
 * This removes it from the purchase order queue.
 *
 * Body: { lineItemId: string }
 */
export async function PATCH(request: NextRequest) {
  try {
    const { lineItemId } = await request.json()

    if (!lineItemId) {
      return NextResponse.json({ error: 'lineItemId is required' }, { status: 400 })
    }

    // Fetch current custom_fields
    const { data: item, error: fetchError } = await supabase
      .from('line_items')
      .select('custom_fields')
      .eq('id', lineItemId)
      .single()

    if (fetchError || !item) {
      return NextResponse.json({ error: 'Line item not found' }, { status: 404 })
    }

    // Merge customer_provided into existing custom_fields
    const updatedFields = { ...(item.custom_fields || {}), customer_provided: true }

    const { error: updateError } = await supabase
      .from('line_items')
      .update({ custom_fields: updatedFields })
      .eq('id', lineItemId)

    if (updateError) {
      console.error('Error updating line item:', updateError)
      return NextResponse.json({ error: 'Failed to update line item' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Line item skip error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
