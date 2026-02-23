'use client'

import { useState } from 'react'
import type { NihTask, NihCategory, NihLocation, NihTeamMember } from '../types'
import { URGENCY_LABELS, TIME_ESTIMATES } from '../types'

interface TaskModalProps {
  task: NihTask | null
  categories: NihCategory[]
  locations: NihLocation[]
  teamMembers: NihTeamMember[]
  onSave: (data: Record<string, unknown>) => Promise<void>
  onClose: () => void
}

const labelStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 500,
  color: '#94a3b8',
  marginBottom: '4px',
  display: 'block',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#282a30',
  border: '1px solid #3f4451',
  borderRadius: '8px',
  padding: '10px 12px',
  fontSize: '14px',
  color: '#f1f5f9',
  outline: 'none',
  boxSizing: 'border-box',
}

export default function TaskModal({ task, categories, locations, teamMembers, onSave, onClose }: TaskModalProps) {
  const [title, setTitle] = useState(task?.title || '')
  const [description, setDescription] = useState(task?.description || '')
  const [categoryId, setCategoryId] = useState(task?.category_id || '')
  const [locationId, setLocationId] = useState(task?.location_id || '')
  const [urgency, setUrgency] = useState(task?.urgency || 'medium')
  const [timeEstimate, setTimeEstimate] = useState(task?.time_estimate || '')
  const [isProject, setIsProject] = useState(task?.is_project || false)
  const [pointOfContact, setPointOfContact] = useState(task?.point_of_contact || '')
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    task?.nih_task_assignees?.map(a => a.team_member_id || a.nih_team_members?.id).filter(Boolean) as string[] || []
  )
  const [saving, setSaving] = useState(false)

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
      assignee_ids: assigneeIds,
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
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '24px',
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: '#1d1d1d',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.08)',
          width: '100%',
          maxWidth: '520px',
          maxHeight: '85vh',
          overflow: 'auto',
          padding: '24px',
        }}
      >
        <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 20px', color: '#f1f5f9' }}>
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
            style={{ ...inputStyle, resize: 'vertical' }}
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

        {/* Assignees */}
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Assign To</label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {teamMembers.map(m => {
              const selected = assigneeIds.includes(m.id)
              return (
                <button
                  key={m.id}
                  onClick={() => toggleAssignee(m.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 10px',
                    borderRadius: '999px',
                    border: `1.5px solid ${selected ? m.avatar_color : '#3f4451'}`,
                    background: selected ? m.avatar_color + '22' : 'transparent',
                    color: selected ? m.avatar_color : '#94a3b8',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '999px',
                      background: m.avatar_color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '9px',
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
        <div style={{ marginBottom: '24px' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              color: '#94a3b8',
            }}
          >
            <input
              type="checkbox"
              checked={isProject}
              onChange={e => setIsProject(e.target.checked)}
              style={{ accentColor: '#22d3ee' }}
            />
            This is a project (has sub-tasks)
          </label>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: '1px solid #3f4451',
              borderRadius: '8px',
              padding: '8px 20px',
              fontSize: '14px',
              color: '#94a3b8',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || saving}
            style={{
              background: title.trim() ? '#d71cd1' : '#3f4451',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 20px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#fff',
              cursor: title.trim() ? 'pointer' : 'default',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving...' : task ? 'Save Changes' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  )
}
