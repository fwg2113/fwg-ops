import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || ''
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || ''

function verifyStripeSignature(body: string, signature: string, secret: string): boolean {
  const parts = signature.split(',').reduce<Record<string, string>>((acc, part) => {
    const [key, value] = part.split('=')
    acc[key] = value
    return acc
  }, {})

  const timestamp = parts['t']
  const sig = parts['v1']
  if (!timestamp || !sig) return false

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

// Diagnostic endpoint — also tests Supabase write
export async function GET() {
  // Test if supabase client can actually read
  const { data, error } = await supabase
    .from('documents')
    .select('id')
    .limit(1)

  return NextResponse.json({
    status: 'alive',
    webhook_secret: STRIPE_WEBHOOK_SECRET ? STRIPE_WEBHOOK_SECRET.substring(0, 8) + '...' : 'MISSING',
    supabase_read: error ? `FAILED: ${error.message}` : `OK (${data?.length} rows)`,
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING',
    service_role_prefix: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 10) || 'MISSING',
    timestamp: new Date().toISOString(),
  })
}

export async function POST(request: Request) {
  console.log('[stripe-webhook] === POST START ===')

  try {
    const body = await request.text()
    console.log(`[stripe-webhook] Body length: ${body.length}`)

    const signature = request.headers.get('stripe-signature')
    if (!signature) {
      console.log('[stripe-webhook] No signature')
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    if (!verifyStripeSignature(body, signature, STRIPE_WEBHOOK_SECRET)) {
      console.log('[stripe-webhook] Bad signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const event = JSON.parse(body)
    console.log(`[stripe-webhook] Event: ${event.type} (${event.id})`)

    // Only handle checkout.session.completed and payment_intent.succeeded
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const documentId = session.metadata?.document_id

      if (!documentId) {
        // Fallback: try to find by email
        const email = session.customer_email
        if (email) {
          console.log(`[stripe-webhook] No document_id, trying email: ${email}`)
          const { data: docs } = await supabase
            .from('documents')
            .select('id, doc_number, total, balance_due, status')
            .eq('customer_email', email)
            .in('status', ['sent', 'viewed', 'approved', 'partial', 'ach_pending'])
            .gt('total', 0)
            .order('created_at', { ascending: false })
            .limit(5)

          if (!docs || docs.length === 0) {
            console.log(`[stripe-webhook] No matching docs for ${email} — skipping`)
            return NextResponse.json({ received: true, skipped: 'no_document' })
          }

          // Try to match by amount
          const stripeAmount = (session.amount_total || 0) / 100
          const baseFromCard = Math.round(((stripeAmount - 0.30) / 1.029) * 100) / 100
          let matchedDoc = null
          for (const doc of docs) {
            const total = parseFloat(doc.total)
            const balanceDue = parseFloat(doc.balance_due || doc.total)
            const halfTotal = Math.round(total / 2 * 100) / 100
            if (
              Math.abs(baseFromCard - balanceDue) < 0.10 ||
              Math.abs(baseFromCard - total) < 0.10 ||
              Math.abs(baseFromCard - halfTotal) < 0.10 ||
              Math.abs(stripeAmount - balanceDue) < 0.10 ||
              Math.abs(stripeAmount - total) < 0.10 ||
              Math.abs(stripeAmount - halfTotal) < 0.10
            ) {
              matchedDoc = doc
              break
            }
          }
          if (!matchedDoc && docs.length === 1) matchedDoc = docs[0]

          if (matchedDoc) {
            console.log(`[stripe-webhook] Fallback matched → Doc #${matchedDoc.doc_number}`)
            await recordPaymentSimple(session, matchedDoc.id)
          } else {
            console.log(`[stripe-webhook] No amount match for ${email} — skipping`)
          }
        } else {
          console.log('[stripe-webhook] No document_id and no email — skipping')
        }
        return NextResponse.json({ received: true })
      }

      if (session.payment_status === 'paid') {
        console.log(`[stripe-webhook] Recording payment for doc ${documentId}`)
        await recordPaymentSimple(session, documentId)
      } else {
        console.log(`[stripe-webhook] ACH pending for doc ${documentId}`)
        await supabase
          .from('documents')
          .update({ status: 'ach_pending' })
          .eq('id', documentId)
      }
    }

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object
      // Check if already recorded
      const { data: existing } = await supabase
        .from('payments')
        .select('id')
        .eq('processor_txn_id', pi.id)
        .maybeSingle()

      if (!existing) {
        // Look up checkout session
        const res = await fetch(
          `https://api.stripe.com/v1/checkout/sessions?payment_intent=${pi.id}&limit=1`,
          { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } }
        )
        const data = await res.json()
        const session = data.data?.[0]
        if (session?.metadata?.document_id) {
          console.log(`[stripe-webhook] PI succeeded, recording for doc ${session.metadata.document_id}`)
          await recordPaymentSimple(session, session.metadata.document_id)
        } else {
          console.log(`[stripe-webhook] PI succeeded but no document_id — skipping`)
        }
      } else {
        console.log(`[stripe-webhook] PI ${pi.id} already recorded — skipping`)
      }
    }

    console.log('[stripe-webhook] === DONE 200 ===')
    return NextResponse.json({ received: true })

  } catch (err: any) {
    console.error('[stripe-webhook] CRASH:', err?.message || err)
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 })
  }
}

