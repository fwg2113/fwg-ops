'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PaymentSuccessClient({ 
  documentId, 
  amount 
}: { 
  documentId: string | null
  amount: number 
}) {
  const router = useRouter()
  const [countdown, setCountdown] = useState(3)

  useEffect(() => {
    if (!documentId) return
    
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          router.push(`/view/${documentId}`)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [documentId, router])

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
        {documentId && (
          <p style={{ margin: '24px 0 0', color: '#64748b', fontSize: '14px' }}>
            Redirecting to your invoice in {countdown}...
          </p>
        )}
        <div style={{ marginTop: '24px' }}>
          <a 
            href={documentId ? `/view/${documentId}` : '/'}
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
            View Invoice Now
          </a>
        </div>
      </div>
    </div>
  )
}
