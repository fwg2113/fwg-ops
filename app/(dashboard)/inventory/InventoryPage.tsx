'use client'

import { useState } from 'react'
import ModalBackdrop from '../../components/ModalBackdrop'

interface Vendor {
  id: string
  name: string
  ordering_email: string | null
  website: string | null
  brand_color: string
  phone: string | null
  account_number: string | null
  notes: string | null
  active: boolean
  created_at: string
  updated_at: string
}

const TABS = [
  { key: 'inventory', label: 'Inventory' },
  { key: 'vendors', label: 'Vendors' },
] as const

type TabKey = typeof TABS[number]['key']

const EMPTY_VENDOR: Partial<Vendor> = {
  name: '',
  ordering_email: '',
  website: '',
  brand_color: '#6b7280',
  phone: '',
  account_number: '',
  notes: '',
  active: true,
}

const COLOR_PRESETS = [
  '#dc2626', '#ea580c', '#d97706', '#16a34a', '#0d9488',
  '#2563eb', '#7c3aed', '#c026d3', '#e11d48', '#6b7280',
]

export default function InventoryPage({
  initialVendors,
}: {
  initialVendors: Vendor[]
}) {
  const [activeTab, setActiveTab] = useState<TabKey>('vendors')
  const [vendors, setVendors] = useState<Vendor[]>(initialVendors)
  const [editingVendor, setEditingVendor] = useState<Partial<Vendor> | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSaveVendor = async () => {
    if (!editingVendor?.name) return
    setSaving(true)
    setError(null)
    try {
      const method = isCreating ? 'POST' : 'PUT'
      const res = await fetch('/api/vendors', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingVendor),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      if (isCreating) {
        setVendors((prev) => [...prev, data])
      } else {
        setVendors((prev) => prev.map((v) => (v.id === data.id ? data : v)))
      }
      setEditingVendor(null)
      setIsCreating(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteVendor = async (id: string) => {
    if (!confirm('Delete this vendor? Any material links to this vendor will also be removed.')) return
    try {
      const res = await fetch(`/api/vendors?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setVendors((prev) => prev.filter((v) => v.id !== id))
    } catch {
      setError('Failed to delete vendor')
    }
  }

  const updateField = (field: string, value: unknown) => {
    setEditingVendor((prev) => (prev ? { ...prev, [field]: value } : prev))
  }

  const cardBg = '#1d1d1d'
  const borderColor = 'rgba(148, 163, 184, 0.1)'
  const textPrimary = '#f1f5f9'
  const textSecondary = '#94a3b8'
  const textMuted = '#64748b'
  const accentGradient = 'linear-gradient(90deg, #22d3ee, #a855f7, #ec4899)'

  return (
    <div style={{ padding: '24px', maxWidth: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: textPrimary, margin: 0 }}>
          Inventory{' '}
          <span style={{ background: accentGradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Tracker
          </span>
        </h1>
        <p style={{ color: textSecondary, margin: '4px 0 0', fontSize: '14px' }}>
          Manage inventory, vendors, and reorder alerts
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '4px',
        marginBottom: '20px',
        background: '#111111',
        borderRadius: '10px',
        padding: '4px',
        border: `1px solid ${borderColor}`,
        maxWidth: '400px',
      }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1,
                padding: '10px 16px',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                transition: 'all 0.15s',
                background: isActive ? cardBg : 'transparent',
                color: isActive ? textPrimary : textMuted,
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Inventory Tab */}
      {activeTab === 'inventory' && (
        <div style={{
          padding: '40px',
          background: cardBg,
          borderRadius: '12px',
          border: `1px solid ${borderColor}`,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📦</div>
          <h2 style={{ color: textPrimary, fontSize: '20px', margin: '0 0 8px' }}>Coming Soon</h2>
          <p style={{ color: textMuted, fontSize: '14px', margin: 0 }}>
            Roll inventory tracking with thickness-based remaining calculations, reorder alerts, and multi-roll support.
          </p>
        </div>
      )}

      {/* Vendors Tab */}
      {activeTab === 'vendors' && (
        <>
          {/* Add Vendor Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button
              onClick={() => {
                setEditingVendor({ ...EMPTY_VENDOR })
                setIsCreating(true)
              }}
              style={{
                padding: '10px 20px',
                background: accentGradient,
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              + Add Vendor
            </button>
          </div>

          {error && (
            <div style={{
              padding: '10px 14px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '8px',
              color: '#ef4444',
              fontSize: '13px',
              marginBottom: '16px',
            }}>
              {error}
            </div>
          )}

          {/* Vendor Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
            {vendors.map((vendor) => (
              <div
                key={vendor.id}
                onClick={() => {
                  setEditingVendor({ ...vendor })
                  setIsCreating(false)
                }}
                style={{
                  background: cardBg,
                  borderRadius: '12px',
                  border: `1px solid ${borderColor}`,
                  padding: '20px',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(148,163,184,0.25)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = borderColor }}
              >
                {/* Color accent bar */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: vendor.brand_color,
                }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: vendor.brand_color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    fontWeight: 700,
                    color: '#fff',
                    flexShrink: 0,
                  }}>
                    {vendor.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: textPrimary }}>{vendor.name}</div>
                    {vendor.ordering_email && (
                      <div style={{ fontSize: '12px', color: textMuted }}>{vendor.ordering_email}</div>
                    )}
                  </div>
                  {!vendor.active && (
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      background: 'rgba(239,68,68,0.1)',
                      color: '#ef4444',
                    }}>
                      Inactive
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  {vendor.phone && (
                    <div style={{ fontSize: '12px', color: textSecondary }}>
                      <span style={{ color: textMuted }}>Phone:</span> {vendor.phone}
                    </div>
                  )}
                  {vendor.account_number && (
                    <div style={{ fontSize: '12px', color: textSecondary }}>
                      <span style={{ color: textMuted }}>Acct:</span> {vendor.account_number}
                    </div>
                  )}
                  {vendor.website && (
                    <div style={{ fontSize: '12px', color: textSecondary }}>
                      <span style={{ color: textMuted }}>Web:</span> {vendor.website}
                    </div>
                  )}
                </div>

                {vendor.notes && (
                  <div style={{ fontSize: '12px', color: textMuted, marginTop: '8px', fontStyle: 'italic' }}>
                    {vendor.notes}
                  </div>
                )}
              </div>
            ))}

            {vendors.length === 0 && (
              <div style={{
                padding: '40px',
                background: cardBg,
                borderRadius: '12px',
                border: `1px solid ${borderColor}`,
                textAlign: 'center',
                gridColumn: '1 / -1',
              }}>
                <p style={{ color: textMuted, fontSize: '14px', margin: 0 }}>
                  No vendors yet. Click &quot;+ Add Vendor&quot; to get started.
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Vendor Edit/Create Modal */}
      {editingVendor && (
        <ModalBackdrop onClose={() => { setEditingVendor(null); setIsCreating(false) }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#1a1a1a',
              borderRadius: '16px',
              border: `1px solid ${borderColor}`,
              width: '540px',
              maxHeight: '85vh',
              overflow: 'auto',
              padding: '28px',
            }}
          >
            <h2 style={{ color: textPrimary, fontSize: '20px', fontWeight: 700, margin: '0 0 20px' }}>
              {isCreating ? 'Add Vendor' : 'Edit Vendor'}
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              {/* Name */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Vendor Name *</label>
                <input
                  style={inputStyle}
                  value={editingVendor.name || ''}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="e.g., Grimco"
                />
              </div>

              {/* Ordering Email */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Ordering Email</label>
                <input
                  style={inputStyle}
                  type="email"
                  value={editingVendor.ordering_email || ''}
                  onChange={(e) => updateField('ordering_email', e.target.value)}
                  placeholder="orders@vendor.com"
                />
              </div>

              {/* Phone */}
              <div>
                <label style={labelStyle}>Phone</label>
                <input
                  style={inputStyle}
                  value={editingVendor.phone || ''}
                  onChange={(e) => updateField('phone', e.target.value)}
                />
              </div>

              {/* Account Number */}
              <div>
                <label style={labelStyle}>Account Number</label>
                <input
                  style={inputStyle}
                  value={editingVendor.account_number || ''}
                  onChange={(e) => updateField('account_number', e.target.value)}
                />
              </div>

              {/* Website */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Website</label>
                <input
                  style={inputStyle}
                  value={editingVendor.website || ''}
                  onChange={(e) => updateField('website', e.target.value)}
                  placeholder="https://www.vendor.com"
                />
              </div>

              {/* Brand Color */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Brand Color</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      onClick={() => updateField('brand_color', c)}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: c,
                        border: editingVendor.brand_color === c ? '2px solid #fff' : '2px solid transparent',
                        cursor: 'pointer',
                        transition: 'border-color 0.1s',
                      }}
                    />
                  ))}
                  <input
                    type="color"
                    value={editingVendor.brand_color || '#6b7280'}
                    onChange={(e) => updateField('brand_color', e.target.value)}
                    style={{ width: '32px', height: '32px', border: 'none', borderRadius: '8px', cursor: 'pointer', background: 'transparent' }}
                    title="Custom color"
                  />
                </div>
              </div>

              {/* Active */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={editingVendor.active ?? true}
                  onChange={(e) => updateField('active', e.target.checked)}
                  style={{ width: '16px', height: '16px' }}
                />
                <label style={{ color: textSecondary, fontSize: '13px' }}>Active</label>
              </div>

              {/* Notes */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Notes</label>
                <textarea
                  style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }}
                  value={editingVendor.notes || ''}
                  onChange={(e) => updateField('notes', e.target.value)}
                />
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'space-between' }}>
              <div>
                {!isCreating && (
                  <button
                    onClick={() => {
                      if (editingVendor.id) handleDeleteVendor(editingVendor.id)
                      setEditingVendor(null)
                      setIsCreating(false)
                    }}
                    style={{
                      padding: '10px 16px',
                      background: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.3)',
                      borderRadius: '8px',
                      color: '#ef4444',
                      cursor: 'pointer',
                      fontSize: '13px',
                    }}
                  >
                    Delete Vendor
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => { setEditingVendor(null); setIsCreating(false) }}
                  style={{
                    padding: '10px 20px',
                    background: 'rgba(255,255,255,0.05)',
                    border: `1px solid ${borderColor}`,
                    borderRadius: '8px',
                    color: textSecondary,
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveVendor}
                  disabled={saving || !editingVendor.name}
                  style={{
                    padding: '10px 24px',
                    background: saving ? textMuted : accentGradient,
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                  }}
                >
                  {saving ? 'Saving...' : isCreating ? 'Create' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </ModalBackdrop>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: '#94a3b8',
  marginBottom: '4px',
  textTransform: 'uppercase',
  letterSpacing: '0.3px',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  background: '#111111',
  border: '1px solid rgba(148, 163, 184, 0.15)',
  borderRadius: '8px',
  color: '#f1f5f9',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
}
