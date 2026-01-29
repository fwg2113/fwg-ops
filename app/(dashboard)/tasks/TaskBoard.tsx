'use client'

import { useState } from 'react'

type Task = {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  due_date: string | null
  created_at: string
}

type TaskBoardProps = {
  initialTasks: Task[]
}

const priorityColors = {
  URGENT: { bg: 'rgba(239, 68, 68, 0.1)', border: '#ef4444', text: '#ef4444' },
  HIGH: { bg: 'rgba(249, 115, 22, 0.1)', border: '#f97316', text: '#f97316' },
  MEDIUM: { bg: 'rgba(234, 179, 8, 0.1)', border: '#eab308', text: '#eab308' },
  LOW: { bg: 'rgba(107, 114, 128, 0.1)', border: '#6b7280', text: '#6b7280' }
}

export default function TaskBoard({ initialTasks }: TaskBoardProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [showModal, setShowModal] = useState(false)
  const [filterPriority, setFilterPriority] = useState<string | null>(null)
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    due_date: ''
  })

  const columns = ['TO_DO', 'IN_PROGRESS', 'COMPLETED']
  const columnLabels = {
    TO_DO: 'To Do',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed'
  }

  const filteredTasks = filterPriority
    ? tasks.filter(task => task.priority === filterPriority)
    : tasks

  const getTasksByStatus = (status: string) => {
    return filteredTasks.filter(task => task.status === status)
  }

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    // Optimistic update
    setTasks(tasks.map(task =>
      task.id === taskId ? { ...task, status: newStatus } : task
    ))

    // Update in database
    const response = await fetch('/api/tasks/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, status: newStatus })
    })

    if (!response.ok) {
      // Revert on error
      setTasks(initialTasks)
      alert('Failed to update task')
    }
  }

  const handleAddTask = async () => {
    if (!newTask.title.trim()) {
      alert('Title is required')
      return
    }

    const response = await fetch('/api/tasks/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newTask,
        status: 'TO_DO'
      })
    })

    if (response.ok) {
      const createdTask = await response.json()
      setTasks([createdTask, ...tasks])
      setNewTask({ title: '', description: '', priority: 'MEDIUM', due_date: '' })
      setShowModal(false)
    } else {
      alert('Failed to create task')
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{
          fontSize: '2rem',
          fontWeight: '700',
          background: 'linear-gradient(135deg, #22d3ee 0%, #d71cd1 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          Task Board
        </h1>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {/* Priority Filter */}
          <select
            value={filterPriority || ''}
            onChange={(e) => setFilterPriority(e.target.value || null)}
            style={{
              background: '#1d1d1d',
              border: '1px solid rgba(148, 163, 184, 0.1)',
              borderRadius: '8px',
              color: '#f1f5f9',
              padding: '0.5rem 1rem',
              cursor: 'pointer'
            }}
          >
            <option value="">All Priorities</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* Add Task Button */}
          <button
            onClick={() => setShowModal(true)}
            style={{
              background: 'linear-gradient(135deg, #22d3ee 0%, #d71cd1 100%)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              padding: '0.5rem 1.5rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            + Add Task
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '1.5rem'
      }}>
        {columns.map(status => (
          <div key={status} style={{
            background: '#1d1d1d',
            borderRadius: '12px',
            border: '1px solid rgba(148, 163, 184, 0.1)',
            padding: '1.5rem'
          }}>
            {/* Column Header */}
            <div style={{
              marginBottom: '1rem',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid rgba(148, 163, 184, 0.1)'
            }}>
              <h2 style={{
                fontSize: '1.125rem',
                fontWeight: '600',
                color: '#f1f5f9',
                marginBottom: '0.25rem'
              }}>
                {columnLabels[status as keyof typeof columnLabels]}
              </h2>
              <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
                {getTasksByStatus(status).length} {getTasksByStatus(status).length === 1 ? 'task' : 'tasks'}
              </span>
            </div>

            {/* Task Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {getTasksByStatus(status).map(task => (
                <div
                  key={task.id}
                  style={{
                    background: '#282a30',
                    border: '1px solid rgba(148, 163, 184, 0.1)',
                    borderRadius: '8px',
                    padding: '1rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#22d3ee'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.1)'
                  }}
                >
                  {/* Task Title */}
                  <h3 style={{
                    fontSize: '1rem',
                    fontWeight: '600',
                    color: '#f1f5f9',
                    marginBottom: '0.5rem'
                  }}>
                    {task.title}
                  </h3>

                  {/* Task Description Preview */}
                  {task.description && (
                    <p style={{
                      fontSize: '0.875rem',
                      color: '#94a3b8',
                      marginBottom: '0.75rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}>
                      {task.description}
                    </p>
                  )}

                  {/* Priority Badge and Due Date */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.75rem'
                  }}>
                    <span style={{
                      background: priorityColors[task.priority as keyof typeof priorityColors]?.bg || priorityColors.MEDIUM.bg,
                      color: priorityColors[task.priority as keyof typeof priorityColors]?.text || priorityColors.MEDIUM.text,
                      border: `1px solid ${priorityColors[task.priority as keyof typeof priorityColors]?.border || priorityColors.MEDIUM.border}`,
                      borderRadius: '4px',
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      fontWeight: '600'
                    }}>
                      {task.priority}
                    </span>

                    {task.due_date && (
                      <span style={{
                        fontSize: '0.75rem',
                        color: '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}>
                        📅 {formatDate(task.due_date)}
                      </span>
                    )}
                  </div>

                  {/* Status Change Dropdown */}
                  <select
                    value={task.status}
                    onChange={(e) => handleStatusChange(task.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: '100%',
                      background: '#1d1d1d',
                      border: '1px solid rgba(148, 163, 184, 0.1)',
                      borderRadius: '6px',
                      color: '#f1f5f9',
                      padding: '0.5rem',
                      fontSize: '0.875rem',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="TO_DO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Add Task Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}
        onClick={() => setShowModal(false)}
        >
          <div
            style={{
              background: '#1d1d1d',
              border: '1px solid rgba(148, 163, 184, 0.1)',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '500px',
              width: '90%'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              color: '#f1f5f9',
              marginBottom: '1.5rem'
            }}>
              Add New Task
            </h2>

            {/* Title Input */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#94a3b8',
                marginBottom: '0.5rem'
              }}>
                Title *
              </label>
              <input
                type="text"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                style={{
                  width: '100%',
                  background: '#282a30',
                  border: '1px solid rgba(148, 163, 184, 0.1)',
                  borderRadius: '8px',
                  color: '#f1f5f9',
                  padding: '0.75rem',
                  fontSize: '1rem'
                }}
                placeholder="Enter task title"
              />
            </div>

            {/* Description Input */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#94a3b8',
                marginBottom: '0.5rem'
              }}>
                Description
              </label>
              <textarea
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                rows={4}
                style={{
                  width: '100%',
                  background: '#282a30',
                  border: '1px solid rgba(148, 163, 184, 0.1)',
                  borderRadius: '8px',
                  color: '#f1f5f9',
                  padding: '0.75rem',
                  fontSize: '1rem',
                  resize: 'vertical'
                }}
                placeholder="Enter task description"
              />
            </div>

            {/* Priority Dropdown */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#94a3b8',
                marginBottom: '0.5rem'
              }}>
                Priority
              </label>
              <select
                value={newTask.priority}
                onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                style={{
                  width: '100%',
                  background: '#282a30',
                  border: '1px solid rgba(148, 163, 184, 0.1)',
                  borderRadius: '8px',
                  color: '#f1f5f9',
                  padding: '0.75rem',
                  fontSize: '1rem',
                  cursor: 'pointer'
                }}
              >
                <option value="URGENT">Urgent</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>

            {/* Due Date Input */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#94a3b8',
                marginBottom: '0.5rem'
              }}>
                Due Date
              </label>
              <input
                type="date"
                value={newTask.due_date}
                onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                style={{
                  width: '100%',
                  background: '#282a30',
                  border: '1px solid rgba(148, 163, 184, 0.1)',
                  borderRadius: '8px',
                  color: '#f1f5f9',
                  padding: '0.75rem',
                  fontSize: '1rem'
                }}
              />
            </div>

            {/* Modal Buttons */}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(148, 163, 184, 0.1)',
                  borderRadius: '8px',
                  color: '#94a3b8',
                  padding: '0.5rem 1.5rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddTask}
                style={{
                  background: 'linear-gradient(135deg, #22d3ee 0%, #d71cd1 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  padding: '0.5rem 1.5rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Add Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