async function recordPaymentSimple(session: any, documentId: string) {
  console.log(`[stripe-webhook] recordPaymentSimple called — doc: ${documentId}, pi: ${session.payment_intent}`)
  const paymentIntentId = session.payment_intent

  // Idempotency check
  const { data: existing, error: idempError } = await supabase
    .from('payments')
    .select('id')
    .eq('processor_txn_id', paymentIntentId)
    .maybeSingle()

  console.log(`[stripe-webhook] Idempotency check — existing: ${existing?.id || 'none'}, error: ${idempError?.message || 'none'}`)

  if (existing) {
    console.log(`[stripe-webhook] Already recorded ${paymentIntentId}`)
    return
  }

  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .single()

  console.log(`[stripe-webhook] Doc fetch — found: ${!!doc}, error: ${docError?.message || 'none'}, doc_number: ${doc?.doc_number || 'N/A'}`)

  if (!doc) {
    console.error(`[stripe-webhook] Doc ${documentId} not found — error: ${docError?.message}`)
    return
  }

  const stripeAmount = (session.amount_total || 0) / 100
  const paymentType = session.metadata?.payment_type === 'bank_transfer' ? 'bank_transfer' : 'card'

  let baseAmount: number
  let processingFee: number

  if (session.metadata?.base_amount) {
    baseAmount = parseFloat(session.metadata.base_amount)
    processingFee = Math.round((stripeAmount - baseAmount) * 100) / 100
  } else if (paymentType === 'card') {
    baseAmount = Math.round(((stripeAmount - 0.30) / 1.029) * 100) / 100
    processingFee = Math.round((stripeAmount - baseAmount) * 100) / 100
  } else {
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
    console.log(`[stripe-webhook] Converted quote → invoice #${nextDocNumber}`)
  }

  // Insert payment — DB trigger handles document status
  const { data: payment, error } = await supabase
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

  if (error) {
    console.error(`[stripe-webhook] Payment insert failed:`, error)
    return
  }

  console.log(`[stripe-webhook] Payment recorded: $${stripeAmount} for doc #${doc.doc_number}`)

  // Send notification email (non-blocking, won't crash if it fails)
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  if (RESEND_API_KEY) {
    const newAmountPaid = (doc.amount_paid || 0) + baseAmount
    const newBalanceDue = (doc.total || 0) - newAmountPaid
    const isPaidInFull = newBalanceDue <= 0

    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'FWG Ops <quotes@frederickwraps.com>',
        to: ['info@frederickwraps.com'],
        subject: isPaidInFull
          ? `Invoice #${doc.doc_number} PAID IN FULL - $${stripeAmount.toFixed(2)}`
          : `Payment Received - Invoice #${doc.doc_number} - $${stripeAmount.toFixed(2)}`,
        html: `<div style="font-family: system-ui; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #22c55e;">Payment Received!</h1>
          <p><strong>${doc.customer_name}</strong> — $${stripeAmount.toFixed(2)} via ${paymentType === 'bank_transfer' ? 'ACH' : 'Card'}</p>
          <p>${isPaidInFull ? 'Paid in full' : `Balance remaining: $${Math.max(0, newBalanceDue).toFixed(2)}`}</p>
          <p><a href="https://fwg-ops.vercel.app/documents/${documentId}" style="background: linear-gradient(135deg, #d71cd1, #8b5cf6); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">View Invoice</a></p>
        </div>`,
      }),
    }).catch(err => console.error('[stripe-webhook] Email failed:', err))
  }
}
