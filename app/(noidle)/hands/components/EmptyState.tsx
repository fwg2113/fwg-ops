'use client'

import HandsLogo from './HandsLogo'

interface EmptyStateProps {
  onAddTask: () => void
  hasFilters: boolean
}

export default function EmptyState({ onAddTask, hasFilters }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 24px',
        textAlign: 'center',
      }}
    >
      <div style={{ opacity: 0.4, marginBottom: '24px' }}>
        <HandsLogo size={80} color="#94a3b8" />
      </div>
      <h2
        style={{
          fontSize: '20px',
          fontWeight: 600,
          color: '#f1f5f9',
          margin: '0 0 8px',
        }}
      >
        {hasFilters ? 'No tasks match your filters' : 'No idle hands today'}
      </h2>
      <p
        style={{
          fontSize: '14px',
          color: '#6b7280',
          margin: '0 0 24px',
        }}
      >
        {hasFilters
          ? 'Try adjusting your filters or add a new task'
          : 'Add a task to get the crew started'}
      </p>
      <button
        onClick={onAddTask}
        style={{
          background: '#d71cd1',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          padding: '10px 24px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        + Add a Task
      </button>
    </div>
  )
}
