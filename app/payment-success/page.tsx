import { supabase } from '../lib/supabase'
import { isAutomationEnabled } from '../lib/automation-settings'
import { syncPaymentToSheet } from '../lib/payment-sheet-sync'
import PaymentSuccessClient from './PaymentSuccessClient'

export default async function PaymentSuccessPage({ 
  searchParams 
}: { 
  searchParams: Promise<{ session_id?: string }> 
}) {
  const { session_id } = await searchParams
  
  if (!session_id) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ color: '#ef4444' }}>Missing session ID</h1>
        </div>
      </div>
    )
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  const resendApiKey = process.env.RESEND_API_KEY
  let documentId: string | null = null
  let amount = 0

  try {
    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${session_id}`, {
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
      },
    })
    const session = await response.json()

    // Only record payment if Stripe confirms it's actually paid
    // Bank transfers (ACH) redirect to success URL before payment completes
    if (session.payment_status !== 'paid') {
      const isPending = session.payment_status === 'unpaid' || session.payment_status === 'no_payment_required'
      return <PaymentSuccessClient documentId={session.metadata?.document_id || null} amount={0} pending={isPending} />
    }

    if (session.metadata?.document_id) {
      documentId = session.metadata.document_id
      const stripeAmount = (session.amount_total || 0) / 100
      // Use base amount for invoice balance (excludes CC processing fee)
      const baseAmount = session.metadata?.base_amount ? parseFloat(session.metadata.base_amount) : stripeAmount
      amount = baseAmount

      // Prevent duplicate payment records (e.g. customer refreshes success page)
      const { data: existingPayment } = await supabase
        .from('payments')
        .select('id')
        .eq('processor_txn_id', session.payment_intent)
        .maybeSingle()

      if (existingPayment) {
        return <PaymentSuccessClient documentId={documentId} amount={amount} />
      }

      const { data: invoice } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single()
      
      if (invoice) {
        const newAmountPaid = (invoice.amount_paid || 0) + amount
        const newBalanceDue = (invoice.total || 0) - newAmountPaid
        const isPaidInFull = newBalanceDue <= 0

        // Convert quote to invoice if this is a quote receiving payment
        let convertedToInvoice = false
        if (invoice.doc_type === 'quote') {
          const { data: lastDoc } = await supabase
            .from('documents')
            .select('doc_number')
            .order('doc_number', { ascending: false })
            .limit(1)
            .single()

          const nextDocNumber = (lastDoc?.doc_number || 1000) + 1

          await supabase
            .from('documents')
            .update({
              doc_type: 'invoice',
              doc_number: nextDocNumber,
              approved_at: invoice.approved_at || new Date().toISOString(),
            })
            .eq('id', documentId)

          convertedToInvoice = true
          console.log(`[Payment] Converted quote #${invoice.doc_number} → invoice #${nextDocNumber}`)
        }

        // Update invoice payment status
        await supabase
          .from('documents')
          .update({
            status: isPaidInFull ? 'paid' : 'partial',
            amount_paid: newAmountPaid,
            balance_due: Math.max(0, newBalanceDue),
            paid_at: isPaidInFull ? new Date().toISOString() : null
          })
          .eq('id', documentId)

        // Automation #1: Auto-move to production on payment (any payment amount)
        if (amount > 0 && !invoice.in_production) {
          const autoProductionEnabled = await isAutomationEnabled('auto_production_on_payment')

          if (autoProductionEnabled) {
            try {
              // Generate production tasks
              const taskResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://fwg-ops.vercel.app'}/api/production/generate-tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invoiceId: documentId })
              })

              const taskResult = await taskResponse.json()

              if (taskResult.success) {
                // Move invoice to production
                await supabase
                  .from('documents')
                  .update({
                    in_production: true,
                    bucket: 'IN_PRODUCTION'
                  })
                  .eq('id', documentId)

                console.log(`[Automation] Moved invoice #${invoice.doc_number} to production (${taskResult.totalTasksCreated} tasks created)`)
              }
            } catch (autoError) {
              console.error('[Automation] Failed to auto-move to production:', autoError)
              // Don't fail the payment process if automation fails
            }
          }
        }

        const paymentType = session.metadata?.payment_type === 'bank_transfer' ? 'bank_transfer' : 'card'
        const parsedBase = session.metadata?.base_amount ? parseFloat(session.metadata.base_amount) : 0
        const baseAmount = parsedBase > 0 ? parsedBase : stripeAmount
        const processingFee = stripeAmount - baseAmount

        // Insert payment record and get the ID back
        const { data: paymentRecord, error: paymentError } = await supabase
          .from('payments')
          .insert({
            document_id: documentId,
            amount: stripeAmount,
            processing_fee: processingFee > 0 ? processingFee : 0,
            payment_method: paymentType,
            processor: 'stripe',
            processor_txn_id: session.payment_intent,
            status: 'completed',
            read: false,
            created_at: new Date().toISOString()
          })
          .select()
          .single()

        // Sync payment to Google Sheets
        if (paymentRecord && !paymentError) {
          try {
            const sheetResult = await syncPaymentToSheet(paymentRecord.id)
            if (sheetResult.success) {
              console.log(`✓ Payment synced to Google Sheets: ${sheetResult.rowsAdded} rows added (${sheetResult.txnNumbers?.join(', ')})`)
            } else {
              console.error(`✗ Failed to sync payment to Google Sheets: ${sheetResult.error}`)
              // Don't fail the payment process if sheet sync fails
            }
          } catch (sheetError) {
            console.error('✗ Error syncing payment to Google Sheets:', sheetError)
            // Don't fail the payment process if sheet sync fails
          }
        }

        // Send notification email to FWG for every payment
        if (resendApiKey) {
          const subject = isPaidInFull
            ? `Invoice #${invoice.doc_number} PAID IN FULL - $${stripeAmount.toFixed(2)}`
            : `Payment Received - Invoice #${invoice.doc_number} - $${stripeAmount.toFixed(2)}`
          const statusLine = isPaidInFull
            ? `<p><strong>Invoice #${invoice.doc_number}</strong> has been <span style="color: #22c55e;">paid in full</span>.</p>`
            : `<p><strong>Invoice #${invoice.doc_number}</strong> received a partial payment. Balance remaining: <strong style="color: #f59e0b;">$${Math.max(0, newBalanceDue).toFixed(2)}</strong></p>`
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'FWG Ops <quotes@frederickwraps.com>',
              to: ['info@frederickwraps.com'],
              subject,
              html: `
                <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h1 style="color: #22c55e;">Payment Received!</h1>
                  ${statusLine}
                  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <tr><td style="padding: 8px 0; color: #666;">Customer</td><td style="padding: 8px 0;"><strong>${invoice.customer_name}</strong></td></tr>
                    <tr><td style="padding: 8px 0; color: #666;">Amount Received</td><td style="padding: 8px 0;"><strong style="color: #22c55e;">$${stripeAmount.toFixed(2)}</strong></td></tr>
                    ${processingFee > 0 ? `<tr><td style="padding: 8px 0; color: #666;">Processing Fee</td><td style="padding: 8px 0; color: #f59e0b;">-$${processingFee.toFixed(2)}</td></tr>` : ''}
                    <tr><td style="padding: 8px 0; color: #666;">Invoice Total</td><td style="padding: 8px 0;">$${(invoice.total || 0).toFixed(2)}</td></tr>
                    <tr><td style="padding: 8px 0; color: #666;">Payment Method</td><td style="padding: 8px 0;">${paymentType === 'bank_transfer' ? 'Bank Transfer (ACH)' : 'Credit Card'} via Stripe</td></tr>
                    <tr><td style="padding: 8px 0; color: #666;">Project</td><td style="padding: 8px 0;">${invoice.vehicle_description || invoice.project_description || '-'}</td></tr>
                  </table>
                  <p style="margin-top: 30px;">
                    <a href="https://fwg-ops.vercel.app/documents/${documentId}" style="background: linear-gradient(135deg, #d71cd1, #8b5cf6); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">View Invoice</a>
                  </p>
                </div>
              `,
            }),
          }).catch(err => console.error('Payment notification email failed:', err))
        }
      }
    }
  } catch (e) {
    console.error('Error processing payment:', e)
  }

  return <PaymentSuccessClient documentId={documentId} amount={amount} />
}
