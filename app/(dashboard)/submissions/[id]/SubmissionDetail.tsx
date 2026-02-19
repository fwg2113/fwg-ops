'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type VehicleEntry = {
  type: string
  type_label: string
  year?: string
  make?: string
  model?: string
  color?: string
  color_other?: string
  browsing?: boolean
  conditionals?: Record<string, string>
  is_other?: boolean
  other_desc?: string
  photo_urls?: string[]
}

type Submission = {
  id: string
  submission_number?: number
  status: string
  source: string
  customer_name: string
  customer_email: string
  customer_phone: string
  preferred_contact: string
  company_name: string
  website: string
  vehicle_category: string
  vehicle_year: string
  vehicle_make: string
  vehicle_model: string
  vehicle_count: number
  project_type: string
  design_scenario: string
  price_range_min: number
  price_range_max: number
  design_fee_min: number
  design_fee_max: number
  vision_description: string
  timeline: string
  budget_range: string
  notes: string
  assigned_to: string
  created_at: string
  last_contact_at: string
  next_followup_at: string
  converted_to_quote_id: number | null
  // New form fields
  vehicles?: VehicleEntry[]
  coverage_type?: string
  artwork_status?: string
  ai_acknowledged?: boolean
  logo_urls?: string[]
  additional_info?: string
  budget?: string
  source_page?: string
  // Form type
  form_type?: string
  // Styling-form-specific fields
  services?: string[]
  service_details?: Record<string, any>
  reference_image_urls?: string[]
}

// Icons as components
const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
)

const TruckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="3" width="15" height="13" rx="2" ry="2" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
)

const DollarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
)

const ChartIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
  </svg>
)

const FileTextIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
  </svg>
)

const MessageIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)

const PhoneIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
)

const MailIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
  </svg>
)

const ArrowLeftIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
  </svg>
)

const SaveIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
  </svg>
)

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
)

// Format helpers
const VEHICLE_LABELS: Record<string, string> = {
  'SEDAN_COUPE': 'Sedan / Coupe',
  'SMALL_SUV': 'Small SUV / Crossover',
  'LARGE_SUV': 'Large SUV',
  'PICKUP_STD': 'Pickup Truck (Standard)',
  'PICKUP_HD': 'Pickup Truck (HD/Long Bed)',
  'CARGO_VAN_SM': 'Cargo Van (Small)',
  'CARGO_VAN_LG': 'Cargo Van (Full Size)',
  'BOX_TRUCK_SM': 'Box Truck (10-16ft)',
  'BOX_TRUCK_LG': 'Box Truck (20-26ft)',
  'TRAILER': 'Trailer (Enclosed)'
}

const PROJECT_LABELS: Record<string, string> = {
  'FULL_WRAP': 'Full Wrap',
  'PARTIAL_WRAP': 'Partial Wrap',
  'LETTERING': 'Lettering & Graphics'
}

const DESIGN_LABELS: Record<string, string> = {
  'FLEET_MATCH': 'Fleet Match',
  'PRINT_READY': 'Print-Ready Artwork',
  'LOGO_VISION': 'Logo + Vision',
  'LOGO_ONLY': 'Logo Only',
  'FROM_SCRATCH': 'Start from Scratch'
}

// New form field labels
const COVERAGE_LABELS: Record<string, string> = {
  'full_wrap': 'Full Coverage Wrap',
  'partial_wrap': 'Partial Wrap',
  'graphics_lettering': 'Graphics & Lettering',
  'not_sure': 'Not Sure Yet'
}

const ARTWORK_LABELS: Record<string, string> = {
  'fleet_match': 'Fleet Match',
  'print_ready': 'Print-Ready Artwork',
  'logo_vision': 'Logo + Vision',
  'logo_only': 'Logo Only',
  'from_scratch': 'Start from Scratch',
  'ai_mockup': 'AI-Generated Mockup'
}

