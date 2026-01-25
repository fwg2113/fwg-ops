'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

type Submission = {
  id: string
  submission_number: number
  status: string
  customer_name: string
  customer_email: string
  customer_phone: string
  company_name: string
  vehicle_category: string
  vehicle_year: string
  vehicle_make: string
  vehicle_model: string
  project_type: string
  design_scenario: string
  price_range_min: number
  price_range_max: number
  vision_description: string
  created_at: string
}

export default function SubmissionList({ initialSubmissions, totalCount }: { initialSubmissions: Submission[], totalCount: number }) {
  const router = useRouter()
  const [submissions, setSubmissions] = useState<Submission[]>(initialSubmissions)
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null)
  const [converting, setConverting] = useState(false)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return { bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }
      case 'contacted': return { bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }
      case 'quoted': return { bg: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }
      case 'converted': return { bg: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' }
      case 'lost': return { bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }
      default: return { bg: 'rgba(148, 163, 184, 0.1)', color: '#94a3b8' }
    }
  }

  const handleStatusChange = async (id: string, newStatus: string) => {
    await supabase
      .from('submissions')
      .update({ status: newStatus })
      .eq('id', id)
    
    setSubmissions(submissions.map(s => s.id === id ? { ...s, status: newStatus } : s))
    if (selectedSubmission?.id === id) {
      setSelectedSubmission({ ...selectedSubmission, status: newStatus })
    }
  }

  const handleConvertToQuote = async (submission: Submission) => {
    setConverting(true)

    // First, create or find customer
    let customerId = null
    if (submission.customer_email) {
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('email', submission.customer_email)
        .single()

      if (existingCustomer) {
        customerId = existingCustomer.id
      } else {
        const nameParts = (submission.customer_name || '').split(' ')
        const { data: newCustomer } = await supabase
          .from('customers')
          .insert([{
            first_name: nameParts[0] || '',
            last_name: nameParts.slice(1).join(' ') || '',
            display_name: submission.customer_name,
            email: submission.customer_email,
            phone: submission.customer_phone,
            company: submission.company_name
          }])
          .select()
          .single()
        
        if (newCustomer) customerId = newCustomer.id
      }
    }

    // Create the quote
    const vehicleDesc = [submission.vehicle_year, submission.vehicle_make, submission.vehicle_model]
      .filter(Boolean)
      .join(' ')

    const { data: quote, error } = await supabase
      .from('documents')
      .insert([{
        doc_type: 'quote',
        status: 'draft',
        customer_id: customerId,
        customer_name: submission.customer_name,
        customer_email: submission.customer_email,
        customer_phone: submission.customer_phone,
        company_name: submission.company_name,
        vehicle_description: vehicleDesc,
        project_description: submission.vision_description || `${submission.project_type} - ${vehicleDesc}`,
        category: mapProjectTypeToCategory(submission.project_type),
        submission_id: submission.id
      }])
      .select()
      .single()

    if (!error && quote) {
      // Update submission status
      await supabase
        .from('submissions')
        .update({ status: 'converted', converted_to_quote_id: quote.id })
        .eq('id', submission.id)

      setConverting(false)
      router.push(`/documents/${quote.id}`)
    } else {
      setConverting(false)
    }
  }

  const mapProjectTypeToCategory = (projectType: string): string => {
    const mapping: Record<string, string> = {
      'full_wrap': 'FULL_WRAP',
      'partial_wrap': 'PARTIAL_WRAP',
      'commercial_wrap': 'COMMERCIAL_WRAP',
      'color_change': 'COLOR_CHANGE',
      'ppf': 'PPF',
      'tint': 'TINT',
      'signage': 'SIGNAGE'
    }
    return mapping[projectType?.toLowerCase()] || 'FULL_WRAP'
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: '#f1f5f9', fontSize: '28px', marginBottom: '4px' }}>Submissions</h1>
          <p style={{ color: '#94a3b8' }}>{totalCount} total leads</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedSubmission ? '1fr 400px' : '1fr', gap: '24px' }}>
        {/* Submissions Table */}
        <div style={{ background: '#1d1d1d', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
                <th style={{ padding: '16px', textAlign: 'left', color: '#94a3b8', fontSize: '12px', fontWeight: '600' }}>LEAD</th>
                <th style={{ padding: '16px', textAlign: 'left', color: '#94a3b8', fontSize: '12px', fontWeight: '600' }}>VEHICLE</th>
                <th style={{ padding: '16px', textAlign: 'left', color: '#94a3b8', fontSize: '12px', fontWeight: '600' }}>PROJECT</th>
                <th style={{ padding: '16px', textAlign: 'right', color: '#94a3b8', fontSize: '12px', fontWeight: '600' }}>EST. RANGE</th>
                <th style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '12px', fontWeight: '600' }}>STATUS</th>
                <th style={{ padding: '16px', textAlign: 'right', color: '#94a3b8', fontSize: '12px', fontWeight: '600' }}>RECEIVED</th>
              </tr>
            </thead>
            <tbody>
              {submissions.length > 0 ? submissions.map((sub) => {
                const statusStyle = getStatusColor(sub.status)
                return (
                  <tr 
                    key={sub.id} 
                    onClick={() => setSelectedSubmission(sub)}
                    style={{ 
                      borderBottom: '1px solid rgba(148, 163, 184, 0.05)', 
                      cursor: 'pointer',
                      background: selectedSubmission?.id === sub.id ? 'rgba(215, 28, 209, 0.05)' : 'transparent'
                    }}
                  >
                    <td style={{ padding: '16px' }}>
                      <p style={{ color: '#f1f5f9', fontSize: '14px', marginBottom: '2px' }}>{sub.customer_name || 'Unknown'}</p>
                      <p style={{ color: '#64748b', fontSize: '12px' }}>{sub.customer_email || sub.customer_phone || '-'}</p>
                    </td>
                    <td style={{ padding: '16px', color: '#94a3b8', fontSize: '14px' }}>
                      {[sub.vehicle_year, sub.vehicle_make, sub.vehicle_model].filter(Boolean).join(' ') || '-'}
                    </td>
                    <td style={{ padding: '16px', color: '#94a3b8', fontSize: '14px' }}>
                      {sub.project_type?.replace(/_/g, ' ') || '-'}
                    </td>
                    <td style={{ padding: '16px', color: '#d71cd1', fontSize: '14px', textAlign: 'right', fontWeight: '600' }}>
                      {sub.price_range_min && sub.price_range_max ? 
                        `$${sub.price_range_min.toLocaleString()} - $${sub.price_range_max.toLocaleString()}` : '-'}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '500',
                        background: statusStyle.bg,
                        color: statusStyle.color
                      }}>
                        {sub.status}
                      </span>
                    </td>
                    <td style={{ padding: '16px', color: '#64748b', fontSize: '13px', textAlign: 'right' }}>
                      {formatDate(sub.created_at)}
                    </td>
                  </tr>
                )
              }) : (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    No submissions yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Detail Panel */}
        {selectedSubmission && (
          <div style={{ background: '#1d1d1d', borderRadius: '12px', padding: '20px', height: 'fit-content' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <h3 style={{ color: '#f1f5f9', fontSize: '18px' }}>Lead Details</h3>
              <button
                onClick={() => setSelectedSubmission(null)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '20px' }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>Customer</p>
              <p style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: '600' }}>{selectedSubmission.customer_name}</p>
              {selectedSubmission.company_name && (
                <p style={{ color: '#94a3b8', fontSize: '14px' }}>{selectedSubmission.company_name}</p>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>Email</p>
                <p style={{ color: '#f1f5f9', fontSize: '14px' }}>{selectedSubmission.customer_email || '-'}</p>
              </div>
              <div>
                <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>Phone</p>
                <p style={{ color: '#f1f5f9', fontSize: '14px' }}>{selectedSubmission.customer_phone || '-'}</p>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>Vehicle</p>
              <p style={{ color: '#f1f5f9', fontSize: '14px' }}>
                {[selectedSubmission.vehicle_year, selectedSubmission.vehicle_make, selectedSubmission.vehicle_model].filter(Boolean).join(' ') || '-'}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>Project Type</p>
                <p style={{ color: '#f1f5f9', fontSize: '14px' }}>{selectedSubmission.project_type?.replace(/_/g, ' ') || '-'}</p>
              </div>
              <div>
                <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>Design</p>
                <p style={{ color: '#f1f5f9', fontSize: '14px' }}>{selectedSubmission.design_scenario?.replace(/_/g, ' ') || '-'}</p>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>Estimated Range</p>
              <p style={{ color: '#d71cd1', fontSize: '18px', fontWeight: '600' }}>
                {selectedSubmission.price_range_min && selectedSubmission.price_range_max ? 
                  `$${selectedSubmission.price_range_min.toLocaleString()} - $${selectedSubmission.price_range_max.toLocaleString()}` : '-'}
              </p>
            </div>

            {selectedSubmission.vision_description && (
              <div style={{ marginBottom: '20px' }}>
                <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>Vision/Notes</p>
                <p style={{ color: '#f1f5f9', fontSize: '14px', lineHeight: '1.5' }}>{selectedSubmission.vision_description}</p>
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '8px' }}>Status</p>
              <select
                value={selectedSubmission.status}
                onChange={(e) => handleStatusChange(selectedSubmission.id, e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: '#282a30',
                  border: '1px solid #3f4451',
                  borderRadius: '6px',
                  color: '#f1f5f9',
                  fontSize: '14px'
                }}
              >
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="quoted">Quoted</option>
                <option value="converted">Converted</option>
                <option value="lost">Lost</option>
              </select>
            </div>

            {selectedSubmission.status !== 'converted' && (
              <button
                onClick={() => handleConvertToQuote(selectedSubmission)}
                disabled={converting}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: '#d71cd1',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  opacity: converting ? 0.7 : 1
                }}
              >
                {converting ? 'Creating Quote...' : 'Convert to Quote'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
