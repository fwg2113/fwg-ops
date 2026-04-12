import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )
  const { error } = await supabase.from('documents').select('id').limit(1)
  return NextResponse.json({
    status: 'alive',
    db: error ? `ERROR: ${error.message}` : 'OK',
    ts: new Date().toISOString(),
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.text()
    const event = JSON.parse(body)

    console.log(`[webhook] ${event.type} received`)

    if (event.type !== 'checkout.session.completed' && event.type !== 'payment_intent.succeeded') {
      return NextResponse.json({ received: true })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )

    let session = event.data.object
    let documentId = session.metadata?.document_id

    // For payment_intent.succeeded, look up the checkout session
    if (event.type === 'payment_intent.succeeded') {
      const piId = session.id
      // Check if already recorded
      const { data: existing } = await supabase
        .from('payments')
        .select('id')
        .eq('processor_txn_id', piId)
        .maybeSingle()
      if (existing) {
        console.log(`[webhook] Already recorded ${piId}`)
        return NextResponse.json({ received: true })
      }
      // Look up session from Stripe
      const res = await fetch(
        `https://api.stripe.com/v1/checkout/sessions?payment_intent=${piId}&limit=1`,
        { headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` } }
      )
      const csData = await res.json()
      session = csData.data?.[0]
      if (!session) {
        console.log(`[webhook] No session for PI ${piId}`)
        return NextResponse.json({ received: true })
      }
      documentId = session.metadata?.document_id
    }

    // For checkout.session.completed with payment not yet paid (ACH)
    if (event.type === 'checkout.session.completed' && session.payment_status !== 'paid') {
      if (documentId) {
        await supabase.from('documents').update({ status: 'ach_pending' }).eq('id', documentId)
        console.log(`[webhook] ACH pending for ${documentId}`)
      }
      return NextResponse.json({ received: true })
    }

    if (!documentId) {
      // Fallback: match by email
      const email = session.customer_email || session.customer_details?.email
      if (email) {
        const stripeAmount = (session.amount_total || 0) / 100
        const baseFromCard = Math.round(((stripeAmount - 0.30) / 1.029) * 100) / 100
        const { data: docs } = await supabase
          .from('documents')
          .select('id, doc_number, total, balance_due')
          .eq('customer_email', email)
          .in('status', ['sent', 'viewed', 'approved', 'partial', 'ach_pending'])
          .gt('total', 0)
          .order('created_at', { ascending: false })
          .limit(5)
        if (docs && docs.length > 0) {
          for (const doc of docs) {
            const total = parseFloat(doc.total)
            const bal = parseFloat(doc.balance_due || doc.total)
            const half = Math.round(total / 2 * 100) / 100
            if (Math.abs(baseFromCard - bal) < 0.10 || Math.abs(baseFromCard - total) < 0.10 ||
                Math.abs(baseFromCard - half) < 0.10 || Math.abs(stripeAmount - bal) < 0.10 ||
                Math.abs(stripeAmount - total) < 0.10 || Math.abs(stripeAmount - half) < 0.10) {
              documentId = doc.id
              console.log(`[webhook] Fallback matched → #${doc.doc_number}`)
              break
            }
          }
          if (!documentId && docs.length === 1) {
            documentId = docs[0].id
            console.log(`[webhook] Single doc fallback → #${docs[0].doc_number}`)
          }
        }
      }
    }

    if (!documentId) {
      console.log(`[webhook] No document found — skipping`)
      return NextResponse.json({ received: true })
    }

    // Check idempotency
    const paymentIntentId = session.payment_intent
    if (paymentIntentId) {
      const { data: existing } = await supabase
        .from('payments')
        .select('id')
        .eq('processor_txn_id', paymentIntentId)
        .maybeSingle()
      if (existing) {
        console.log(`[webhook] Already recorded ${paymentIntentId}`)
        return NextResponse.json({ received: true })
      }
    }

    // Get document
    const { data: doc } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (!doc) {
      console.log(`[webhook] Doc ${documentId} not found`)
      return NextResponse.json({ received: true })
    }

    // Calculate amounts
    const stripeAmount = (session.amount_total || 0) / 100
    const paymentType = session.metadata?.payment_type === 'bank_transfer' ? 'bank_transfer' : 'card'
    let baseAmount: number, processingFee: number
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

    // Convert quote to invoice
    if (doc.doc_type === 'quote') {
      const { data: lastDoc } = await supabase
        .from('documents')
        .select('doc_number')
        .order('doc_number', { ascending: false })
        .limit(1)
        .single()
      const nextNum = (lastDoc?.doc_number || 1000) + 1
      await supabase
        .from('documents')
        .update({ doc_type: 'invoice', doc_number: nextNum, approved_at: doc.approved_at || new Date().toISOString() })
        .eq('id', documentId)
      console.log(`[webhook] Converted quote → invoice #${nextNum}`)
    }

    // INSERT the payment
    const { error: insertError } = await supabase
      .from('payments')
      .insert({
        document_id: documentId,
        amount: stripeAmount,
        processing_fee: processingFee > 0 ? processingFee : 0,
        payment_method: paymentType,
        processor: 'stripe',
        processor_txn_id: paymentIntentId,
        status: 'completed',
        read: false,
        created_at: new Date().toISOString(),
      })

    if (insertError) {
      console.error(`[webhook] INSERT FAILED:`, insertError.message)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    console.log(`[webhook] PAYMENT RECORDED — $${stripeAmount} for doc #${doc.doc_number} (${doc.customer_name})`)

    // Send notification email (fire and forget)
    const RESEND_API_KEY = process.env.RESEND_API_KEY
    if (RESEND_API_KEY) {
      const newPaid = (doc.amount_paid || 0) + baseAmount
      const newBal = (doc.total || 0) - newPaid
      const full = newBal <= 0
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'FWG Ops <quotes@frederickwraps.com>',
          to: ['info@frederickwraps.com'],
          subject: full
            ? `Invoice #${doc.doc_number} PAID IN FULL - $${stripeAmount.toFixed(2)}`
            : `Payment Received - #${doc.doc_number} - $${stripeAmount.toFixed(2)}`,
          html: `<div style="font-family:system-ui;max-width:600px;margin:0 auto">
            <h1 style="color:#22c55e">Payment Received!</h1>
            <p><strong>${doc.customer_name}</strong> — $${stripeAmount.toFixed(2)} via ${paymentType === 'bank_transfer' ? 'ACH' : 'Card'}</p>
            <p>${full ? 'Paid in full' : `Balance: $${Math.max(0, newBal).toFixed(2)}`}</p>
            <p><a href="https://fwg-ops.vercel.app/documents/${documentId}" style="background:linear-gradient(135deg,#d71cd1,#8b5cf6);color:white;padding:12px 24px;text-decoration:none;border-radius:8px">View Invoice</a></p>
          </div>`,
        }),
      }).catch(() => {})
    }

    return NextResponse.json({ received: true, recorded: true })

  } catch (err: any) {
    console.error(`[webhook] ERROR:`, err?.message || err)
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 })
  }
}