const TIMELINE_LABELS: Record<string, string> = {
  'asap': 'ASAP',
  '30_days': 'Within 30 days',
  '30_60_days': '30\u201360 days',
  '60_90_days': '60\u201390+ days',
  'planning': 'Just planning'
}

const BUDGET_LABELS: Record<string, string> = {
  'under_1000': 'Under $1,000',
  '1000_2500': '$1,000 \u2013 $2,500',
  '2500_5000': '$2,500 \u2013 $5,000',
  '5000_10000': '$5,000 \u2013 $10,000',
  '10000_plus': '$10,000+',
  'not_sure': 'Not sure yet'
}

const SERVICE_LABELS: Record<string, string> = {
  'printed_wraps': 'Printed Wraps',
  'full_color_change': 'Full Color Change',
  'styling_graphics': 'Styling Graphics',
  'tuxedo_roof': 'Tuxedo / Roof Wraps',
  'chrome_delete': 'Chrome Delete',
  'custom_taillights': 'Custom Taillights',
  'racing_stripes': 'Racing Stripes',
  'custom_decals': 'Custom Decals',
  'back_window_flags': 'Back Window Flags',
  'other': 'Other',
}

const FORM_TYPE_LABELS: Record<string, string> = {
  'commercial_wrap': 'Commercial Wrap',
  'automotive_styling': 'Automotive Styling',
}

