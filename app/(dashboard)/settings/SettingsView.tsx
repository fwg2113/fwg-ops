'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'

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

type CallSetting = {
  id: string
  phone: string
  name: string
  enabled: boolean
  ring_order: number
}

type Tab = 'categories' | 'materials' | 'buckets' | 'integrations' | 'calls'

export default function SettingsView({ 
  initialCategories, 
  initialMaterials,
  initialBuckets,
  calendarConnected,
  initialCallSettings
}: { 
  initialCategories: Category[]
  initialMaterials: Material[]
  initialBuckets: Bucket[]
  calendarConnected: boolean
  initialCallSettings: CallSetting[]
}) {
  const [activeTab, setActiveTab] = useState<Tab>('categories')
  const [categories] = useState<Category[]>(initialCategories)
  const [materials] = useState<Material[]>(initialMaterials)
  const [buckets] = useState<Bucket[]>(initialBuckets)
  const [callSettings, setCallSettings] = useState<CallSetting[]>(initialCallSettings)
  const [showAddPhone, setShowAddPhone] = useState(false)
  const [newPhone, setNewPhone] = useState({ name: '', phone: '' })

  const tabs: { key: Tab; label: string }[] = [
    { key: 'categories', label: 'Categories' },
    { key: 'materials', label: 'Materials' },
    { key: 'buckets', label: 'Pipeline Buckets' },
    { key: 'calls', label: 'Call Forwarding' },
    { key: 'integrations', label: 'Integrations' }
  ]

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
    } else if (cleaned.length === 11 && cleaned[0] === '1') {
      return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
    }
    return phone
  }

  const togglePhoneEnabled = async (id: string, enabled: boolean) => {
    const { error } = await supabase
      .from('call_settings')
      .update({ enabled })
      .eq('id', id)
    
    if (error) {
      console.error('Toggle error:', error)
      alert('Failed to update: ' + error.message)
      return
    }
    
    setCallSettings(callSettings.map(c => 
      c.id === id ? { ...c, enabled } : c
    ))
  }

  const addTeamPhone = async () => {
    if (!newPhone.name.trim() || !newPhone.phone.trim()) {
      alert('Please enter both name and phone')
      return
    }
    
    const cleanPhone = newPhone.phone.replace(/\D/g, '')
    if (cleanPhone.length < 10) {
      alert('Please enter a valid phone number')
      return
    }
    
    const phoneFormatted = cleanPhone.length === 10 ? `+1${cleanPhone}` : `+${cleanPhone}`
    
    const { data, error } = await supabase
      .from('call_settings')
      .insert({
        name: newPhone.name.trim(),
        phone: phoneFormatted,
        enabled: true,
        ring_order: callSettings.length + 1
      })
      .select()
      .single()
    
    if (error) {
      alert('Error adding phone: ' + error.message)
      return
    }
    
    setCallSettings([...callSettings, data])
    setNewPhone({ name: '', phone: '' })
    setShowAddPhone(false)
  }

  const removeTeamPhone = async (id: string) => {
    if (!confirm('Remove this phone from call forwarding?')) return
    
    await supabase
      .from('call_settings')
      .delete()
      .eq('id', id)
    
    setCallSettings(callSettings.filter(c => c.id !== id))
  }

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

      {/* Call Forwarding Tab */}
      {activeTab === 'calls' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: '#1d1d1d', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ color: '#f1f5f9', fontSize: '16px', margin: '0 0 4px 0' }}>Team Phone Numbers</h3>
                <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Incoming calls will ring all enabled phones simultaneously</p>
              </div>
              <button 
                onClick={() => setShowAddPhone(true)}
                style={{
                  padding: '8px 16px',
                  background: '#d71cd1',
                  border: 'none',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                + Add Phone
              </button>
            </div>
            <div style={{ padding: '12px' }}>
              {callSettings.length > 0 ? callSettings.map((setting) => (
                <div
                  key={setting.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    background: '#282a30',
                    borderRadius: '8px',
                    marginBottom: '8px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: setting.enabled ? '#d71cd1' : '#64748b',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      fontWeight: 600
                    }}>
                      {setting.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p style={{ color: '#f1f5f9', fontSize: '15px', fontWeight: '500', margin: '0 0 2px 0' }}>
                        {setting.name}
                      </p>
                      <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
                        {formatPhone(setting.phone)}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <label style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      cursor: 'pointer'
                    }}>
                      <span style={{ color: '#64748b', fontSize: '13px' }}>
                        {setting.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                      <div
                        onClick={() => togglePhoneEnabled(setting.id, !setting.enabled)}
                        style={{
                          width: '44px',
                          height: '24px',
                          background: setting.enabled ? '#d71cd1' : '#4b5563',
                          borderRadius: '12px',
                          position: 'relative',
                          cursor: 'pointer',
                          transition: 'background 0.2s'
                        }}
                      >
                        <div style={{
                          width: '18px',
                          height: '18px',
                          background: 'white',
                          borderRadius: '50%',
                          position: 'absolute',
                          top: '3px',
                          left: setting.enabled ? '23px' : '3px',
                          transition: 'left 0.2s'
                        }} />
                      </div>
                    </label>
                    <button
                      onClick={() => removeTeamPhone(setting.id)}
                      style={{
                        padding: '6px 10px',
                        background: 'transparent',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '6px',
                        color: '#ef4444',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )) : (
                <p style={{ color: '#64748b', padding: '20px', textAlign: 'center' }}>No team phones configured</p>
              )}
            </div>
          </div>

          <div style={{ background: '#1d1d1d', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ color: '#f1f5f9', fontSize: '16px', margin: '0 0 12px 0' }}>How Call Forwarding Works</h3>
            <ul style={{ color: '#94a3b8', fontSize: '14px', margin: 0, paddingLeft: '20px', lineHeight: '1.8' }}>
              <li>When someone calls your Twilio number, all enabled phones ring simultaneously</li>
              <li>First person to answer gets the call, others stop ringing</li>
              <li>Your business number shows as the caller ID (save it as "FWG" in your contacts)</li>
              <li>If no one answers within 25 seconds, caller goes to voicemail</li>
              <li>All calls are logged in the dashboard with caller info and duration</li>
            </ul>
          </div>

          {/* Add Phone Modal */}
          {showAddPhone && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}>
              <div style={{
                background: '#1d1d1d',
                borderRadius: '16px',
                width: '400px',
                overflow: 'hidden'
              }}>
                <div style={{ padding: '20px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ color: '#f1f5f9', fontSize: '18px', margin: 0 }}>Add Team Phone</h3>
                  <button onClick={() => setShowAddPhone(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '24px' }}>×</button>
                </div>
                <div style={{ padding: '20px' }}>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Team Member Name</label>
                    <input
                      type="text"
                      value={newPhone.name}
                      onChange={(e) => setNewPhone({ ...newPhone, name: e.target.value })}
                      placeholder="e.g. John Smith"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: '#111111',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        borderRadius: '8px',
                        color: '#f1f5f9',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Phone Number</label>
                    <input
                      type="tel"
                      value={newPhone.phone}
                      onChange={(e) => setNewPhone({ ...newPhone, phone: e.target.value })}
                      placeholder="(240) 555-1234"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: '#111111',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        borderRadius: '8px',
                        color: '#f1f5f9',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                </div>
                <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(148, 163, 184, 0.1)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button onClick={() => setShowAddPhone(false)} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
                  <button onClick={addTeamPhone} style={{ padding: '10px 20px', background: '#d71cd1', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>Add Phone</button>
                </div>
              </div>
            </div>
          )}
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
                background: 'rgba(34, 197, 94, 0.1)',
                color: '#22c55e'
              }}>
                Connected
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
                background: 'rgba(34, 197, 94, 0.1)',
                color: '#22c55e'
              }}>
                Connected
              </span>
            </div>
          </div>

          <div style={{ background: '#1d1d1d', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ color: '#f1f5f9', fontSize: '16px', margin: '0 0 4px 0' }}>Resend Email</h3>
                <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Send quotes and invoices via email</p>
              </div>
              <span style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                background: 'rgba(34, 197, 94, 0.1)',
                color: '#22c55e'
              }}>
                Connected
              </span>
            </div>
          </div>

          <div style={{ background: '#1d1d1d', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ color: '#f1f5f9', fontSize: '16px', margin: '0 0 4px 0' }}>Google Calendar</h3>
                <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Sync appointments with your Google Calendar</p>
              </div>
              {calendarConnected ? (
                <span style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  background: 'rgba(34, 197, 94, 0.1)',
                  color: '#22c55e'
                }}>
                  Connected
                </span>
              ) : (
                <button
                  onClick={() => window.location.href = '/api/calendar/auth'}
                  style={{
                    padding: '8px 16px',
                    background: '#3b82f6',
                    border: 'none',
                    borderRadius: '6px',
                    color: 'white',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Connect Google Calendar
                </button>
              )}
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