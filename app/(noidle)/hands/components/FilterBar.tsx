'use client'

import type { FilterState, NihCategory, NihLocation, NihTeamMember } from '../types'
import { URGENCY_LABELS, TIME_ESTIMATES } from '../types'

interface FilterBarProps {
  filters: FilterState
  onChange: (filters: FilterState) => void
  categories: NihCategory[]
  locations: NihLocation[]
  teamMembers: NihTeamMember[]
}

const selectStyle: React.CSSProperties = {
  background: '#282a30',
  border: '1px solid #3f4451',
  borderRadius: '6px',
  padding: '6px 10px',
  fontSize: '12px',
  color: '#f1f5f9',
  outline: 'none',
  cursor: 'pointer',
}

export default function FilterBar({ filters, onChange, categories, locations, teamMembers }: FilterBarProps) {
  const update = (key: keyof FilterState, value: string | boolean | null) => {
    onChange({ ...filters, [key]: value })
  }

  const hasActiveFilters = Object.entries(filters).some(
    ([k, v]) => k !== 'showCompleted' && v !== null
  )

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginTop: '12px',
        flexWrap: 'wrap',
      }}
    >
      <select
        value={filters.category || ''}
        onChange={e => update('category', e.target.value || null)}
        style={{
          ...selectStyle,
          color: filters.category ? '#f1f5f9' : '#6b7280',
        }}
      >
        <option value="">Category</option>
        {categories.map(c => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <select
        value={filters.urgency || ''}
        onChange={e => update('urgency', e.target.value || null)}
        style={{
          ...selectStyle,
          color: filters.urgency ? '#f1f5f9' : '#6b7280',
        }}
      >
        <option value="">Urgency</option>
        {Object.entries(URGENCY_LABELS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>

      <select
        value={filters.timeEstimate || ''}
        onChange={e => update('timeEstimate', e.target.value || null)}
        style={{
          ...selectStyle,
          color: filters.timeEstimate ? '#f1f5f9' : '#6b7280',
        }}
      >
        <option value="">Time</option>
        {TIME_ESTIMATES.map(t => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      <select
        value={filters.location || ''}
        onChange={e => update('location', e.target.value || null)}
        style={{
          ...selectStyle,
          color: filters.location ? '#f1f5f9' : '#6b7280',
        }}
      >
        <option value="">Location</option>
        {locations.map(l => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>

      <select
        value={filters.assignee || ''}
        onChange={e => update('assignee', e.target.value || null)}
        style={{
          ...selectStyle,
          color: filters.assignee ? '#f1f5f9' : '#6b7280',
        }}
      >
        <option value="">Assigned to</option>
        {teamMembers.map(m => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>

      {/* Show completed toggle */}
      <button
        onClick={() => update('showCompleted', !filters.showCompleted)}
        style={{
          ...selectStyle,
          border: filters.showCompleted ? '1px solid #22c55e' : '1px solid #3f4451',
          color: filters.showCompleted ? '#22c55e' : '#6b7280',
          cursor: 'pointer',
        }}
      >
        {filters.showCompleted ? 'Hiding done' : 'Show done'}
      </button>

      {/* Clear filters */}
      {hasActiveFilters && (
        <button
          onClick={() =>
            onChange({
              category: null,
              urgency: null,
              timeEstimate: null,
              location: null,
              assignee: null,
              showCompleted: filters.showCompleted,
            })
          }
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            fontSize: '12px',
            cursor: 'pointer',
            textDecoration: 'underline',
            padding: '6px 4px',
          }}
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
