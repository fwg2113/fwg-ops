'use client'

import { useState, useEffect } from 'react'

type Signature = {
  id: string
  name: string
  title: string
  email: string
  gmail_alias: string | null
  phone: string
  include_email_in_sig: boolean
  include_address: boolean
  closing: string
  show_in_compose: boolean
  sort_order: number
}

const emptySig: Omit<Signature, 'id'> = {
  name: '',
  title: '',
  email: '',
  gmail_alias: null,
  phone: '',
  include_email_in_sig: false,
  include_address: false,
  closing: 'Best,',
  show_in_compose: true,
  sort_order: 0,
}

// Client-side signature HTML renderer (mirrors lib/signature-template.ts)
const LOGO_URL = 'https://fwg-ops.vercel.app/images/email-signature-badge.svg'
const RED = '#CE0000'
const DARK = '#1a1a1a'
const GRAY = '#666666'
const WEBSITE = 'frederickwraps.com'
const ADDRESS = '4509 Metropolitan Ct Suite A, Frederick, MD 21704'
const PHONE = '240.693.3715'

function renderSignatureHTML(s: Omit<Signature, 'id'>): string {
  const phonePart = `<a href="tel:2406933715" style="color:${DARK};text-decoration:none;">${PHONE}</a>`
  const siteLink = `<a href="https://${WEBSITE}" style="color:${DARK};text-decoration:none;">${WEBSITE}</a>`
  const metaLine = `${phonePart} &nbsp;|&nbsp; ${siteLink}`
  const closing = s.closing || 'Best,'
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:${DARK};font-size:13px;line-height:1.5;">
<div style="margin-bottom:14px;">${closing}</div>
<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
  <tr>
    <td style="padding:0 20px 0 0;vertical-align:middle;">
      <img src="${LOGO_URL}" width="85" alt="Frederick Wraps &amp; Graphics" style="display:block;border:0;width:85px;height:auto;" />
    </td>
    <td style="vertical-align:middle;font-family:Arial,Helvetica,sans-serif;">
      <div style="font-size:22px;font-weight:700;color:${DARK};letter-spacing:-0.3px;line-height:1.2;">${s.name || 'Full Name'}</div>
      <div style="height:2px;background:${RED};width:220px;margin:8px 0;"></div>
      <div style="font-size:14px;font-weight:400;color:${DARK};margin-bottom:8px;">${s.title || 'Title'}</div>
      <div style="font-size:13px;font-weight:600;color:${DARK};margin-bottom:4px;">${metaLine}</div>
      <div style="font-size:12px;color:${GRAY};">${ADDRESS}</div>
    </td>
  </tr>
</table>
</div>`
}

const cardStyle: React.CSSProperties = {
  background: '#1a1a1a',
  border: '1px solid rgba(148,163,184,0.2)',
  borderRadius: '12px',
  padding: '20px',
}

const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#94a3b8',
  textTransform: 'uppercase',
  fontWeight: 600,
  marginBottom: '6px',
  letterSpacing: '0.5px',
  display: 'block',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: '#0d0d0d',
  border: '1px solid rgba(148,163,184,0.3)',
  borderRadius: '8px',
  color: '#f1f5f9',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box',
}

export default function SignaturesView() {
  const [signatures, setSignatures] = useState<Signature[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Signature | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [form, setForm] = useState<Omit<Signature, 'id'>>(emptySig)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/signatures')
    const data = await res.json()
    setSignatures(data.signatures || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openNew = () => {
    setForm(emptySig)
    setEditing(null)
    setIsNew(true)
  }

  const openEdit = (sig: Signature) => {
    setForm({ ...sig })
    setEditing(sig)
    setIsNew(false)
  }

  const close = () => {
    setEditing(null)
    setIsNew(false)
    setForm(emptySig)
  }

  const save = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      alert('Name and email are required')
      return
    }
    setSaving(true)
    try {
      const url = editing ? `/api/signatures/${editing.id}` : '/api/signatures'
      const method = editing ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.error) { alert('Save failed: ' + data.error); return }
      await load()
      close()
    } catch (e: any) {
      alert('Save failed: ' + e.message)
    }
    setSaving(false)
  }

  const remove = async (sig: Signature) => {
    if (!confirm(`Delete signature for ${sig.name}?`)) return
    await fetch(`/api/signatures/${sig.id}`, { method: 'DELETE' })
    load()
  }

  const showEditor = isNew || editing !== null

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: '#f1f5f9', fontSize: '24px', fontWeight: 700, margin: 0 }}>Email Signatures</h1>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: '4px 0 0 0' }}>
            Create signatures here, then pick them when writing emails in the inbox.
          </p>
        </div>
        <button onClick={openNew} style={{ padding: '10px 20px', background: '#d71cd1', border: 'none', borderRadius: '10px', color: 'white', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
          + New Signature
        </button>
      </div>

      {showEditor ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Form */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: 600, margin: 0 }}>
                {editing ? 'Edit Signature' : 'New Signature'}
              </h3>
              <button onClick={close} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Full Name *</label>
                <input style={inputStyle} value={form.name} onChange={e => {
                  const newName = e.target.value
                  // Auto-fill email from first name if email hasn't been manually set
                  const firstName = newName.trim().split(/\s+/)[0] || ''
                  const prevFirstName = form.name.trim().split(/\s+/)[0] || ''
                  const prevAutoEmail = prevFirstName ? `${prevFirstName.toLowerCase()}@frederickwraps.com` : ''
                  const shouldAutoFillEmail = !form.email || form.email === prevAutoEmail
                  setForm({
                    ...form,
                    name: newName,
                    email: shouldAutoFillEmail && firstName ? `${firstName.toLowerCase()}@frederickwraps.com` : form.email,
                  })
                }} placeholder="Joey Volpe" />
              </div>
              <div>
                <label style={labelStyle}>Title *</label>
                <input style={inputStyle} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Operations Manager" />
              </div>
              <div>
                <label style={labelStyle}>Email *</label>
                <input style={inputStyle} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="joey@frederickwraps.com" />
                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>Auto-fills from first name. Edit if different.</div>
              </div>
              <div>
                <label style={labelStyle}>Closing line</label>
                <input style={inputStyle} value={form.closing} onChange={e => setForm({ ...form, closing: e.target.value })} placeholder="Best," />
              </div>

            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={save} disabled={saving} style={{ padding: '10px 20px', background: '#d71cd1', border: 'none', borderRadius: '10px', color: 'white', fontWeight: 600, fontSize: '13px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={close} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid rgba(148,163,184,0.3)', borderRadius: '10px', color: '#94a3b8', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>

          {/* Live preview */}
          <div style={cardStyle}>
            <h3 style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: 600, margin: '0 0 16px 0' }}>Live Preview</h3>
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px' }} dangerouslySetInnerHTML={{ __html: renderSignatureHTML(form) }} />
            <p style={{ color: '#94a3b8', fontSize: '11px', marginTop: '12px', marginBottom: 0 }}>
              This is exactly how the signature will look in Gmail and most email clients.
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {loading ? (
            <div style={{ color: '#94a3b8', textAlign: 'center', padding: '40px' }}>Loading...</div>
          ) : signatures.length === 0 ? (
            <div style={cardStyle}>
              <p style={{ color: '#94a3b8', textAlign: 'center', margin: 0 }}>No signatures yet. Click "+ New Signature" to get started.</p>
            </div>
          ) : signatures.map(sig => (
            <div key={sig.id} style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px' }}>
                <div style={{ flex: 1, background: 'white', padding: '16px', borderRadius: '8px' }} dangerouslySetInnerHTML={{ __html: renderSignatureHTML(sig) }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
                  <button onClick={() => openEdit(sig)} style={{ padding: '8px 16px', background: '#d71cd1', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}>
                    Edit
                  </button>
                  <button onClick={() => remove(sig)} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #ef4444', borderRadius: '8px', color: '#ef4444', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}>
                    Delete
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(148,163,184,0.15)', fontSize: '11px', color: '#94a3b8' }}>
                <span>{sig.email}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: '32px', padding: '16px', background: 'rgba(215,28,209,0.08)', border: '1px solid rgba(215,28,209,0.3)', borderRadius: '10px' }}>
        <div style={{ color: '#f1f5f9', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>How it works</div>
        <p style={{ color: '#cbd5e1', fontSize: '12px', lineHeight: '1.6', margin: 0 }}>
          Signatures you create here appear as a picker when composing or replying to emails in the FWG-OPS inbox. Pick a signature and it's added to your email on send.
        </p>
      </div>
    </div>
  )
}
