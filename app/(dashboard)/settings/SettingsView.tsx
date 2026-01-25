'use client'

import { useState } from 'react'

type Category = {
  id: string
  category_key: string
  label: string
  calendar_color: string
  default_rate: number
  active: boolean
}

type Material = {
  id: string
  material_key: string
  label: string
  dropdown_field: string
  cost_per_unit: number
  markup: number
  active: boolean
}

type Bucket = {
  id: string
  bucket_key: string
  label: string
  color: string
  is_active: boolean
  is_archived: boolean
  sort_order: number
}

type Tab = 'categories' | 'materials' | 'buckets' | 'integrations'

export default function SettingsView({ 
  initialCategories, 
  initialMaterials,
  initialBuckets 
}: { 
  initialCategories: Category[]
  initialMaterials: Material[]
  initialBuckets: Bucket[]
}) {
  const [activeTab, setActiveTab] = useState<Tab>('categories')
  const [categories] = useState<Category[]>(initialCategories)
  const [materials] = useState<Material[]>(initialMaterials)
  const [buckets] = useState<Bucket[]>(initialBuckets)

  const tabs: { key: Tab; label: string }[] = [
    { key: 'categories', label: 'Categories' },
    { key: 'materials', label: 'Materials' },
    { key: 'buckets', label: 'Pipeline Buckets' },
    { key: 'integrations', label: 'Integrations' }
  ]

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ color: '#f1f5f9', fontSize: '28px', marginBottom: '24px' }}>Settings</h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 20px',
              background: activeTab === tab.key ? '#d71cd1' : '#1d1d1d',
              border: 'none',
              borderRadius: '8px',
              color: activeTab === tab.key ? 'white' : '#94a3b8',
              fontSize: '14px',
              fontWeight: activeTab === tab.key ? '600' : '400',
              cursor: 'pointer'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div style={{ background: '#1d1d1d', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ color: '#f1f5f9', fontSize: '16px', margin: 0 }}>Service Categories</h3>
            <button style={{
              padding: '8px 16px',
              background: '#d71cd1',
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer'
            }}>
              + Add Category
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Key</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Label</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Color</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Default Rate</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Active</th>
              </tr>
            </thead>
            <tbody>
              {categories.length > 0 ? categories.map((cat) => (
                <tr key={cat.id} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                  <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '13px', fontFamily: 'monospace' }}>{cat.category_key}</td>
                  <td style={{ padding: '12px 16px', color: '#f1f5f9', fontSize: '14px' }}>{cat.label}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: cat.calendar_color || '#666' }} />
                      <span style={{ color: '#94a3b8', fontSize: '13px' }}>{cat.calendar_color}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#f1f5f9', fontSize: '14px', textAlign: 'right' }}>
                    ${cat.default_rate?.toFixed(2) || '0.00'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      background: cat.active ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: cat.active ? '#22c55e' : '#ef4444'
                    }}>
                      {cat.active ? 'Yes' : 'No'}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    No categories configured
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Materials Tab */}
      {activeTab === 'materials' && (
        <div style={{ background: '#1d1d1d', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ color: '#f1f5f9', fontSize: '16px', margin: 0 }}>Materials</h3>
            <button style={{
              padding: '8px 16px',
              background: '#d71cd1',
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer'
            }}>
              + Add Material
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Key</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Label</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Type</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Cost/Unit</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Markup %</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Active</th>
              </tr>
            </thead>
            <tbody>
              {materials.length > 0 ? materials.map((mat) => (
                <tr key={mat.id} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                  <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '13px', fontFamily: 'monospace' }}>{mat.material_key}</td>
                  <td style={{ padding: '12px 16px', color: '#f1f5f9', fontSize: '14px' }}>{mat.label}</td>
                  <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '14px' }}>{mat.dropdown_field || '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#f1f5f9', fontSize: '14px', textAlign: 'right' }}>
                    ${mat.cost_per_unit?.toFixed(2) || '0.00'}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#f1f5f9', fontSize: '14px', textAlign: 'right' }}>
                    {mat.markup || 0}%
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      background: mat.active ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: mat.active ? '#22c55e' : '#ef4444'
                    }}>
                      {mat.active ? 'Yes' : 'No'}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    No materials configured
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Buckets Tab */}
      {activeTab === 'buckets' && (
        <div style={{ background: '#1d1d1d', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ color: '#f1f5f9', fontSize: '16px', margin: 0 }}>Pipeline Buckets</h3>
            <button style={{
              padding: '8px 16px',
              background: '#d71cd1',
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer'
            }}>
              + Add Bucket
            </button>
          </div>
          <div style={{ padding: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {buckets.length > 0 ? buckets.map((bucket) => (
              <div
                key={bucket.id}
                style={{
                  padding: '16px 20px',
                  background: '#282a30',
                  borderRadius: '8px',
                  borderLeft: `4px solid ${bucket.color || '#666'}`,
                  minWidth: '180px'
                }}
              >
                <p style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: '600', margin: '0 0 4px 0' }}>
                  {bucket.label}
                </p>
                <p style={{ color: '#64748b', fontSize: '12px', fontFamily: 'monospace', margin: 0 }}>
                  {bucket.bucket_key}
                </p>
              </div>
            )) : (
              <p style={{ color: '#64748b', padding: '20px' }}>No buckets configured</p>
            )}
          </div>
        </div>
      )}

      {/* Integrations Tab */}
      {activeTab === 'integrations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: '#1d1d1d', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ color: '#f1f5f9', fontSize: '16px', margin: '0 0 4px 0' }}>Twilio SMS</h3>
                <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Send and receive text messages with customers</p>
              </div>
              <span style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                background: 'rgba(245, 158, 11, 0.1)',
                color: '#f59e0b'
              }}>
                Not Configured
              </span>
            </div>
          </div>

          <div style={{ background: '#1d1d1d', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ color: '#f1f5f9', fontSize: '16px', margin: '0 0 4px 0' }}>Stripe Payments</h3>
                <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Accept credit card payments on invoices</p>
              </div>
              <span style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                background: 'rgba(245, 158, 11, 0.1)',
                color: '#f59e0b'
              }}>
                Not Configured
              </span>
            </div>
          </div>

          <div style={{ background: '#1d1d1d', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ color: '#f1f5f9', fontSize: '16px', margin: '0 0 4px 0' }}>Google Calendar</h3>
                <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Sync appointments with your Google Calendar</p>
              </div>
              <span style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                background: 'rgba(245, 158, 11, 0.1)',
                color: '#f59e0b'
              }}>
                Not Configured
              </span>
            </div>
          </div>

          <div style={{ background: '#1d1d1d', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ color: '#f1f5f9', fontSize: '16px', margin: '0 0 4px 0' }}>Cloudflare R2</h3>
                <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Store customer files and project images</p>
              </div>
              <span style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                background: 'rgba(245, 158, 11, 0.1)',
                color: '#f59e0b'
              }}>
                Not Configured
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}