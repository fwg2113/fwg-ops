import { supabase } from '../lib/supabase'
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
  let documentId: string | null = null
  let amount = 0

  try {
    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${session_id}`, {
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
      },
    })
    const session = await response.json()

    // Bank transfers (ACH) redirect to success URL before payment completes
    if (session.payment_status !== 'paid') {
      const isPending = session.payment_status === 'unpaid' || session.payment_status === 'no_payment_required'

      // Mark invoice as ach_pending so it shows up in the dashboard
      if (isPending && session.metadata?.document_id) {
        const achDocId = session.metadata.document_id
        const { data: achDoc } = await supabase
          .from('documents')
          .select('status')
          .eq('id', achDocId)
          .single()

        if (achDoc && achDoc.status !== 'paid' && achDoc.status !== 'partial') {
          await supabase
            .from('documents')
            .update({ status: 'ach_pending' })
            .eq('id', achDocId)
        }
      }

      return <PaymentSuccessClient documentId={session.metadata?.document_id || null} amount={0} pending={isPending} />
    }

    // Card payment confirmed by Stripe — display success.
    // All payment recording (amount_paid, payment record, email, sheets sync,
    // automations) is handled exclusively by the Stripe webhook to prevent
    // race-condition double-counting.
    if (session.metadata?.document_id) {
      documentId = session.metadata.document_id
      const stripeAmount = (session.amount_total || 0) / 100
      const baseAmount = session.metadata?.base_amount ? parseFloat(session.metadata.base_amount) : stripeAmount
      amount = baseAmount
    }
  } catch (e) {
    console.error('Error processing payment:', e)
  }

  return <PaymentSuccessClient documentId={documentId} amount={amount} />
}
