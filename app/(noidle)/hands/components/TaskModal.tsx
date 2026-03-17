'use client'

import { useState } from 'react'
import type { NihTask, NihCategory, NihLocation, NihTeamMember, TaskBucket } from '../types'
import { URGENCY_LABELS, TIME_ESTIMATES, BUCKET_CONFIG } from '../types'

interface TaskModalProps {
  task: NihTask | null
  categories: NihCategory[]
  locations: NihLocation[]
  teamMembers: NihTeamMember[]
  defaultBucket?: TaskBucket
  onSave: (data: Record<string, unknown>) => Promise<void>
  onClose: () => void
}

const labelStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 500,
  color: '#94a3b8',
  marginBottom: '6px',
  display: 'block',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#282a30',
  border: '1px solid #3f4451',
  borderRadius: '10px',
  padding: '12px 14px',
  fontSize: '16px',
  color: '#f1f5f9',
  outline: 'none',
  boxSizing: 'border-box',
  minHeight: '48px',
}

export default function TaskModal({ task, categories, locations, teamMembers, defaultBucket, onSave, onClose }: TaskModalProps) {
  const [title, setTitle] = useState(task?.title || '')
  const [description, setDescription] = useState(task?.description || '')
  const [categoryId, setCategoryId] = useState(task?.category_id || '')
  const [locationId, setLocationId] = useState(task?.location_id || '')
  const [urgency, setUrgency] = useState(task?.urgency || 'medium')
  const [timeEstimate, setTimeEstimate] = useState(task?.time_estimate || '')
  const [isProject, setIsProject] = useState(task?.is_project || false)
  const [pointOfContact, setPointOfContact] = useState(task?.point_of_contact || '')
  const [points, setPoints] = useState(task?.points || 0)
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    task?.nih_task_assignees?.map(a => a.team_member_id || a.nih_team_members?.id).filter(Boolean) as string[] || []
  )
  const [isRecurring, setIsRecurring] = useState(task?.is_recurring || false)
  const [recurringDays, setRecurringDays] = useState<string[]>(task?.recurring_days || [])
  const [taskBucket, setTaskBucket] = useState<TaskBucket>(
    task?.task_bucket || (defaultBucket === 'recurring' ? 'recurring' : defaultBucket) || 'whenever'
  )
  const [saving, setSaving] = useState(false)

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  const toggleDay = (day: string) => {
    setRecurringDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  }

  const handleSubmit = async () => {
    if (!title.trim() || saving) return
    setSaving(true)
    await onSave({
      title: title.trim(),
      description: description.trim() || null,
      category_id: categoryId || null,
      location_id: locationId || null,
      urgency,
      time_estimate: timeEstimate || null,
      is_project: isProject,
      point_of_contact: pointOfContact.trim() || null,
      points,
      assignee_ids: assigneeIds,
      is_recurring: isRecurring,
      recurring_days: isRecurring ? recurringDays : [],
      task_bucket: isRecurring ? 'recurring' : taskBucket,
    })
    setSaving(false)
  }

  const toggleAssignee = (id: string) => {
    setAssigneeIds(prev => (prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]))
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: '#1d1d1d',
          borderRadius: '20px 20px 0 0',
          border: '1px solid rgba(255,255,255,0.08)',
          borderBottom: 'none',
          width: '100%',
          maxWidth: '520px',
          maxHeight: '92vh',
          overflow: 'auto',
          padding: '20px',
          paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Pull indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: '#3f4451' }} />
        </div>

        <h2 style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 20px', color: '#f1f5f9' }}>
          {task ? 'Edit Task' : 'New Task'}
        </h2>

        {/* Title */}
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Title</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="What needs to get done?"
            style={inputStyle}
            autoFocus
          />
        </div>

        {/* Description */}
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Details, notes, context..."
            rows={3}
            style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }}
          />
        </div>

        {/* Category + Location row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={labelStyle}>Category</label>
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)} style={inputStyle}>
              <option value="">None</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Location</label>
            <select value={locationId} onChange={e => setLocationId(e.target.value)} style={inputStyle}>
              <option value="">None</option>
              {locations.map(l => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Urgency + Time estimate row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={labelStyle}>Urgency</label>
            <select value={urgency} onChange={e => setUrgency(e.target.value as NihTask['urgency'])} style={inputStyle}>
              {Object.entries(URGENCY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Time Estimate</label>
            <select value={timeEstimate} onChange={e => setTimeEstimate(e.target.value)} style={inputStyle}>
              <option value="">None</option>
              {TIME_ESTIMATES.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Bucket selector */}
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Bucket</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
            {(['recurring', 'urgent', 'whenever', 'bonus'] as TaskBucket[]).map(bucket => {
              const cfg = BUCKET_CONFIG[bucket]
              const active = taskBucket === bucket
              const locked = isRecurring && bucket !== 'recurring'
              return (
                <button
                  key={bucket}
                  type="button"
                  onClick={() => {
                    if (locked) return
                    setTaskBucket(bucket)
                    if (bucket === 'recurring') setIsRecurring(true)
                  }}
                  style={{
                    padding: '10px 0',
                    borderRadius: '10px',
                    border: `2px solid ${active ? cfg.color : '#3f4451'}`,
                    background: active ? `${cfg.color}22` : 'transparent',
                    color: active ? cfg.color : locked ? '#3f4451' : '#6b7280',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: locked ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                    minHeight: '44px',
                    opacity: locked ? 0.4 : 1,
                  }}
                >
                  {cfg.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Points — hidden for projects (points go on subtasks instead) */}
        {!isProject && (
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Points (0–25)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="range"
                min={0}
                max={25}
                value={points}
                onChange={e => setPoints(Number(e.target.value))}
                style={{
                  flex: 1,
                  accentColor: points > 0 ? '#d71cd1' : '#3f4451',
                  height: '6px',
                }}
              />
              <span style={{
                minWidth: '40px',
                textAlign: 'center',
                fontSize: '18px',
                fontWeight: 700,
                color: points > 0 ? '#d71cd1' : '#6b7280',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {points}
              </span>
            </div>
          </div>
        )}
        {isProject && (
          <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(215,28,209,0.06)', borderRadius: '10px', border: '1px solid rgba(215,28,209,0.15)' }}>
            <span style={{ fontSize: '13px', color: '#d71cd1', fontWeight: 500 }}>
              Points are set per sub-task for projects
            </span>
          </div>
        )}

        {/* Assignees */}
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Assign To</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {teamMembers.map(m => {
              const selected = assigneeIds.includes(m.id)
              return (
                <button
                  key={m.id}
                  onClick={() => toggleAssignee(m.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 14px',
                    borderRadius: '999px',
                    border: `2px solid ${selected ? m.avatar_color : '#3f4451'}`,
                    background: selected ? m.avatar_color + '22' : 'transparent',
                    color: selected ? m.avatar_color : '#94a3b8',
                    fontSize: '15px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    minHeight: '44px',
                  }}
                >
                  <span
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '999px',
                      background: m.avatar_color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#fff',
                    }}
                  >
                    {m.name[0]}
                  </span>
                  {m.name}
                </button>
              )
            })}
          </div>
        </div>

        {/* Point of contact */}
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Point of Contact</label>
          <input
            type="text"
            value={pointOfContact}
            onChange={e => setPointOfContact(e.target.value)}
            placeholder="Who knows most about this?"
            style={inputStyle}
          />
        </div>

        {/* Is Project toggle */}
        <div style={{ marginBottom: '16px' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              fontSize: '16px',
              color: '#94a3b8',
              minHeight: '44px',
            }}
          >
            <input
              type="checkbox"
              checked={isProject}
              onChange={e => { setIsProject(e.target.checked); if (e.target.checked) setPoints(0) }}
              style={{ accentColor: '#22d3ee', width: '20px', height: '20px' }}
            />
            This is a project (has sub-tasks)
          </label>
        </div>

        {/* Recurring toggle */}
        <div style={{ marginBottom: isRecurring ? '8px' : '24px' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              fontSize: '16px',
              color: isRecurring ? '#22d3ee' : '#94a3b8',
              minHeight: '44px',
            }}
          >
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={e => {
                const checked = e.target.checked
                setIsRecurring(checked)
                if (checked) setTaskBucket('recurring')
                else if (taskBucket === 'recurring') setTaskBucket('whenever')
              }}
              style={{ accentColor: '#22d3ee', width: '20px', height: '20px' }}
            />
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 8C2 4.7 4.7 2 8 2C10.2 2 12.1 3.3 13 5.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M14 8C14 11.3 11.3 14 8 14C5.8 14 3.9 12.7 3 10.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M13 2V5.2H9.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3 14V10.8H6.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Recurring task
            </span>
          </label>
        </div>

        {/* Day-of-week selector */}
        {isRecurring && (
          <div style={{ marginBottom: '24px' }}>
            <label style={labelStyle}>Repeat On</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {DAYS.map(day => {
                const active = recurringDays.includes(day)
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      borderRadius: '10px',
                      border: `2px solid ${active ? '#22d3ee' : '#3f4451'}`,
                      background: active ? 'rgba(34,211,238,0.15)' : 'transparent',
                      color: active ? '#22d3ee' : '#6b7280',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      minHeight: '44px',
                    }}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              background: 'none',
              border: '1px solid #3f4451',
              borderRadius: '12px',
              padding: '14px',
              fontSize: '16px',
              color: '#94a3b8',
              cursor: 'pointer',
              minHeight: '48px',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || saving}
            style={{
              flex: 2,
              background: title.trim() ? '#d71cd1' : '#3f4451',
              border: 'none',
              borderRadius: '12px',
              padding: '14px',
              fontSize: '16px',
              fontWeight: 600,
              color: '#fff',
              cursor: title.trim() ? 'pointer' : 'default',
              opacity: saving ? 0.6 : 1,
              minHeight: '48px',
            }}
          >
            {saving ? 'Saving...' : task ? 'Save Changes' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  )
}
