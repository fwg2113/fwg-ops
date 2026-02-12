'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

type DevRequest = {
  id: string
  title: string
  request_type: string
  priority: string
  status: string
  where_in_app: string | null
  what_happened: string | null
  steps_to_reproduce: string | null
  expected_behavior: string | null
  actual_behavior: string | null
  why_needed: string | null
  submitted_by: string
  screenshot_url: string | null
  dev_notes: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

const REQUEST_TYPES = [
  { value: 'bug', label: 'Bug Report', emoji: '\uD83D\uDC1B', color: '#ef4444', desc: 'Something is broken or not working correctly' },
  { value: 'feature', label: 'Feature Request', emoji: '\u2728', color: '#8b5cf6', desc: 'A new capability or page you\'d like added' },
  { value: 'improvement', label: 'Improvement', emoji: '\uD83D\uDD27', color: '#06b6d4', desc: 'An existing feature that could work better' },
  { value: 'question', label: 'Question', emoji: '\u2753', color: '#f59e0b', desc: 'Need clarification on how something works' },
]

const PRIORITIES = [
  { value: 'critical', label: 'Critical', color: '#ef4444', desc: 'Blocking work — needs immediate attention' },
  { value: 'high', label: 'High', color: '#f97316', desc: 'Important — should be addressed soon' },
  { value: 'medium', label: 'Medium', color: '#f59e0b', desc: 'Would be nice to fix in the near term' },
  { value: 'low', label: 'Low', color: '#22c55e', desc: 'Nice to have — no rush' },
]

const STATUSES = [
  { value: 'open', label: 'Open', color: '#f59e0b' },
  { value: 'in_progress', label: 'In Progress', color: '#06b6d4' },
  { value: 'resolved', label: 'Resolved', color: '#22c55e' },
  { value: 'closed', label: 'Closed', color: '#64748b' },
]

const APP_AREAS = [
  'Command Center',
  'Lead Pipeline',
  'Quote Builder',
  'Invoice Manager',
  'Payment History',
  'Customer Database',
  'Message Hub',
  'Email Inbox',
  'Job Calendar',
  'Task Board',
  'Production Flow',
  'Production Analytics',
  'Project Archive',
  'System Settings',
  'Customer Portal (public view)',
  'Other / General',
]

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function timeAgo(dateStr: string) {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(dateStr)
}

export default function DevRequestsView({ initialRequests }: { initialRequests: DevRequest[] }) {
  const router = useRouter()
  const [requests, setRequests] = useState(initialRequests)
  const [showForm, setShowForm] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<DevRequest | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('active')
  const [filterType, setFilterType] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [formStep, setFormStep] = useState(0)
  const [form, setForm] = useState({
    request_type: '',
    title: '',
    priority: 'medium',
    where_in_app: '',
    what_happened: '',
    steps_to_reproduce: '',
    expected_behavior: '',
    actual_behavior: '',
    why_needed: '',
    submitted_by: '',
    screenshot_url: '',
  })

  const resetForm = () => {
    setForm({
      request_type: '', title: '', priority: 'medium', where_in_app: '',
      what_happened: '', steps_to_reproduce: '', expected_behavior: '',
      actual_behavior: '', why_needed: '', submitted_by: '', screenshot_url: '',
    })
    setFormStep(0)
  }

  const filtered = useMemo(() => {
    let list = requests
    if (filterStatus === 'active') list = list.filter(r => r.status === 'open' || r.status === 'in_progress')
    else if (filterStatus !== 'all') list = list.filter(r => r.status === filterStatus)
    if (filterType !== 'all') list = list.filter(r => r.request_type === filterType)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(r =>
        r.title.toLowerCase().includes(q) ||
        r.what_happened?.toLowerCase().includes(q) ||
        r.where_in_app?.toLowerCase().includes(q) ||
        r.submitted_by?.toLowerCase().includes(q)
      )
    }
    return list
  }, [requests, filterStatus, filterType, search])

  const stats = useMemo(() => ({
    open: requests.filter(r => r.status === 'open').length,
    in_progress: requests.filter(r => r.status === 'in_progress').length,
    resolved: requests.filter(r => r.status === 'resolved').length,
    critical: requests.filter(r => r.priority === 'critical' && r.status !== 'resolved' && r.status !== 'closed').length,
  }), [requests])

  async function handleSubmit() {
    if (!form.title.trim() || !form.request_type) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/dev-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.request) {
        setRequests(prev => [data.request, ...prev])
        setShowForm(false)
        resetForm()
      }
    } catch (err) {
      console.error('Failed to submit:', err)
    }
    setSubmitting(false)
  }

  async function updateRequest(id: string, updates: Partial<DevRequest>) {
    try {
      const res = await fetch('/api/dev-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      })
      const data = await res.json()
      if (data.request) {
        setRequests(prev => prev.map(r => r.id === id ? data.request : r))
        if (selectedRequest?.id === id) setSelectedRequest(data.request)
      }
    } catch (err) {
      console.error('Failed to update:', err)
    }
  }

  const isBugType = form.request_type === 'bug'

  const selectStyle: React.CSSProperties = {
    padding: '8px 12px', background: '#111', border: '1px solid rgba(148,163,184,0.2)',
    borderRadius: '8px', color: '#f1f5f9', fontSize: '13px',
  }

  // ---------- RENDER ----------

  // Detail panel
  if (selectedRequest) {
    const req = selectedRequest
    const typeInfo = REQUEST_TYPES.find(t => t.value === req.request_type)
    const prioInfo = PRIORITIES.find(p => p.value === req.priority)
    const statusInfo = STATUSES.find(s => s.value === req.status)

    return (
      <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '900px' }}>
        <button
          onClick={() => setSelectedRequest(null)}
          style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '14px', cursor: 'pointer', padding: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Back to all requests
        </button>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', padding: '3px 10px', borderRadius: '4px', background: `${typeInfo?.color}20`, color: typeInfo?.color, border: `1px solid ${typeInfo?.color}40`, fontWeight: 500 }}>
            {typeInfo?.emoji} {typeInfo?.label}
          </span>
          <span style={{ fontSize: '13px', padding: '3px 10px', borderRadius: '4px', background: `${prioInfo?.color}20`, color: prioInfo?.color, border: `1px solid ${prioInfo?.color}40`, fontWeight: 500 }}>
            {prioInfo?.label}
          </span>
          <select
            value={req.status}
            onChange={e => updateRequest(req.id, { status: e.target.value })}
            style={{ ...selectStyle, background: `${statusInfo?.color}15`, color: statusInfo?.color, borderColor: `${statusInfo?.color}40`, fontWeight: 600, fontSize: '12px' }}
          >
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <h1 style={{ color: '#f1f5f9', fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>{req.title}</h1>
        <div style={{ color: '#64748b', fontSize: '13px', marginBottom: '28px' }}>
          Submitted by <strong style={{ color: '#94a3b8' }}>{req.submitted_by}</strong> {timeAgo(req.created_at)}
          {req.where_in_app && <> in <strong style={{ color: '#94a3b8' }}>{req.where_in_app}</strong></>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {req.what_happened && (
            <DetailSection label={isBugType ? 'What Happened' : 'Description'} value={req.what_happened} />
          )}
          {req.steps_to_reproduce && (
            <DetailSection label="Steps to Reproduce" value={req.steps_to_reproduce} />
          )}
          {req.expected_behavior && (
            <DetailSection label="Expected Behavior" value={req.expected_behavior} />
          )}
          {req.actual_behavior && (
            <DetailSection label="Actual Behavior" value={req.actual_behavior} />
          )}
          {req.why_needed && (
            <DetailSection label="Why This Matters" value={req.why_needed} />
          )}
          {req.screenshot_url && (
            <div style={{ background: '#1d1d1d', borderRadius: '10px', padding: '16px', border: '1px solid rgba(148,163,184,0.1)' }}>
              <div style={{ color: '#64748b', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Screenshot / Reference</div>
              <a href={req.screenshot_url} target="_blank" rel="noopener noreferrer" style={{ color: '#8b5cf6', fontSize: '14px', wordBreak: 'break-all' }}>{req.screenshot_url}</a>
            </div>
          )}

          {/* Dev Notes */}
          <div style={{ background: '#1d1d1d', borderRadius: '10px', padding: '16px', border: '1px solid rgba(139,92,246,0.2)' }}>
            <div style={{ color: '#a78bfa', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
              Dev Notes
            </div>
            <textarea
              value={req.dev_notes || ''}
              onChange={e => setSelectedRequest({ ...req, dev_notes: e.target.value })}
              onBlur={e => updateRequest(req.id, { dev_notes: e.target.value })}
              placeholder="Add developer notes, progress updates, or resolution details..."
              rows={4}
              style={{
                width: '100%', background: '#111', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '8px',
                color: '#f1f5f9', fontSize: '14px', padding: '12px', resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5',
              }}
            />
          </div>
        </div>
      </div>
    )
  }

  // ---------- NEW REQUEST FORM (modal overlay) ----------
  if (showForm) {
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '700px' }}>
        <button
          onClick={() => { setShowForm(false); resetForm() }}
          style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '14px', cursor: 'pointer', padding: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Cancel
        </button>

        <h1 style={{ color: '#f1f5f9', fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>New Dev Request</h1>
        <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '28px', marginTop: 0 }}>
          Walk through each step to give us the details we need to address this quickly.
        </p>

        {/* Progress indicator */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '32px' }}>
          {[0, 1, 2, 3].map(step => (
            <div key={step} style={{
              flex: 1, height: '4px', borderRadius: '2px',
              background: step <= formStep ? 'linear-gradient(90deg, #d71cd1, #8b5cf6)' : '#2d2d2d',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        {/* Step 0: Type + Who */}
        {formStep === 0 && (
          <div>
            <FormLabel>What kind of request is this?</FormLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '24px' }}>
              {REQUEST_TYPES.map(type => (
                <button
                  key={type.value}
                  onClick={() => setForm(f => ({ ...f, request_type: type.value }))}
                  style={{
                    padding: '16px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left',
                    background: form.request_type === type.value ? `${type.color}15` : '#1d1d1d',
                    border: `2px solid ${form.request_type === type.value ? type.color : 'rgba(148,163,184,0.1)'}`,
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: '20px', marginBottom: '6px' }}>{type.emoji}</div>
                  <div style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600, marginBottom: '2px' }}>{type.label}</div>
                  <div style={{ color: '#64748b', fontSize: '12px' }}>{type.desc}</div>
                </button>
              ))}
            </div>

            <FormLabel>Your name</FormLabel>
            <input
              value={form.submitted_by}
              onChange={e => setForm(f => ({ ...f, submitted_by: e.target.value }))}
              placeholder="e.g. Marcus, Sarah, Alex..."
              style={inputStyle}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
              <StepButton disabled={!form.request_type || !form.submitted_by.trim()} onClick={() => setFormStep(1)}>
                Next: Details
              </StepButton>
            </div>
          </div>
        )}

        {/* Step 1: Title + Where + Priority */}
        {formStep === 1 && (
          <div>
            <FormLabel>Give it a short title</FormLabel>
            <FormHint>Summarize the issue in one line — like a subject line</FormHint>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder={isBugType ? 'e.g. Payment button not responding on invoice page' : 'e.g. Add ability to bulk-send invoices'}
              style={inputStyle}
            />

            <FormLabel style={{ marginTop: '20px' }}>Where in the app?</FormLabel>
            <FormHint>Which page or section does this relate to?</FormHint>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
              {APP_AREAS.map(area => (
                <button
                  key={area}
                  onClick={() => setForm(f => ({ ...f, where_in_app: area }))}
                  style={{
                    padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
                    background: form.where_in_app === area ? '#8b5cf620' : '#1d1d1d',
                    border: `1px solid ${form.where_in_app === area ? '#8b5cf6' : 'rgba(148,163,184,0.15)'}`,
                    color: form.where_in_app === area ? '#a78bfa' : '#94a3b8',
                    fontWeight: form.where_in_app === area ? 600 : 400,
                  }}
                >
                  {area}
                </button>
              ))}
            </div>

            <FormLabel style={{ marginTop: '20px' }}>How urgent is this?</FormLabel>
            <div style={{ display: 'flex', gap: '8px' }}>
              {PRIORITIES.map(p => (
                <button
                  key={p.value}
                  onClick={() => setForm(f => ({ ...f, priority: p.value }))}
                  style={{
                    flex: 1, padding: '10px 8px', borderRadius: '8px', cursor: 'pointer', textAlign: 'center',
                    background: form.priority === p.value ? `${p.color}15` : '#1d1d1d',
                    border: `2px solid ${form.priority === p.value ? p.color : 'rgba(148,163,184,0.1)'}`,
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ color: p.color, fontSize: '13px', fontWeight: 600 }}>{p.label}</div>
                  <div style={{ color: '#64748b', fontSize: '10px', marginTop: '2px' }}>{p.desc}</div>
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
              <StepButton variant="secondary" onClick={() => setFormStep(0)}>Back</StepButton>
              <StepButton disabled={!form.title.trim()} onClick={() => setFormStep(2)}>
                Next: {isBugType ? 'Bug Details' : 'Description'}
              </StepButton>
            </div>
          </div>
        )}

        {/* Step 2: The meat — what/how/expected/actual (varies by type) */}
        {formStep === 2 && (
          <div>
            {isBugType ? (
              <>
                <FormLabel>What happened?</FormLabel>
                <FormHint>Describe what went wrong in plain language</FormHint>
                <textarea
                  value={form.what_happened}
                  onChange={e => setForm(f => ({ ...f, what_happened: e.target.value }))}
                  placeholder="e.g. When I clicked the 'Record Payment' button, nothing happened. The page just stayed the same and no payment was recorded."
                  rows={3}
                  style={textareaStyle}
                />

                <FormLabel style={{ marginTop: '20px' }}>Steps to reproduce</FormLabel>
                <FormHint>How can we make the same thing happen? Walk us through it step by step</FormHint>
                <textarea
                  value={form.steps_to_reproduce}
                  onChange={e => setForm(f => ({ ...f, steps_to_reproduce: e.target.value }))}
                  placeholder={'1. Go to an invoice\n2. Click "Record Payment"\n3. Enter $500 and select Cash\n4. Click "Save Payment"\n5. Nothing happens'}
                  rows={4}
                  style={textareaStyle}
                />

                <FormLabel style={{ marginTop: '20px' }}>What did you expect to happen?</FormLabel>
                <textarea
                  value={form.expected_behavior}
                  onChange={e => setForm(f => ({ ...f, expected_behavior: e.target.value }))}
                  placeholder="e.g. The payment should be recorded and the balance should update"
                  rows={2}
                  style={textareaStyle}
                />

                <FormLabel style={{ marginTop: '20px' }}>What actually happened?</FormLabel>
                <textarea
                  value={form.actual_behavior}
                  onChange={e => setForm(f => ({ ...f, actual_behavior: e.target.value }))}
                  placeholder="e.g. The button appeared to do nothing. No error message, no loading spinner, balance stayed the same."
                  rows={2}
                  style={textareaStyle}
                />
              </>
            ) : (
              <>
                <FormLabel>
                  {form.request_type === 'feature' ? 'Describe the feature you\'d like' :
                   form.request_type === 'improvement' ? 'What could be improved?' :
                   'What\'s your question?'}
                </FormLabel>
                <FormHint>Be as specific as you can — the more detail, the faster we can address it</FormHint>
                <textarea
                  value={form.what_happened}
                  onChange={e => setForm(f => ({ ...f, what_happened: e.target.value }))}
                  placeholder={
                    form.request_type === 'feature'
                      ? 'e.g. It would be great to have a button that lets me duplicate a quote and turn it into a new one for a different customer, keeping all the line items...'
                      : form.request_type === 'improvement'
                      ? 'e.g. The quote builder page loads slowly when there are many line items. It would be better if...'
                      : 'e.g. How does the auto-production feature work? When I record a payment, does it always...'
                  }
                  rows={5}
                  style={textareaStyle}
                />

                {form.request_type !== 'question' && (
                  <>
                    <FormLabel style={{ marginTop: '20px' }}>How should it work ideally?</FormLabel>
                    <FormHint>Describe your ideal outcome — how would it work in a perfect world?</FormHint>
                    <textarea
                      value={form.expected_behavior}
                      onChange={e => setForm(f => ({ ...f, expected_behavior: e.target.value }))}
                      placeholder="e.g. I'd click a 'Duplicate' button, it creates a copy, and I can change the customer and adjust line items from there."
                      rows={3}
                      style={textareaStyle}
                    />
                  </>
                )}
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
              <StepButton variant="secondary" onClick={() => setFormStep(1)}>Back</StepButton>
              <StepButton disabled={!form.what_happened.trim()} onClick={() => setFormStep(3)}>
                Next: Final Details
              </StepButton>
            </div>
          </div>
        )}

        {/* Step 3: Why + Screenshot + Submit */}
        {formStep === 3 && (
          <div>
            <FormLabel>Why does this matter?</FormLabel>
            <FormHint>Help us prioritize — how does this affect your work or the business?</FormHint>
            <textarea
              value={form.why_needed}
              onChange={e => setForm(f => ({ ...f, why_needed: e.target.value }))}
              placeholder="e.g. Customers are waiting for invoices and I can't process payments until this is fixed. We're losing about 2 hours a day working around this."
              rows={3}
              style={textareaStyle}
            />

            <FormLabel style={{ marginTop: '20px' }}>Screenshot or reference URL (optional)</FormLabel>
            <FormHint>Paste a link to a screenshot, Loom video, or Google Doc</FormHint>
            <input
              value={form.screenshot_url}
              onChange={e => setForm(f => ({ ...f, screenshot_url: e.target.value }))}
              placeholder="https://..."
              style={inputStyle}
            />

            {/* Review summary */}
            <div style={{ background: '#1d1d1d', borderRadius: '10px', padding: '16px', marginTop: '24px', border: '1px solid rgba(148,163,184,0.1)' }}>
              <div style={{ color: '#64748b', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Review your request</div>
              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '8px', fontSize: '13px' }}>
                <span style={{ color: '#64748b' }}>Type</span>
                <span style={{ color: REQUEST_TYPES.find(t => t.value === form.request_type)?.color }}>{REQUEST_TYPES.find(t => t.value === form.request_type)?.label}</span>
                <span style={{ color: '#64748b' }}>Title</span>
                <span style={{ color: '#f1f5f9' }}>{form.title}</span>
                <span style={{ color: '#64748b' }}>Priority</span>
                <span style={{ color: PRIORITIES.find(p => p.value === form.priority)?.color }}>{PRIORITIES.find(p => p.value === form.priority)?.label}</span>
                <span style={{ color: '#64748b' }}>Where</span>
                <span style={{ color: '#f1f5f9' }}>{form.where_in_app || '—'}</span>
                <span style={{ color: '#64748b' }}>From</span>
                <span style={{ color: '#f1f5f9' }}>{form.submitted_by}</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
              <StepButton variant="secondary" onClick={() => setFormStep(2)}>Back</StepButton>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  padding: '12px 28px', borderRadius: '10px', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
                  background: 'linear-gradient(135deg, #d71cd1, #8b5cf6)', color: 'white', fontSize: '14px', fontWeight: 600,
                  opacity: submitting ? 0.6 : 1, boxShadow: '0 0 20px rgba(215,28,209,0.3)',
                }}
              >
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ---------- MAIN LIST VIEW ----------
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: '#f1f5f9', fontSize: '28px', marginBottom: '4px', fontWeight: 700, margin: 0 }}>Dev Requests</h1>
          <p style={{ color: '#94a3b8', margin: '4px 0 0', fontSize: '14px' }}>Report bugs, request features, and track progress</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{
            padding: '12px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #d71cd1, #8b5cf6)', color: 'white', fontSize: '14px', fontWeight: 600,
            boxShadow: '0 0 20px rgba(215,28,209,0.3)', display: 'flex', alignItems: 'center', gap: '8px',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Request
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        <StatCard label="Open" value={stats.open} color="#f59e0b" />
        <StatCard label="In Progress" value={stats.in_progress} color="#06b6d4" />
        <StatCard label="Resolved" value={stats.resolved} color="#22c55e" />
        <StatCard label="Critical" value={stats.critical} color="#ef4444" />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search requests..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: '200px', ...inputStyle }}
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
          <option value="active">Active (Open + In Progress)</option>
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={selectStyle}>
          <option value="all">All Types</option>
          {REQUEST_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {/* Request List */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5" style={{ margin: '0 auto 16px', display: 'block' }}>
            <path d="M8 2l1.88 1.88"/><path d="M14.12 3.88L16 2"/><path d="M9 7.13v-1a3 3 0 1 1 6 0v1"/>
            <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/>
          </svg>
          <div style={{ fontSize: '16px', marginBottom: '4px' }}>No requests found</div>
          <div style={{ fontSize: '13px' }}>Submit your first dev request to get started</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map(req => {
            const typeInfo = REQUEST_TYPES.find(t => t.value === req.request_type)
            const prioInfo = PRIORITIES.find(p => p.value === req.priority)
            const statusInfo = STATUSES.find(s => s.value === req.status)
            return (
              <div
                key={req.id}
                onClick={() => setSelectedRequest(req)}
                style={{
                  background: '#1d1d1d', borderRadius: '10px', padding: '16px 20px', cursor: 'pointer',
                  border: `1px solid ${req.priority === 'critical' ? 'rgba(239,68,68,0.3)' : 'rgba(148,163,184,0.08)'}`,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#242424'; e.currentTarget.style.transform = 'translateX(4px)' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#1d1d1d'; e.currentTarget.style.transform = 'none' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '4px', background: `${typeInfo?.color}15`, color: typeInfo?.color, border: `1px solid ${typeInfo?.color}30`, fontWeight: 500 }}>
                        {typeInfo?.emoji} {typeInfo?.label}
                      </span>
                      <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '4px', background: `${prioInfo?.color}15`, color: prioInfo?.color, border: `1px solid ${prioInfo?.color}30`, fontWeight: 500 }}>
                        {prioInfo?.label}
                      </span>
                      <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '4px', background: `${statusInfo?.color}15`, color: statusInfo?.color, fontWeight: 500 }}>
                        {statusInfo?.label}
                      </span>
                    </div>
                    <div style={{ color: '#f1f5f9', fontSize: '15px', fontWeight: 600, marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {req.title}
                    </div>
                    {req.what_happened && (
                      <div style={{ color: '#64748b', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '600px' }}>
                        {req.what_happened}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 500 }}>{req.submitted_by}</div>
                    <div style={{ color: '#475569', fontSize: '11px', marginTop: '2px' }}>{timeAgo(req.created_at)}</div>
                    {req.where_in_app && (
                      <div style={{ color: '#475569', fontSize: '11px', marginTop: '4px' }}>{req.where_in_app}</div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---- Sub-components ----

function DetailSection({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#1d1d1d', borderRadius: '10px', padding: '16px', border: '1px solid rgba(148,163,184,0.1)' }}>
      <div style={{ color: '#64748b', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>{label}</div>
      <div style={{ color: '#e2e8f0', fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{value}</div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: '#1d1d1d', borderRadius: '10px', padding: '16px', border: '1px solid rgba(148,163,184,0.08)' }}>
      <div style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>{label}</div>
      <div style={{ color, fontSize: '28px', fontWeight: 700 }}>{value}</div>
    </div>
  )
}

function FormLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: 600, marginBottom: '6px', ...style }}>{children}</div>
}

function FormHint({ children }: { children: React.ReactNode }) {
  return <div style={{ color: '#64748b', fontSize: '12px', marginBottom: '10px' }}>{children}</div>
}

function StepButton({ children, onClick, disabled, variant }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; variant?: 'secondary' }) {
  const isSecondary = variant === 'secondary'
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
        background: isSecondary ? 'transparent' : 'linear-gradient(135deg, #d71cd1, #8b5cf6)',
        border: isSecondary ? '1px solid rgba(148,163,184,0.2)' : 'none',
        color: isSecondary ? '#94a3b8' : 'white',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', background: '#111', border: '1px solid rgba(148,163,184,0.2)',
  borderRadius: '8px', color: '#f1f5f9', fontSize: '14px', fontFamily: 'inherit',
}

const textareaStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', background: '#111', border: '1px solid rgba(148,163,184,0.2)',
  borderRadius: '8px', color: '#f1f5f9', fontSize: '14px', resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5',
}
