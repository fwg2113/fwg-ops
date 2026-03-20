import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'crypto'
import { isAutomationEnabled } from '@/app/lib/automation-settings'
import { syncPaymentToSheet } from '@/app/lib/payment-sheet-sync'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY!
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!
const RESEND_API_KEY = process.env.RESEND_API_KEY

// Stripe signature verification without SDK
function verifyStripeSignature(body: string, signature: string, secret: string): boolean {
  const parts = signature.split(',').reduce<Record<string, string>>((acc, part) => {
    const [key, value] = part.split('=')
    acc[key] = value
    return acc
  }, {})

  const timestamp = parts['t']
  const sig = parts['v1']
  if (!timestamp || !sig) return false

  // Reject events older than 5 minutes
  const age = Math.floor(Date.now() / 1000) - parseInt(timestamp)
  if (age > 300) return false

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex')

  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  } catch {
    return false
  }
}

// Fetch a checkout session from Stripe by payment intent
async function getSessionByPaymentIntent(paymentIntentId: string) {
  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions?payment_intent=${paymentIntentId}&limit=1`,
    { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } }
  )
  const data = await res.json()
  return data.data?.[0] || null
}

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  if (!verifyStripeSignature(body, signature, STRIPE_WEBHOOK_SECRET)) {
    console.error('[stripe-webhook] Signature verification failed')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const event = JSON.parse(body)
  console.log(`[stripe-webhook] Event: ${event.type} (${event.id})`)

  try {
    if (event.type === 'checkout.session.completed') {
      await handleCheckoutCompleted(event.data.object)
    }

    if (event.type === 'payment_intent.succeeded') {
      await handlePaymentIntentSucceeded(event.data.object)
    }
  } catch (err) {
    console.error(`[stripe-webhook] Error handling ${event.type}:`, err)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

/**
 * checkout.session.completed
 *
 * Card payments arrive with payment_status "paid" — record payment + mark invoice paid.
 * ACH payments arrive with payment_status "unpaid" or "processing" — mark invoice as ach_pending.
 */
async function handleCheckoutCompleted(session: any) {
  const documentId = session.metadata?.document_id
  if (!documentId) {
    console.log('[stripe-webhook] No document_id in session metadata — skipping')
    return
  }

  const paymentStatus = session.payment_status // "paid", "unpaid", or "no_payment_required"

  if (paymentStatus === 'paid') {
    // Card payment — record payment and mark invoice paid
    await recordPayment(session, documentId)
  } else {
    // ACH — mark invoice as pending
    console.log(`[stripe-webhook] ACH checkout completed (payment_status: ${paymentStatus}) — marking ach_pending`)

    const { data: doc } = await supabase
      .from('documents')
      .select('status')
      .eq('id', documentId)
      .single()

    // Only update if not already paid (avoid overwriting if payment_intent.succeeded arrived first)
    if (doc && doc.status !== 'paid' && doc.status !== 'partial') {
      await supabase
        .from('documents')
        .update({ status: 'ach_pending' })
        .eq('id', documentId)

      console.log(`[stripe-webhook] Document ${documentId} marked as ach_pending`)
    }
  }
}

/**
 * payment_intent.succeeded
 *
 * Fires when payment actually clears (immediately for card, 3-5 days for ACH).
 * Look up the checkout session to find the document, then record payment.
 */
async function handlePaymentIntentSucceeded(paymentIntent: any) {
  const paymentIntentId = paymentIntent.id

  // Check if payment already recorded (success page may have handled it for card payments)
  const { data: existingPayment } = await supabase
    .from('payments')
    .select('id')
    .eq('processor_txn_id', paymentIntentId)
    .maybeSingle()

  if (existingPayment) {
    console.log(`[stripe-webhook] Payment already recorded for ${paymentIntentId} — skipping`)
    return
  }

  // Find the checkout session that created this payment intent
  const session = await getSessionByPaymentIntent(paymentIntentId)
  if (!session) {
    console.log(`[stripe-webhook] No checkout session found for payment intent ${paymentIntentId}`)
    return
  }

  const documentId = session.metadata?.document_id
  if (!documentId) {
    console.log('[stripe-webhook] No document_id in session metadata — skipping')
    return
  }

  await recordPayment(session, documentId)
}

/**
 * Shared payment recording logic.
 * Creates a payment record — the DB trigger (sync_document_payment_status)
 * automatically updates the document's amount_paid, balance_due, and status.
 */
async function recordPayment(session: any, documentId: string) {
  const paymentIntentId = session.payment_intent

  // Idempotency: if payment already recorded (by another webhook event), skip
  const { data: existingPayment } = await supabase
    .from('payments')
    .select('id')
    .eq('processor_txn_id', paymentIntentId)
    .maybeSingle()

  if (existingPayment) {
    console.log(`[stripe-webhook] Payment already recorded for ${paymentIntentId} — skipping recordPayment`)
    return
  }

  const { data: doc } = await supabase
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .single()

  if (!doc) {
    console.error(`[stripe-webhook] Document ${documentId} not found`)
    return
  }

  // Determine payment type and calculate processing fee
  const stripeAmount = (session.amount_total || 0) / 100
  const paymentType = session.metadata?.payment_type === 'bank_transfer' ? 'bank_transfer' : 'card'

  let baseAmount: number
  let processingFee: number

  if (session.metadata?.base_amount) {
    // Use metadata if available (set by checkout session creation)
    baseAmount = parseFloat(session.metadata.base_amount)
    processingFee = Math.round((stripeAmount - baseAmount) * 100) / 100
  } else if (paymentType === 'card') {
    // Reverse-calculate: stripeAmount = base * 1.029 + 0.30
    baseAmount = Math.round(((stripeAmount - 0.30) / 1.029) * 100) / 100
    processingFee = Math.round((stripeAmount - baseAmount) * 100) / 100
  } else {
    // ACH / bank transfer — no surcharge
    baseAmount = stripeAmount
    processingFee = 0
  }

  // Convert quote to invoice if needed
  if (doc.doc_type === 'quote') {
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
        approved_at: doc.approved_at || new Date().toISOString(),
      })
      .eq('id', documentId)

    console.log(`[stripe-webhook] Converted quote #${doc.doc_number} → invoice #${nextDocNumber}`)
  }

  // Insert payment record — the DB trigger handles updating the document's
  // amount_paid, balance_due, status, and paid_at automatically
  const { data: paymentRecord, error: paymentError } = await supabase
    .from('payments')
    .upsert({
      document_id: documentId,
      amount: stripeAmount,
      processing_fee: processingFee > 0 ? processingFee : 0,
      payment_method: paymentType,
      processor: 'stripe',
      processor_txn_id: paymentIntentId,
      status: 'completed',
      read: false,
      created_at: new Date().toISOString(),
    }, { onConflict: 'processor_txn_id', ignoreDuplicates: true })
    .select()
    .single()

  if (paymentError) {
    console.error('[stripe-webhook] Failed to upsert payment:', paymentError)
    return
  }

  console.log(`[stripe-webhook] Payment recorded: ${paymentRecord.id} ($${stripeAmount} total, $${baseAmount} base, $${processingFee} fee)`)

  // Calculate paid status locally for notifications/automations
  const newAmountPaid = (doc.amount_paid || 0) + baseAmount
  const newBalanceDue = (doc.total || 0) - newAmountPaid
  const isPaidInFull = newBalanceDue <= 0

  // Auto-move to production on payment
  if (baseAmount > 0 && !doc.in_production) {
    const autoProductionEnabled = await isAutomationEnabled('auto_production_on_payment')
    if (autoProductionEnabled) {
      try {
        const taskResponse = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_URL || 'https://fwg-ops.vercel.app'}/api/production/generate-tasks`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invoiceId: documentId }),
          }
        )
        const taskResult = await taskResponse.json()
        if (taskResult.success) {
          await supabase
            .from('documents')
            .update({ in_production: true, bucket: 'IN_PRODUCTION' })
            .eq('id', documentId)
          console.log(`[stripe-webhook] Auto-moved to production (${taskResult.totalTasksCreated} tasks)`)
        }
      } catch (autoError) {
        console.error('[stripe-webhook] Auto-production failed:', autoError)
      }
    }
  }

  // Sync to Google Sheets
  try {
    const sheetResult = await syncPaymentToSheet(paymentRecord.id)
    if (sheetResult.success) {
      console.log(`[stripe-webhook] Synced to Sheets: ${sheetResult.rowsAdded} rows`)
    }
  } catch (sheetError) {
    console.error('[stripe-webhook] Sheet sync failed:', sheetError)
  }

  // Send notification email
  if (RESEND_API_KEY) {
    const subject = isPaidInFull
      ? `Invoice #${doc.doc_number} PAID IN FULL - $${stripeAmount.toFixed(2)}`
      : `Payment Received - Invoice #${doc.doc_number} - $${stripeAmount.toFixed(2)}`
    const statusLine = isPaidInFull
      ? `<p><strong>Invoice #${doc.doc_number}</strong> has been <span style="color: #22c55e;">paid in full</span>.</p>`
      : `<p><strong>Invoice #${doc.doc_number}</strong> received a partial payment. Balance remaining: <strong style="color: #f59e0b;">$${Math.max(0, newBalanceDue).toFixed(2)}</strong></p>`

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
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
              <tr><td style="padding: 8px 0; color: #666;">Customer</td><td style="padding: 8px 0;"><strong>${doc.customer_name}</strong></td></tr>
              <tr><td style="padding: 8px 0; color: #666;">Amount</td><td style="padding: 8px 0;"><strong style="color: #22c55e;">$${stripeAmount.toFixed(2)}</strong></td></tr>
              <tr><td style="padding: 8px 0; color: #666;">Method</td><td style="padding: 8px 0;">${paymentType === 'bank_transfer' ? 'Bank Transfer (ACH)' : 'Credit Card'} via Stripe</td></tr>
              <tr><td style="padding: 8px 0; color: #666;">Source</td><td style="padding: 8px 0;">Webhook</td></tr>
            </table>
            <p style="margin-top: 30px;">
              <a href="https://fwg-ops.vercel.app/documents/${documentId}" style="background: linear-gradient(135deg, #d71cd1, #8b5cf6); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">View Invoice</a>
            </p>
          </div>
        `,
      }),
    }).catch(err => console.error('[stripe-webhook] Notification email failed:', err))
  }
}
