import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { documentId } = await request.json()

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Fetch all line items for this document to find customer-added/modified ones
    const { data: allItems } = await supabase
      .from('line_items')
      .select('id, custom_fields')
      .eq('document_id', documentId)

    if (allItems && allItems.length > 0) {
      // Delete line items that were added by customer (additional color instances)
      const customerAddedIds = allItems
        .filter(item => item.custom_fields?.customer_added === true)
        .map(item => item.id)

      if (customerAddedIds.length > 0) {
        await supabase
          .from('line_items')
          .delete()
          .in('id', customerAddedIds)
      }

      // Clean customer-modified flags from modified items
      const customerModifiedItems = allItems.filter(item => item.custom_fields?.customer_modified === true)
      for (const item of customerModifiedItems) {
        const cf = { ...(item.custom_fields || {}) }
        delete cf.customer_modified
        delete cf.customer_modified_at
        await supabase
          .from('line_items')
          .update({ custom_fields: cf })
          .eq('id', item.id)
      }
    }

    // Reset document status back to viewed
    const { error } = await supabase
      .from('documents')
      .update({
        status: 'viewed',
        approved_at: null
      })
      .eq('id', documentId)

    if (error) {
      console.error('Undo approval error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Undo approval error:', err)
    return NextResponse.json({ error: err.message || 'Failed to undo approval' }, { status: 500 })
  }
}
