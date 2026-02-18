import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/app/lib/supabase'
import { autoCompleteActions } from '@/app/lib/customer/actionGenerator'
import twilio from 'twilio'

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

export async function POST(request: NextRequest) {
  try {
    const { documentId, optionId, optionTitle, question, customerName, contactPreference, sizeQuantities, lineItemUpdates, action } = await request.json()

    if (!documentId || !optionId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: doc, error: fetchError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (fetchError || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const isApproval = action === 'approve'
    const isChangeRequest = action === 'request_changes'

    const timestamp = new Date().toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true
    })

    let noteEntry = isChangeRequest
      ? `** CHANGE REQUEST (${timestamp}) **\n`
      : `** OPTION APPROVED (${timestamp}) **\n`
    noteEntry += `Customer: ${customerName}\n`
    noteEntry += `${isChangeRequest ? 'Option' : 'Approved'}: ${optionTitle}\n`
    if (contactPreference) {
      noteEntry += `Contact Preference: ${contactPreference === 'sms' ? 'Text/SMS' : 'Email'}\n`
    }
    if (sizeQuantities && typeof sizeQuantities === 'object') {
      const sizeEntries = Object.entries(sizeQuantities as Record<string, number>)
        .filter(([, qty]) => qty > 0)
      if (sizeEntries.length > 0) {
        const totalPcs = sizeEntries.reduce((sum, [, qty]) => sum + qty, 0)
        noteEntry += `Sizes: ${sizeEntries.map(([size, qty]) => `${size}(${qty})`).join(', ')} — ${totalPcs} pcs total\n`
      }
    }
    if (question) {
      noteEntry += `Revision Request: ${question}\n`
    }

    const existingNotes = doc.notes || ''
    const updatedNotes = existingNotes ? `${existingNotes}\n\n${noteEntry}` : noteEntry

    const newStatus = isChangeRequest ? 'revision_requested' : 'option_selected'

    const { error: updateError } = await supabase
      .from('documents')
      .update({
        status: newStatus,
        notes: updatedNotes
      })
      .eq('id', documentId)

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json({ error: 'Failed to update document' }, { status: 500 })
    }

    // Apply customer line item updates (sizes, colors) if provided
    if (isApproval && lineItemUpdates && typeof lineItemUpdates === 'object') {
      const itemIds = Object.keys(lineItemUpdates)
      if (itemIds.length > 0) {
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

            if (updates.color) {
              cf.color = updates.color
            }

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
        }
      }
    }

    const businessPhone = process.env.TWILIO_PHONE_TO || '+12406933715'
    let smsBody = isChangeRequest
      ? `Change Requested!\n${customerName} wants changes to "${optionTitle}" on Quote #${doc.doc_number}`
      : `Option Approved!\n${customerName} approved "${optionTitle}" on Quote #${doc.doc_number}`
    if (contactPreference) {
      smsBody += `\nPrefers: ${contactPreference === 'sms' ? 'Text/SMS' : 'Email'}`
    }
    if (sizeQuantities && typeof sizeQuantities === 'object') {
      const sizeEntries = Object.entries(sizeQuantities as Record<string, number>)
        .filter(([, qty]) => qty > 0)
      if (sizeEntries.length > 0) {
        const totalPcs = sizeEntries.reduce((sum, [, qty]) => sum + qty, 0)
        smsBody += `\nSizes: ${sizeEntries.map(([size, qty]) => `${size}(${qty})`).join(', ')} — ${totalPcs} pcs`
      }
    }
    if (question) {
      smsBody += `\n\nChange Request: ${question}`
    }

    try {
      await twilioClient.messages.create({
        body: smsBody,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: businessPhone
      })
    } catch (smsError) {
      console.error('SMS error:', smsError)
    }

    // Auto-complete customer actions triggered by this status change
    await autoCompleteActions(documentId, newStatus).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Option selection error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}