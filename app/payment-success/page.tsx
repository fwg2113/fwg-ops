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
    
    if (session.metadata?.document_id) {
      documentId = session.metadata.document_id
      amount = (session.amount_total || 0) / 100
      
      const { data: invoice } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single()
      
      if (invoice) {
        const newAmountPaid = (invoice.amount_paid || 0) + amount
        const newBalanceDue = (invoice.total || 0) - newAmountPaid
        const isPaidInFull = newBalanceDue <= 0
        
        await supabase
          .from('documents')
          .update({
            status: isPaidInFull ? 'paid' : 'partial',
            amount_paid: newAmountPaid,
            balance_due: Math.max(0, newBalanceDue),
            paid_at: isPaidInFull ? new Date().toISOString() : null
          })
          .eq('id', documentId)
        
        await supabase
          .from('payments')
          .insert({
            document_id: documentId,
            amount: amount,
            payment_method: 'card',
            processor: 'stripe',
            processor_txn_id: session.payment_intent,
            status: 'completed',
            created_at: new Date().toISOString()
          })

        // Send notification email to FWG
        if (resendApiKey && isPaidInFull) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'FWG Ops <quotes@frederickwraps.com>',
              to: ['info@frederickwraps.com'],
              subject: `Invoice #${invoice.doc_number} PAID - $${amount.toFixed(2)}`,
              html: `
                <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h1 style="color: #22c55e;">Payment Received!</h1>
                  <p><strong>Invoice #${invoice.doc_number}</strong> has been paid in full.</p>
                  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <tr><td style="padding: 8px 0; color: #666;">Customer</td><td style="padding: 8px 0;"><strong>${invoice.customer_name}</strong></td></tr>
                    <tr><td style="padding: 8px 0; color: #666;">Amount</td><td style="padding: 8px 0;"><strong style="color: #22c55e;">$${amount.toFixed(2)}</strong></td></tr>
                    <tr><td style="padding: 8px 0; color: #666;">Project</td><td style="padding: 8px 0;">${invoice.vehicle_description || invoice.project_description || '-'}</td></tr>
                  </table>
                  <p><strong>Next Steps:</strong></p>
                  <ul>
                    <li>Schedule the installation</li>
                    <li>Move to production</li>
                  </ul>
                  <p style="margin-top: 30px;">
                    <a href="https://fwg-ops.vercel.app/documents/${documentId}" style="background: linear-gradient(135deg, #d71cd1, #8b5cf6); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">View Invoice</a>
                  </p>
                </div>
              `,
            }),
          })
        }
      }
    }
  } catch (e) {
    console.error('Error processing payment:', e)
  }

  return <PaymentSuccessClient documentId={documentId} amount={amount} />
}
