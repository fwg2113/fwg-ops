'use client'

import { useState } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (email === 'joe@fwg.com' && password === 'fwg2024') {
      // Set cookie for middleware
      document.cookie = `fwg_auth=${btoa(email)}; path=/; max-age=${60 * 60 * 24 * 30}` // 30 days
      localStorage.setItem('fwg_user', JSON.stringify({ email, name: 'Joe', role: 'super_admin' }))
      window.location.href = '/'
    } else {
      setError('Invalid email or password')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#111111',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{
        background: '#1d1d1d',
        borderRadius: '16px',
        padding: '40px',
        width: '100%',
        maxWidth: '400px'
      }}>
        <h1 style={{ color: '#f1f5f9', fontSize: '24px', marginBottom: '8px', textAlign: 'center' }}>
          FWG Operations
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '32px', textAlign: 'center' }}>
          Sign in to continue
        </p>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ color: '#94a3b8', fontSize: '14px', display: 'block', marginBottom: '8px' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                background: '#282a30',
                border: '1px solid #3f4451',
                borderRadius: '8px',
                color: '#f1f5f9',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              placeholder="you@example.com"
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ color: '#94a3b8', fontSize: '14px', display: 'block', marginBottom: '8px' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                background: '#282a30',
                border: '1px solid #3f4451',
                borderRadius: '8px',
                color: '#f1f5f9',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p style={{ color: '#ef4444', fontSize: '14px', marginBottom: '16px', textAlign: 'center' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            style={{
              width: '100%',
              padding: '12px',
              background: '#d71cd1',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  )
}