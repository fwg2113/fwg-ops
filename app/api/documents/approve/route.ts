import { NextResponse } from 'next/server'
import { supabase } from '@/app/lib/supabase'
import { autoCompleteActions } from '@/app/lib/customer/actionGenerator'

export async function POST(request: Request) {
  try {
    const { documentId, convertToInvoice = true, lineItemUpdates } = await request.json()

    if (!documentId) {
      return NextResponse.json({ error: 'Missing documentId' }, { status: 400 })
    }

    // Get current document
    const { data: doc, error: fetchError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (fetchError || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Apply customer line item updates (sizes, colors) if provided
    if (lineItemUpdates && typeof lineItemUpdates === 'object') {
      const itemIds = Object.keys(lineItemUpdates)
      if (itemIds.length > 0) {
        // Fetch all affected line items
        const { data: items } = await supabase
          .from('line_items')
          .select('*')
          .in('id', itemIds)
          .eq('document_id', documentId)

        if (items) {
          for (const item of items) {
            const updates = lineItemUpdates[item.id]
            if (!updates) continue

            const cf = { ...(item.custom_fields || {}) }
            let totalQty = item.quantity
            let lineTotal = item.line_total

            // Update color if changed
            if (updates.color) {
              cf.color = updates.color
            }

            // Update size quantities if provided
            if (updates.sizes && cf.sizes) {
              const existingSizes = cf.sizes as Record<string, { qty: number; price: number; wholesale?: number }>
              let newTotalQty = 0
              let newLineTotal = 0

              for (const [sizeName, newQty] of Object.entries(updates.sizes as Record<string, number>)) {
                if (existingSizes[sizeName]) {
                  existingSizes[sizeName].qty = newQty
                }
                newTotalQty += newQty
                newLineTotal += newQty * (existingSizes[sizeName]?.price || 0)
              }

              cf.sizes = existingSizes
              totalQty = newTotalQty
              lineTotal = newLineTotal
            }

            // Add note about customer modifications
            cf.customer_modified = true
            cf.customer_modified_at = new Date().toISOString()

            await supabase
              .from('line_items')
              .update({
                custom_fields: cf,
                quantity: totalQty,
                line_total: lineTotal
              })
              .eq('id', item.id)
          }

          // Recalculate document totals
          const { data: allItems } = await supabase
            .from('line_items')
            .select('line_total, taxable')
            .eq('document_id', documentId)

          if (allItems) {
            const newSubtotal = allItems.reduce((sum, i) => sum + (i.line_total || 0), 0)
            const discountAmount = doc.discount_percent
              ? (newSubtotal * doc.discount_percent / 100)
              : (parseFloat(String(doc.discount_amount)) || 0)
            const taxableSubtotal = allItems.filter(i => i.taxable).reduce((sum, i) => sum + (i.line_total || 0), 0)
            const taxAmount = taxableSubtotal * 0.06
            const fees = (() => {
              try {
                const f = Array.isArray(doc.fees) ? doc.fees : JSON.parse(doc.fees || '[]')
                return f.reduce((sum: number, fee: any) => sum + (fee.amount || 0), 0)
              } catch { return 0 }
            })()
            const newTotal = newSubtotal + fees - discountAmount + taxAmount

            await supabase
              .from('documents')
              .update({
                subtotal: newSubtotal,
                tax_amount: taxAmount,
                total: newTotal,
                balance_due: newTotal - (doc.amount_paid || 0)
              })
              .eq('id', documentId)
          }
        }
      }
    }

    // Re-fetch document after potential line item updates
    const { data: updatedDoc } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single()

    const docForUpdate = updatedDoc || doc

    // Prepare update data
    const updateData: any = {
      status: 'approved',
      approved_at: new Date().toISOString()
    }

    // If it's a quote and we should convert to invoice
    if (docForUpdate.doc_type === 'quote' && convertToInvoice) {
      // Get next doc_number from ALL documents (not just invoices)
      const { data: lastDoc } = await supabase
        .from('documents')
        .select('doc_number')
        .order('doc_number', { ascending: false })
        .limit(1)
        .single()

      const nextDocNumber = (lastDoc?.doc_number || 1000) + 1

      updateData.doc_type = 'invoice'
      updateData.doc_number = nextDocNumber
      updateData.balance_due = docForUpdate.total - (docForUpdate.amount_paid || 0)
    }

    // Update the document
    const { data, error } = await supabase
      .from('documents')
      .update(updateData)
      .eq('id', documentId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Auto-complete customer actions triggered by approval
    await autoCompleteActions(documentId, 'approved')

    return NextResponse.json({
      success: true,
      document: data,
      converted: docForUpdate.doc_type === 'quote' && convertToInvoice
    })
  } catch (error) {
    console.error('Approve error:', error)
    return NextResponse.json({ error: 'Failed to approve document' }, { status: 500 })
  }
}