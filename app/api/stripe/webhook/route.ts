import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * IMPORTANT: All clients (Supabase, Stripe key, etc.) are created INSIDE
 * the handler functions, never at module level. This prevents cold-start
 * failures on Vercel serverless where env vars may not be ready at import time.
 */

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )
}

function verifyStripeSignature(body: string, signature: string, secret: string): boolean {
  try {
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

    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  } catch {
    return false
  }
}

// Diagnostic endpoint
export async function GET() {
  const supabase = getSupabase()
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

    // Verify signature (log failure but don't block — Stripe retries are safe)
    const signature = request.headers.get('stripe-signature')
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ''
    if (signature && webhookSecret) {
      if (!verifyStripeSignature(body, signature, webhookSecret)) {
        console.error(`[webhook] Signature verification failed`)
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
      }
    }

    const supabase = getSupabase()
    let session = event.data.object
    let documentId = session.metadata?.document_id

    // For payment_intent.succeeded, look up the checkout session
    if (event.type === 'payment_intent.succeeded') {
      const piId = session.id
      const { data: existing } = await supabase
        .from('payments')
        .select('id')
        .eq('processor_txn_id', piId)
        .maybeSingle()
      if (existing) {
        console.log(`[webhook] Already recorded ${piId}`)
        return NextResponse.json({ received: true })
      }
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

    // ACH pending (not yet paid)
    if (event.type === 'checkout.session.completed' && session.payment_status !== 'paid') {
      if (documentId) {
        await supabase.from('documents').update({ status: 'ach_pending' }).eq('id', documentId)
        console.log(`[webhook] ACH pending for ${documentId}`)
      }
      return NextResponse.json({ received: true })
    }

    // Fallback: match by email if no document_id
    if (!documentId) {
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

    // Idempotency check
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

    // Convert quote to invoice if needed
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

    // ========================
    // CORE: Insert payment record
    // DB trigger handles document status (amount_paid, balance_due, status, paid_at)
    // ========================
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

    // ========================
    // POST-PAYMENT EXTRAS (all non-blocking — failures here won't affect the payment)
    // ========================

    const newAmountPaid = (doc.amount_paid || 0) + baseAmount
    const newBalanceDue = (doc.total || 0) - newAmountPaid
    const isPaidInFull = newBalanceDue <= 0

    // 1. Auto-move to production (non-blocking)
    if (baseAmount > 0 && !doc.in_production) {
      try {
        const { data: autoSetting } = await supabase
          .from('automation_settings')
          .select('enabled')
          .eq('automation_key', 'auto_production_on_payment')
          .single()

        if (autoSetting?.enabled) {
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
            console.log(`[webhook] Auto-moved to production (${taskResult.totalTasksCreated} tasks)`)
          }
        }
      } catch (autoError) {
        console.error('[webhook] Auto-production failed (non-blocking):', autoError)
      }
    }

    // 2. Google Sheets sync (non-blocking)
    try {
      const { syncPaymentToSheet } = await import('@/app/lib/payment-sheet-sync')
      // Get the payment ID we just inserted
      const { data: newPayment } = await supabase
        .from('payments')
        .select('id')
        .eq('processor_txn_id', paymentIntentId)
        .single()
      if (newPayment) {
        const sheetResult = await syncPaymentToSheet(newPayment.id)
        if (sheetResult.success) {
          console.log(`[webhook] Synced to Sheets: ${sheetResult.rowsAdded} rows`)
        }
      }
    } catch (sheetError) {
      console.error('[webhook] Sheet sync failed (non-blocking):', sheetError)
    }

    // 3. Notification email (fire and forget)
    const RESEND_API_KEY = process.env.RESEND_API_KEY
    if (RESEND_API_KEY) {
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'FWG Ops <quotes@frederickwraps.com>',
          to: ['info@frederickwraps.com'],
          subject: isPaidInFull
            ? `Invoice #${doc.doc_number} PAID IN FULL - $${stripeAmount.toFixed(2)}`
            : `Payment Received - #${doc.doc_number} - $${stripeAmount.toFixed(2)}`,
          html: `<div style="font-family:system-ui;max-width:600px;margin:0 auto">
            <h1 style="color:#22c55e">Payment Received!</h1>
            <p><strong>${doc.customer_name}</strong> — $${stripeAmount.toFixed(2)} via ${paymentType === 'bank_transfer' ? 'ACH' : 'Card'}</p>
            <p>${isPaidInFull ? 'Paid in full' : `Balance: $${Math.max(0, newBalanceDue).toFixed(2)}`}</p>
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