const STATUS_OPTIONS = ['new', 'contacted', 'in_progress', 'quoted', 'converted', 'won', 'lost', 'archived']

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  'new': { bg: 'rgba(234, 179, 8, 0.15)', color: '#eab308' },
  'contacted': { bg: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4' },
  'in_progress': { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' },
  'quoted': { bg: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' },
  'converted': { bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' },
  'won': { bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' },
  'lost': { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' },
  'archived': { bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' }
}

function formatPhone(phone: string) {
  if (!phone) return '-'
  const digits = phone.replace(/\D/g, '').slice(-10)
  if (digits.length === 10) {
    return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
  }
  return phone
}

function formatDate(dateString: string) {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true
  })
}

function formatStatusLabel(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// Styles
const sectionStyle: React.CSSProperties = {
  background: '#111111',
  border: '1px solid rgba(148, 163, 184, 0.1)',
  borderRadius: '10px',
  padding: '16px'
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: '12px',
  display: 'flex',
  alignItems: 'center',
  gap: '8px'
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  padding: '8px 0',
  borderBottom: '1px solid rgba(148, 163, 184, 0.08)'
}

const lastRowStyle: React.CSSProperties = {
  ...rowStyle,
  borderBottom: 'none',
  paddingBottom: 0
}

const labelStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#94a3b8',
  flexShrink: 0
}

const valueStyle: React.CSSProperties = {
  fontSize: '14px',
  color: '#f1f5f9',
  textAlign: 'right',
  wordBreak: 'break-word'
}

const linkStyle: React.CSSProperties = {
  color: '#d71cd1',
  textDecoration: 'none',
  cursor: 'pointer'
}

const btnBaseStyle: React.CSSProperties = {
  padding: '10px 20px',
  borderRadius: '8px',
  border: 'none',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  transition: 'all 0.15s ease'
}

export default function SubmissionDetail({ submission }: { submission: Submission }) {
  const router = useRouter()
  const [status, setStatus] = useState(submission.status || 'new')
  const [notes, setNotes] = useState(submission.notes || '')
  const [isDirty, setIsDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveLabel, setSaveLabel] = useState('Save Changes')
  const [convertLabel, setConvertLabel] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const priceRange = submission.price_range_min && submission.price_range_max
    ? `$${Number(submission.price_range_min).toLocaleString()} - $${Number(submission.price_range_max).toLocaleString()}`
    : 'Not quoted'

  const designFeeRange = submission.design_fee_min && submission.design_fee_max
    ? `$${Number(submission.design_fee_min).toLocaleString()} - $${Number(submission.design_fee_max).toLocaleString()}`
    : 'N/A'

  const vehicleStr = [submission.vehicle_year, submission.vehicle_make, submission.vehicle_model]
    .filter(Boolean).join(' ') || '-'

  const prefContact = (submission.preferred_contact || '').toLowerCase()
  const isCallPref = prefContact.includes('call') || prefContact.includes('phone')
  const isTextPref = prefContact.includes('text') || prefContact.includes('sms')
  const isEmailPref = prefContact.includes('email')

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus)
    setIsDirty(true)
  }

  const handleNotesChange = (value: string) => {
    setNotes(value)
    setIsDirty(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveLabel('Saving...')
    try {
      const res = await fetch(`/api/submissions/${submission.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes })
      })
      const data = await res.json()
      if (data.ok) {
        setSaveLabel('Saved!')
        setIsDirty(false)
        setTimeout(() => setSaveLabel('Save Changes'), 2000)
      } else {
        setSaveLabel('Error')
        showToast('Error saving: ' + data.error, 'error')
        setTimeout(() => setSaveLabel('Save Changes'), 2000)
      }
    } catch {
      setSaveLabel('Error')
      showToast('Network error', 'error')
      setTimeout(() => setSaveLabel('Save Changes'), 2000)
    }
    setSaving(false)
  }

  const handleConvertToQuote = async () => {
    if (submission.converted_to_quote_id) {
      router.push(`/documents/${submission.converted_to_quote_id}`)
      return
    }

    setConvertLabel('Creating...')
    try {
      const res = await fetch('/api/submissions/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission_id: submission.id })
      })
      const data = await res.json()
      if (data.ok) {
        setConvertLabel('Created!')
        setTimeout(() => {
          router.push(`/documents/${data.doc_id}`)
        }, 800)
      } else {
        setConvertLabel('Error')
        setTimeout(() => setConvertLabel(''), 2000)
      }
    } catch {
      setConvertLabel('Error')
      setTimeout(() => setConvertLabel(''), 2000)
    }
  }

  const contactPillStyle = (active: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '6px',
    background: active ? 'rgba(215, 28, 209, 0.15)' : '#1d1d1d',
    border: active ? '1px solid rgba(215, 28, 209, 0.4)' : '1px solid rgba(148, 163, 184, 0.15)',
    fontSize: '13px',
    color: active ? '#d71cd1' : '#94a3b8',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  })

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: '960px', margin: '0 auto' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          padding: '12px 20px',
          borderRadius: '8px',
          background: toast.type === 'success' ? '#16a34a' : '#dc2626',
          color: 'white',
          fontSize: '14px',
          fontWeight: 500,
          zIndex: 9999,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => router.push('/submissions')}
            style={{
              ...btnBaseStyle,
              background: '#282a30',
              color: '#94a3b8',
              padding: '8px 12px'
            }}
          >
            <ArrowLeftIcon />
          </button>
          <div>
            <h1 style={{ color: '#f1f5f9', fontSize: '22px', fontWeight: 600, margin: 0 }}>
              {submission.customer_name || 'Unknown Customer'}
            </h1>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#64748b', fontSize: '13px', fontFamily: 'monospace' }}>
                SUBMISSION #{submission.submission_number || submission.id.slice(0, 8)}
              </span>
              <span style={{
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: 600,
                textTransform: 'uppercase',
                background: submission.form_type === 'automotive_styling' ? 'rgba(249, 115, 22, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                color: submission.form_type === 'automotive_styling' ? '#f97316' : '#3b82f6',
              }}>
                {FORM_TYPE_LABELS[submission.form_type || 'commercial_wrap'] || 'Commercial Wrap'}
              </span>
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {submission.customer_phone && (
            <button
              onClick={() => router.push(`/messages?phone=${encodeURIComponent(submission.customer_phone)}`)}
              style={{
                ...btnBaseStyle,
                background: '#3b82f6',
                color: 'white'
              }}
            >
              <MessageIcon /> Send Message
            </button>
          )}
          <button
            onClick={handleConvertToQuote}
            disabled={convertLabel === 'Creating...'}
            style={{
              ...btnBaseStyle,
              background: submission.converted_to_quote_id ? '#282a30' : 'transparent',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              color: '#f1f5f9'
            }}
          >
            <FileTextIcon />
            {submission.converted_to_quote_id
              ? 'View Quote'
              : convertLabel || 'Create Quote'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              ...btnBaseStyle,
              background: isDirty
                ? 'linear-gradient(135deg, #eab308, #ca8a04)'
                : 'linear-gradient(135deg, #d71cd1, #a855f7)',
              color: 'white'
            }}
          >
            {saveLabel === 'Saved!' ? <CheckIcon /> : <SaveIcon />}
            {saveLabel}
          </button>
        </div>
      </div>

      {/* Detail Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '20px'
      }}>
        {/* Customer Info */}
        <div style={sectionStyle}>
          <div style={{ ...sectionTitleStyle, color: '#22d3ee' }}>
            <UserIcon /> Customer Info
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Name</span>
            <span style={valueStyle}>{submission.customer_name || '-'}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Company</span>
            <span style={valueStyle}>{submission.company_name || '-'}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Phone</span>
            <span style={valueStyle}>
              <a href={`tel:${submission.customer_phone}`} style={linkStyle}>
                {formatPhone(submission.customer_phone)}
              </a>
            </span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Email</span>
            <span style={valueStyle}>
              <a href={`mailto:${submission.customer_email}`} style={linkStyle}>
                {submission.customer_email || '-'}
              </a>
            </span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Website</span>
            <span style={valueStyle}>
              {submission.website ? (
                <a href={submission.website.startsWith('http') ? submission.website : `https://${submission.website}`} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                  {submission.website}
                </a>
              ) : '-'}
            </span>
          </div>
          <div style={lastRowStyle}>
            <span style={labelStyle}>Preferred Contact</span>
            <span style={{ ...valueStyle, display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <span
                style={contactPillStyle(isCallPref)}
                onClick={() => submission.customer_phone && window.open(`tel:${submission.customer_phone}`)}
              >
                <PhoneIcon /> Call
              </span>
              <span
                style={contactPillStyle(isTextPref)}
                onClick={() => document.getElementById('quick-message-input')?.focus()}
              >
                <MessageIcon /> Text
              </span>
              <span
                style={contactPillStyle(isEmailPref)}
                onClick={() => submission.customer_email && window.open(`mailto:${submission.customer_email}`)}
              >
                <MailIcon /> Email
              </span>
            </span>
          </div>
        </div>

        {/* Vehicle & Project */}
        <div style={sectionStyle}>
          <div style={{ ...sectionTitleStyle, color: '#22d3ee' }}>
            <TruckIcon /> Vehicle & Project
          </div>

          {/* New multi-vehicle display */}
          {submission.vehicles && submission.vehicles.length > 0 ? (
            <>
              <div style={rowStyle}>
                <span style={labelStyle}>Vehicles</span>
                <span style={valueStyle}>{submission.vehicles.length} vehicle{submission.vehicles.length > 1 ? 's' : ''}</span>
              </div>
              {submission.vehicles.map((v: VehicleEntry, idx: number) => (
                <div key={idx} style={{
                  background: '#1d1d1d',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  marginTop: '8px',
                  fontSize: '13px'
                }}>
                  <div style={{ fontWeight: 600, color: '#f1f5f9', marginBottom: '4px' }}>
                    {v.type_label || v.type}
                    {v.browsing && <span style={{ color: '#3b82f6', fontWeight: 400, marginLeft: '8px', fontSize: '11px' }}>Exploring options</span>}
                  </div>
                  {v.is_other ? (
                    <div style={{ color: '#94a3b8' }}>{v.other_desc || 'No description'}</div>
                  ) : (
                    <div style={{ color: '#94a3b8' }}>
                      {[v.year, v.make, v.model].filter(Boolean).join(' ') || 'Details not provided'}
                      {v.color && <span style={{ marginLeft: '8px' }}>({v.color_other || v.color})</span>}
                    </div>
                  )}
                  {v.conditionals && Object.keys(v.conditionals).length > 0 && (
                    <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>
                      {Object.entries(v.conditionals).map(([k, val]) => val ? `${k.replace(/_/g, ' ')}: ${val}` : null).filter(Boolean).join(' \u00B7 ')}
                    </div>
                  )}
                  {v.photo_urls && v.photo_urls.length > 0 && (
                    <div style={{ marginTop: '4px', fontSize: '12px' }}>
                      {v.photo_urls.map((url: string, pi: number) => (
                        <a key={pi} href={url} target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, marginRight: '8px', fontSize: '12px' }}>
                          Photo {pi + 1}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          ) : (
            /* Legacy single-vehicle display */
            <>
              <div style={rowStyle}>
                <span style={labelStyle}>Vehicle Type</span>
                <span style={valueStyle}>{VEHICLE_LABELS[submission.vehicle_category] || submission.vehicle_category || '-'}</span>
              </div>
              <div style={rowStyle}>
                <span style={labelStyle}>Vehicle</span>
                <span style={valueStyle}>{vehicleStr}</span>
              </div>
              <div style={rowStyle}>
                <span style={labelStyle}>Vehicle Count</span>
                <span style={valueStyle}>{submission.vehicle_count || 1}</span>
              </div>
            </>
          )}

          <div style={{ borderTop: '1px solid rgba(148, 163, 184, 0.08)', marginTop: '8px', paddingTop: '8px' }}>
            {submission.form_type === 'automotive_styling' ? (
              <>
                <div style={rowStyle}>
                  <span style={labelStyle}>Services</span>
                  <span style={{ ...valueStyle, maxWidth: '60%' }}>
                    {submission.services && submission.services.length > 0
                      ? submission.services.map((s: string) => SERVICE_LABELS[s] || s.replace(/_/g, ' ')).join(', ')
                      : '-'}
                  </span>
                </div>
                {submission.service_details && Object.keys(submission.service_details).length > 0 && (
                  Object.entries(submission.service_details).map(([svc, detail]) => {
                    if (!detail) return null
                    const parts = typeof detail === 'object'
                      ? Object.entries(detail as Record<string, any>).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(', ')
                      : String(detail)
                    return (
                      <div key={svc} style={rowStyle}>
                        <span style={labelStyle}>{SERVICE_LABELS[svc] || svc.replace(/_/g, ' ')}</span>
                        <span style={{ ...valueStyle, maxWidth: '60%' }}>{parts}</span>
                      </div>
                    )
                  })
                )}
                {submission.reference_image_urls && submission.reference_image_urls.length > 0 && (
                  <div style={lastRowStyle}>
                    <span style={labelStyle}>Reference Images</span>
                    <span style={valueStyle}>
                      {submission.reference_image_urls.map((url: string, i: number) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, marginLeft: i > 0 ? '8px' : 0 }}>
                          Image {i + 1}
                        </a>
                      ))}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={rowStyle}>
                  <span style={labelStyle}>Coverage Type</span>
                  <span style={valueStyle}>
                    {COVERAGE_LABELS[submission.coverage_type || ''] || PROJECT_LABELS[submission.project_type] || submission.coverage_type || submission.project_type || '-'}
                  </span>
                </div>
                <div style={rowStyle}>
                  <span style={labelStyle}>Artwork Status</span>
                  <span style={{ ...valueStyle, display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                    {ARTWORK_LABELS[submission.artwork_status || ''] || DESIGN_LABELS[submission.design_scenario] || submission.artwork_status || submission.design_scenario || '-'}
                    {submission.ai_acknowledged && (
                      <span style={{
                        background: 'rgba(234, 179, 8, 0.15)',
                        color: '#eab308',
                        fontSize: '10px',
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}>AI</span>
                    )}
                  </span>
                </div>
                {submission.logo_urls && submission.logo_urls.length > 0 && (
                  <div style={lastRowStyle}>
                    <span style={labelStyle}>Logo Files</span>
                    <span style={valueStyle}>
                      {submission.logo_urls.map((url: string, i: number) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, marginLeft: i > 0 ? '8px' : 0 }}>
                          Logo {i + 1}
                        </a>
                      ))}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Pricing */}
        <div style={sectionStyle}>
          <div style={{ ...sectionTitleStyle, color: '#22d3ee' }}>
            <DollarIcon /> Pricing
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Estimated Range</span>
            <span style={{ ...valueStyle, fontSize: '18px', fontWeight: 600, color: '#22c55e' }}>{priceRange}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Design Fee</span>
            <span style={valueStyle}>{designFeeRange}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Customer Budget</span>
            <span style={valueStyle}>
              {BUDGET_LABELS[submission.budget || ''] || submission.budget_range || '-'}
            </span>
          </div>
          <div style={lastRowStyle}>
            <span style={labelStyle}>Timeline</span>
            <span style={valueStyle}>
              {TIMELINE_LABELS[submission.timeline || ''] || submission.timeline || '-'}
            </span>
          </div>
        </div>

        {/* Status */}
        <div style={sectionStyle}>
          <div style={{ ...sectionTitleStyle, color: '#22d3ee' }}>
            <ChartIcon /> Status
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Status</span>
            <span style={valueStyle}>
              <select
                value={status}
                onChange={(e) => handleStatusChange(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  background: STATUS_COLORS[status]?.bg || '#1d1d1d',
                  color: STATUS_COLORS[status]?.color || '#f1f5f9',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{formatStatusLabel(s)}</option>
                ))}
              </select>
            </span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Form Type</span>
            <span style={valueStyle}>{FORM_TYPE_LABELS[submission.form_type || 'commercial_wrap'] || 'Commercial Wrap'}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Source</span>
            <span style={valueStyle}>{submission.source || '-'}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Created</span>
            <span style={valueStyle}>{formatDate(submission.created_at)}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Last Contact</span>
            <span style={valueStyle}>{submission.last_contact_at ? formatDate(submission.last_contact_at) : 'Never'}</span>
          </div>
          <div style={lastRowStyle}>
            <span style={labelStyle}>Assigned To</span>
            <span style={valueStyle}>{submission.assigned_to || 'Unassigned'}</span>
          </div>
        </div>

        {/* Vision & Notes - Full Width */}
        <div style={{ ...sectionStyle, gridColumn: '1 / -1' }}>
          <div style={{ ...sectionTitleStyle, color: '#22d3ee' }}>
            <FileTextIcon /> Vision & Notes
          </div>
          {(submission.vision_description || submission.additional_info) && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ ...labelStyle, marginBottom: '6px' }}>
                {submission.additional_info ? 'Customer Notes' : 'Customer\u2019s Vision'}
              </div>
              <div style={{
                background: '#1d1d1d',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#f1f5f9',
                lineHeight: '1.5'
              }}>
                {submission.additional_info || submission.vision_description}
              </div>
            </div>
          )}
          <div>
            <div style={{ ...labelStyle, marginBottom: '6px' }}>Internal Notes</div>
            <textarea
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Add notes about this submission..."
              style={{
                width: '100%',
                minHeight: '80px',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                background: '#1d1d1d',
                color: '#f1f5f9',
                fontSize: '14px',
                fontFamily: 'inherit',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
