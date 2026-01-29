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
  invoice_id?: string | null
  submission_id?: string | null
  quote_id?: string | null
  notes?: string | null
}

type TaskBoardProps = {
  initialTasks: Task[]
}

const priorityColors = {
  URGENT: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#6b7280'
}

const statusColors = {
  TO_DO: '#64748b',
  IN_PROGRESS: '#3b82f6',
  COMPLETED: '#22c55e'
}

export default function TaskBoard({ initialTasks }: TaskBoardProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [showModal, setShowModal] = useState(false)
  const [currentView, setCurrentView] = useState<'kanban' | 'list'>('kanban')
  const [filterPriority, setFilterPriority] = useState<string>('')
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)

  const [modalData, setModalData] = useState({
    title: '',
    description: '',
    status: 'TO_DO',
    priority: 'MEDIUM',
    due_date: '',
    notes: ''
  })

  const columns = [
    { key: 'TO_DO', label: 'To Do', color: statusColors.TO_DO },
    { key: 'IN_PROGRESS', label: 'In Progress', color: statusColors.IN_PROGRESS },
    { key: 'COMPLETED', label: 'Completed', color: statusColors.COMPLETED }
  ]

  const filteredTasks = filterPriority
    ? tasks.filter(task => task.priority === filterPriority)
    : tasks

  const getTasksByStatus = (status: string) => {
    return filteredTasks.filter(task => task.status === status)
  }

  const stats = {
    total: tasks.length,
    todo: tasks.filter(t => t.status === 'TO_DO').length,
    inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
    completed: tasks.filter(t => t.status === 'COMPLETED').length
  }

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    // Optimistic update
    setTasks(tasks.map(task =>
      task.id === taskId ? { ...task, status: newStatus } : task
    ))

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

  const openNewTaskModal = () => {
    setEditingTask(null)
    setModalData({
      title: '',
      description: '',
      status: 'TO_DO',
      priority: 'MEDIUM',
      due_date: '',
      notes: ''
    })
    setShowModal(true)
  }

  const openTaskDetail = (task: Task) => {
    setEditingTask(task)
    setModalData({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      due_date: task.due_date || '',
      notes: task.notes || ''
    })
    setShowModal(true)
  }

  const handleSaveTask = async () => {
    if (!modalData.title.trim()) {
      alert('Title is required')
      return
    }

    if (editingTask) {
      // Update existing task
      const response = await fetch('/api/tasks/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: editingTask.id,
          ...modalData
        })
      })

      if (response.ok) {
        const updatedTask = await response.json()
        setTasks(tasks.map(t => t.id === editingTask.id ? { ...t, ...modalData } : t))
        setShowModal(false)
      } else {
        alert('Failed to update task')
      }
    } else {
      // Create new task
      const response = await fetch('/api/tasks/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modalData)
      })

      if (response.ok) {
        const createdTask = await response.json()
        setTasks([createdTask, ...tasks])
        setShowModal(false)
      } else {
        alert('Failed to create task')
      }
    }
  }

  const handleDeleteTask = async () => {
    if (!editingTask) return
    if (!confirm('Delete this task? This cannot be undone.')) return

    const response = await fetch('/api/tasks/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: editingTask.id })
    })

    if (response.ok) {
      setTasks(tasks.filter(t => t.id !== editingTask.id))
      setShowModal(false)
    } else {
      alert('Failed to delete task')
    }
  }

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault()
    if (!draggedTaskId) return

    const task = tasks.find(t => t.id === draggedTaskId)
    if (!task || task.status === newStatus) return

    handleStatusChange(draggedTaskId, newStatus)
    setDraggedTaskId(null)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false
    return new Date(dueDate) < new Date()
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{
          fontSize: '1.25rem',
          fontWeight: '600',
          color: '#f1f5f9'
        }}>
          Task Board
        </h1>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Filters */}
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            style={{
              background: '#1d1d1d',
              border: '1px solid rgba(148, 163, 184, 0.1)',
              borderRadius: '6px',
              color: '#f1f5f9',
              padding: '8px 12px',
              fontSize: '13px',
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
            onClick={openNewTaskModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: '500',
              background: 'linear-gradient(135deg, #22d3ee 0%, #d71cd1 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add Task
          </button>

          {/* View Toggle */}
          <div style={{
            display: 'flex',
            background: '#1d1d1d',
            border: '1px solid rgba(148, 163, 184, 0.1)',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <button
              onClick={() => setCurrentView('kanban')}
              style={{
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: '500',
                background: currentView === 'kanban' ? 'linear-gradient(135deg, #22d3ee 0%, #d71cd1 100%)' : 'transparent',
                border: 'none',
                color: currentView === 'kanban' ? 'white' : '#94a3b8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <rect x="3" y="3" width="7" height="18" rx="1"></rect>
                <rect x="14" y="3" width="7" height="10" rx="1"></rect>
              </svg>
              Kanban
            </button>
            <button
              onClick={() => setCurrentView('list')}
              style={{
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: '500',
                background: currentView === 'list' ? 'linear-gradient(135deg, #22d3ee 0%, #d71cd1 100%)' : 'transparent',
                border: 'none',
                color: currentView === 'list' ? 'white' : '#94a3b8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <line x1="8" y1="6" x2="21" y2="6"></line>
                <line x1="8" y1="12" x2="21" y2="12"></line>
                <line x1="8" y1="18" x2="21" y2="18"></line>
                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                <line x1="3" y1="18" x2="3.01" y2="18"></line>
              </svg>
              List
            </button>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{
          background: '#1d1d1d',
          border: '1px solid rgba(148, 163, 184, 0.1)',
          borderRadius: '10px',
          padding: '16px 20px',
          minWidth: '140px'
        }}>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#f1f5f9' }}>{stats.total}</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Total Tasks</div>
        </div>
        <div style={{
          background: '#1d1d1d',
          border: '1px solid rgba(148, 163, 184, 0.1)',
          borderRadius: '10px',
          padding: '16px 20px',
          minWidth: '140px'
        }}>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#f1f5f9' }}>{stats.todo}</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>To Do</div>
        </div>
        <div style={{
          background: '#1d1d1d',
          border: '1px solid rgba(148, 163, 184, 0.1)',
          borderRadius: '10px',
          padding: '16px 20px',
          minWidth: '140px'
        }}>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#f1f5f9' }}>{stats.inProgress}</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>In Progress</div>
        </div>
        <div style={{
          background: '#1d1d1d',
          border: '1px solid rgba(148, 163, 184, 0.1)',
          borderRadius: '10px',
          padding: '16px 20px',
          minWidth: '140px'
        }}>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#f1f5f9' }}>{stats.completed}</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Completed</div>
        </div>
      </div>

      {/* Kanban Board View */}
      {currentView === 'kanban' && (
        <div style={{
          display: 'flex',
          gap: '16px',
          overflowX: 'auto',
          paddingBottom: '20px',
          minHeight: '500px'
        }}>
          {columns.map(column => (
            <div
              key={column.key}
              style={{
                flex: '0 0 300px',
                background: '#1d1d1d',
                border: '1px solid rgba(148, 163, 184, 0.1)',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: 'calc(100vh - 300px)'
              }}
            >
              {/* Column Header */}
              <div style={{
                padding: '16px',
                borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{
                  fontWeight: '600',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#f1f5f9'
                }}>
                  <span style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: column.color
                  }}></span>
                  {column.label}
                </div>
                <span style={{
                  background: '#282a30',
                  color: '#64748b',
                  fontSize: '12px',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontWeight: '500'
                }}>
                  {getTasksByStatus(column.key).length}
                </span>
              </div>

              {/* Column Body */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '12px'
                }}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, column.key)}
              >
                {getTasksByStatus(column.key).length > 0 ? (
                  getTasksByStatus(column.key).map(task => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onClick={() => openTaskDetail(task)}
                      style={{
                        background: '#282a30',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        borderRadius: '8px',
                        padding: '12px',
                        marginBottom: '8px',
                        cursor: 'pointer',
                        opacity: draggedTaskId === task.id ? 0.5 : 1
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#22d3ee'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.1)'
                      }}
                    >
                      {/* Task Header */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: '8px',
                        marginBottom: '8px'
                      }}>
                        <div style={{
                          fontWeight: '500',
                          fontSize: '14px',
                          color: '#f1f5f9',
                          lineHeight: '1.3'
                        }}>
                          {task.title}
                        </div>
                        <div style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: priorityColors[task.priority as keyof typeof priorityColors] || priorityColors.MEDIUM,
                          flexShrink: 0,
                          marginTop: '4px'
                        }}
                        title={task.priority}
                        ></div>
                      </div>

                      {/* Task Meta */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'wrap'
                      }}>
                        {task.invoice_id && (
                          <span
                            style={{
                              fontSize: '12px',
                              color: '#64748b',
                              background: '#111111',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center'
                            }}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '10px', height: '10px', marginRight: '3px' }}>
                              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                              <line x1="1" y1="10" x2="23" y2="10"></line>
                            </svg>
                            {task.invoice_id}
                          </span>
                        )}
                        {task.due_date && (
                          <span style={{
                            fontSize: '11px',
                            color: isOverdue(task.due_date) && task.status !== 'COMPLETED' ? '#ef4444' : '#64748b',
                            marginLeft: 'auto',
                            fontWeight: isOverdue(task.due_date) && task.status !== 'COMPLETED' ? '500' : '400'
                          }}>
                            {formatDate(task.due_date)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{
                    textAlign: 'center',
                    padding: '40px 20px',
                    color: '#64748b'
                  }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px', opacity: 0.5 }}>📋</div>
                    <div>No tasks</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List View */}
      {currentView === 'list' && (
        <div>
          {filteredTasks.length > 0 ? (
            <div style={{
              background: '#1d1d1d',
              border: '1px solid rgba(148, 163, 184, 0.1)',
              borderRadius: '12px',
              overflow: 'hidden'
            }}>
              {filteredTasks.map((task, index) => (
                <div
                  key={task.id}
                  onClick={() => openTaskDetail(task)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderBottom: index < filteredTasks.length - 1 ? '1px solid rgba(148, 163, 184, 0.1)' : 'none',
                    gap: '12px',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#282a30'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  {/* Checkbox */}
                  <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    border: `2px solid ${task.status === 'COMPLETED' ? '#22c55e' : 'rgba(148, 163, 184, 0.3)'}`,
                    background: task.status === 'COMPLETED' ? '#22c55e' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {task.status === 'COMPLETED' && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" width="12" height="12">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    )}
                  </div>

                  {/* Task Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#f1f5f9',
                      textDecoration: task.status === 'COMPLETED' ? 'line-through' : 'none',
                      opacity: task.status === 'COMPLETED' ? 0.6 : 1
                    }}>
                      {task.title}
                    </div>
                    {task.description && (
                      <div style={{
                        fontSize: '12px',
                        color: '#64748b',
                        marginTop: '2px'
                      }}>
                        {task.description}
                      </div>
                    )}
                  </div>

                  {/* Status Badge */}
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '500',
                    background: `${statusColors[task.status as keyof typeof statusColors]}20`,
                    color: statusColors[task.status as keyof typeof statusColors]
                  }}>
                    {columns.find(c => c.key === task.status)?.label || task.status}
                  </span>

                  {/* Priority Badge */}
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '500',
                    background: `${priorityColors[task.priority as keyof typeof priorityColors]}20`,
                    color: priorityColors[task.priority as keyof typeof priorityColors]
                  }}>
                    {task.priority}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#64748b'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.5 }}>📋</div>
              <div>No tasks found</div>
            </div>
          )}
        </div>
      )}

      {/* Task Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              background: '#1d1d1d',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '540px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '20px 24px',
              borderBottom: '1px solid rgba(148, 163, 184, 0.1)'
            }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                margin: 0,
                color: '#f1f5f9'
              }}>
                {editingTask ? 'Task Details' : 'New Task'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '28px',
                  color: '#64748b',
                  cursor: 'pointer',
                  lineHeight: 1,
                  padding: 0,
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#282a30'
                  e.currentTarget.style.color = '#f1f5f9'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'none'
                  e.currentTarget.style.color = '#64748b'
                }}
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px' }}>
              {/* Title */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#94a3b8',
                  marginBottom: '6px'
                }}>
                  Title
                </label>
                <input
                  type="text"
                  value={modalData.title}
                  onChange={(e) => setModalData({ ...modalData, title: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '14px',
                    background: '#282a30',
                    border: '1px solid rgba(148, 163, 184, 0.1)',
                    borderRadius: '8px',
                    color: '#f1f5f9'
                  }}
                  placeholder="Enter task title"
                />
              </div>

              {/* Description */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#94a3b8',
                  marginBottom: '6px'
                }}>
                  Description
                </label>
                <textarea
                  value={modalData.description}
                  onChange={(e) => setModalData({ ...modalData, description: e.target.value })}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '14px',
                    background: '#282a30',
                    border: '1px solid rgba(148, 163, 184, 0.1)',
                    borderRadius: '8px',
                    color: '#f1f5f9',
                    resize: 'vertical'
                  }}
                  placeholder="Enter task description"
                />
              </div>

              {/* Status and Priority Row */}
              <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: '500',
                    color: '#94a3b8',
                    marginBottom: '6px'
                  }}>
                    Status
                  </label>
                  <select
                    value={modalData.status}
                    onChange={(e) => setModalData({ ...modalData, status: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: '14px',
                      background: '#282a30',
                      border: '1px solid rgba(148, 163, 184, 0.1)',
                      borderRadius: '8px',
                      color: '#f1f5f9',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="TO_DO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: '500',
                    color: '#94a3b8',
                    marginBottom: '6px'
                  }}>
                    Priority
                  </label>
                  <select
                    value={modalData.priority}
                    onChange={(e) => setModalData({ ...modalData, priority: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: '14px',
                      background: '#282a30',
                      border: '1px solid rgba(148, 163, 184, 0.1)',
                      borderRadius: '8px',
                      color: '#f1f5f9',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="URGENT">Urgent</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
              </div>

              {/* Due Date */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#94a3b8',
                  marginBottom: '6px'
                }}>
                  Due Date
                </label>
                <input
                  type="date"
                  value={modalData.due_date}
                  onChange={(e) => setModalData({ ...modalData, due_date: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '14px',
                    background: '#282a30',
                    border: '1px solid rgba(148, 163, 184, 0.1)',
                    borderRadius: '8px',
                    color: '#f1f5f9'
                  }}
                />
              </div>

              {/* Notes */}
              <div style={{ marginBottom: '0' }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#94a3b8',
                  marginBottom: '6px'
                }}>
                  Notes
                </label>
                <textarea
                  value={modalData.notes}
                  onChange={(e) => setModalData({ ...modalData, notes: e.target.value })}
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '14px',
                    background: '#282a30',
                    border: '1px solid rgba(148, 163, 184, 0.1)',
                    borderRadius: '8px',
                    color: '#f1f5f9',
                    resize: 'vertical'
                  }}
                  placeholder="Additional notes..."
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              padding: '16px 24px',
              borderTop: '1px solid rgba(148, 163, 184, 0.1)',
              background: '#282a30',
              borderRadius: '0 0 16px 16px'
            }}>
              {editingTask && (
                <button
                  onClick={handleDeleteTask}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: '500',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: 'transparent',
                    color: '#ef4444',
                    marginRight: 'auto'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(239,68,68,0.1)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  Delete
                </button>
              )}
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: '500',
                  border: '1px solid rgba(148, 163, 184, 0.1)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background: '#1d1d1d',
                  color: '#94a3b8'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#282a30'
                  e.currentTarget.style.color = '#f1f5f9'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#1d1d1d'
                  e.currentTarget.style.color = '#94a3b8'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTask}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: '500',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background: 'linear-gradient(135deg, #22d3ee 0%, #d71cd1 100%)',
                  color: 'white'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.filter = 'brightness(1.1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.filter = 'brightness(1)'
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
