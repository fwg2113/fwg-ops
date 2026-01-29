import { supabase } from '../lib/supabase'
import { redirect } from 'next/navigation'

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

  // Get the Stripe session to find the invoice
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  let invoiceId = null
  let amount = 0

  try {
    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${session_id}`, {
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
      },
    })
    const session = await response.json()
    
    if (session.metadata?.document_id) {
      invoiceId = session.metadata.invoiceId
      amount = (session.amount_total || 0) / 100
      
      // Get current invoice
      const { data: invoice } = await supabase
        .from('documents')
        .select('*')
        .eq('id', invoiceId)
        .single()
      
      if (invoice) {
        const newAmountPaid = (invoice.amount_paid || 0) + amount
        const newBalanceDue = (invoice.total || 0) - newAmountPaid
        const isPaidInFull = newBalanceDue <= 0
        
        // Update invoice
        await supabase
          .from('documents')
          .update({
            status: isPaidInFull ? 'paid' : 'partial',
            amount_paid: newAmountPaid,
            balance_due: Math.max(0, newBalanceDue),
            paid_at: isPaidInFull ? new Date().toISOString() : null
          })
          .eq('id', invoiceId)
        
        // Record payment
        await supabase
          .from('payments')
          .insert({
            document_id: invoiceId,
            amount: amount,
            payment_method: 'card',
            processor: 'stripe',
            processor_txn_id: session.payment_intent,
            status: 'completed',
            created_at: new Date().toISOString()
          })
      }
    }
  } catch (e) {
    console.error('Error processing payment:', e)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{ 
          width: '80px', 
          height: '80px', 
          borderRadius: '50%', 
          background: 'rgba(34, 197, 94, 0.15)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          margin: '0 auto 24px'
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <h1 style={{ margin: '0 0 16px', fontSize: '32px', fontWeight: 700 }}>Payment Successful!</h1>
        <p style={{ margin: '0 0 32px', color: '#94a3b8', fontSize: '18px' }}>
          Thank you for your payment{amount > 0 ? ` of $${amount.toFixed(2)}` : ''}.
        </p>
        <p style={{ margin: '0', color: '#64748b' }}>
          Frederick Wraps Group will be in touch shortly.
        </p>
        <div style={{ marginTop: '40px' }}>
          <a 
            href={invoiceId ? `/view/${invoiceId}` : '/'}
            style={{
              display: 'inline-block',
              padding: '14px 32px',
              background: 'linear-gradient(135deg, #d71cd1 0%, #8b5cf6 100%)',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '8px',
              fontWeight: 600
            }}
          >
            View Invoice
          </a>
        </div>
      </div>
    </div>
  )
}
