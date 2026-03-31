'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

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
  archived?: boolean | null
  parent_task_id?: string | null
  task_leader_id?: string | null
  attachments?: any[]
}

type Document = {
  id: string
  doc_id: string
  doc_number: number
  type: string
  customer_id: string
  customers: {
    id: string
    display_name: string
  }[] | null
}

type TeamMember = {
  id: string
  name: string
  short_name: string
  color: string
  role: string | null
}

type TaskAssignment = {
  task_id: string
  team_member_id: string
}

type TaskBoardProps = {
  initialTasks: Task[]
  documents: Document[]
  teamMembers?: TeamMember[]
  initialAssignments?: TaskAssignment[]
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
  STUCK: '#ef4444',
  COMPLETED: '#22c55e'
}

export default function TaskBoard({ initialTasks, documents, teamMembers = [], initialAssignments = [] }: TaskBoardProps) {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [showModal, setShowModal] = useState(false)
  const [currentView, setCurrentView] = useState<'kanban' | 'list'>('kanban')
  const [filterPriority, setFilterPriority] = useState<string>('')
  const [filterInvoice, setFilterInvoice] = useState<string>('')
  const [filterMember, setFilterMember] = useState<string>('')
  const [assignments, setAssignments] = useState<TaskAssignment[]>(initialAssignments)
  const [modalAssignments, setModalAssignments] = useState<string[]>([])

  const getAssignmentsForTask = (taskId: string) => {
    return assignments
      .filter(a => a.task_id === taskId)
      .map(a => teamMembers.find(tm => tm.id === a.team_member_id))
      .filter(Boolean) as TeamMember[]
  }

  const toggleModalAssignment = (memberId: string) => {
    setModalAssignments(prev => prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId])
  }

  const saveAssignments = async (taskId: string, memberIds: string[]) => {
    const current = assignments.filter(a => a.task_id === taskId).map(a => a.team_member_id)
    const toAdd = memberIds.filter(id => !current.includes(id))
    const toRemove = current.filter(id => !memberIds.includes(id))

    for (const memberId of toAdd) {
      await fetch('/api/tasks/assignments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task_id: taskId, team_member_id: memberId }) })
    }
    for (const memberId of toRemove) {
      await fetch('/api/tasks/assignments', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task_id: taskId, team_member_id: memberId }) })
    }

    setAssignments(prev => {
      const without = prev.filter(a => a.task_id !== taskId)
      return [...without, ...memberIds.map(mid => ({ task_id: taskId, team_member_id: mid }))]
    })
  }
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null)
  const [dragOverPosition, setDragOverPosition] = useState<'above' | 'below' | 'nest' | null>(null)
  const dragCounter = useRef(0)
  const [addingSubtaskFor, setAddingSubtaskFor] = useState<string | null>(null)
  const [subtaskTitle, setSubtaskTitle] = useState('')

  const [modalData, setModalData] = useState({
    title: '',
    description: '',
    status: 'TO_DO',
    priority: 'MEDIUM',
    due_date: '',
    notes: '',
    task_leader_id: '' as string
  })
  const [taskAttachments, setTaskAttachments] = useState<any[]>([])
  const [uploadingTaskFile, setUploadingTaskFile] = useState(false)
  const taskFileInputRef = useRef<HTMLInputElement>(null)

  const columns = [
    { key: 'TO_DO', label: 'To Do', color: statusColors.TO_DO },
    { key: 'IN_PROGRESS', label: 'In Progress', color: statusColors.IN_PROGRESS },
    { key: 'STUCK', label: 'Stuck', color: statusColors.STUCK },
    { key: 'COMPLETED', label: 'Completed', color: statusColors.COMPLETED }
  ]

  // Get unique invoices from documents
  const uniqueInvoices = documents
    .filter(doc => doc.type === 'invoice')
    .sort((a, b) => b.doc_number - a.doc_number)

  // Filter tasks by priority, invoice, and team member
  let filteredTasks = tasks
  if (filterPriority) {
    filteredTasks = filteredTasks.filter(task => task.priority === filterPriority)
  }
  if (filterInvoice) {
    filteredTasks = filteredTasks.filter(task => task.invoice_id === filterInvoice)
  }
  if (filterMember) {
    filteredTasks = filteredTasks.filter(task => assignments.some(a => a.task_id === task.id && a.team_member_id === filterMember))
  }

  // Helper function to get customer name for an invoice
  const getCustomerName = (invoiceId: string | null | undefined) => {
    if (!invoiceId) return null
    const doc = documents.find(d => d.doc_id === invoiceId && d.type === 'invoice')
    return doc?.customers?.[0]?.display_name || null
  }

  // Only show top-level tasks in columns (not subtasks)
  const getTasksByStatus = (status: string) => {
    return filteredTasks.filter(task => task.status === status && !task.parent_task_id)
  }

  const getSubtasks = (parentId: string) => {
    return tasks.filter(t => t.parent_task_id === parentId)
  }

  const stats = {
    total: tasks.length,
    todo: tasks.filter(t => t.status === 'TO_DO').length,
    inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
    stuck: tasks.filter(t => t.status === 'STUCK').length,
    completed: tasks.filter(t => t.status === 'COMPLETED').length
  }

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    console.log('[TaskBoard] Updating task status:', { taskId, newStatus })

    // Optimistic update
    setTasks(tasks.map(task =>
      task.id === taskId ? { ...task, status: newStatus } : task
    ))

    const response = await fetch('/api/tasks/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, status: newStatus })
    })

    console.log('[TaskBoard] API response status:', response.status, response.ok)

    if (!response.ok) {
      // Revert on error
      console.error('[TaskBoard] Failed to update task, reverting')
      setTasks(initialTasks)
      alert('Failed to update task')
    } else {
      const result = await response.json()
      console.log('[TaskBoard] Task updated successfully:', result)
      // Refresh server component data to ensure persistence
      console.log('[TaskBoard] Calling router.refresh()')
      router.refresh()
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
      notes: '',
      task_leader_id: ''
    })
    setModalAssignments([])
    setTaskAttachments([])
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
      notes: task.notes || '',
      task_leader_id: task.task_leader_id || ''
    })
    setModalAssignments(assignments.filter(a => a.task_id === task.id).map(a => a.team_member_id))
    setTaskAttachments(task.attachments || [])
    setShowModal(true)
  }

  const handleTaskFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, taskId?: string) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploadingTaskFile(true)
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/upload', { method: 'POST', body: formData })
        if (res.ok) {
          const data = await res.json()
          const att = { url: data.url, filename: file.name, contentType: file.type, size: file.size, uploadedAt: new Date().toISOString() }
          setTaskAttachments(prev => [...prev, att])
        }
      }
    } catch (err) {
      console.error('Upload error:', err)
    }
    setUploadingTaskFile(false)
    if (taskFileInputRef.current) taskFileInputRef.current.value = ''
  }

  const handleSaveTask = async () => {
    if (!modalData.title.trim()) {
      alert('Title is required')
      return
    }

    if (editingTask) {
      // Update existing task
      console.log('[TaskBoard] Updating task via modal:', { taskId: editingTask.id, ...modalData })

      const response = await fetch('/api/tasks/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: editingTask.id,
          ...modalData,
          task_leader_id: modalData.task_leader_id || null,
          attachments: taskAttachments
        })
      })

      if (response.ok) {
        const updatedTask = await response.json()
        await saveAssignments(editingTask.id, modalAssignments)
        setTasks(tasks.map(t => t.id === editingTask.id ? { ...t, ...modalData, task_leader_id: modalData.task_leader_id || null, attachments: taskAttachments } : t))
        setShowModal(false)
        router.refresh()
      } else {
        const errorText = await response.text()
        console.error('[TaskBoard] Failed to update task:', errorText)
        alert('Failed to update task')
      }
    } else {
      // Create new task
      const response = await fetch('/api/tasks/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...modalData,
          task_leader_id: modalData.task_leader_id || null,
          attachments: taskAttachments
        })
      })

      if (response.ok) {
        const createdTask = await response.json()
        await saveAssignments(createdTask.id, modalAssignments)
        setTasks([createdTask, ...tasks])
        setShowModal(false)
        router.refresh()
      } else {
        const errorText = await response.text()
        console.error('[TaskBoard] Failed to create task:', errorText)
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
      // Refresh server component data to ensure persistence
      router.refresh()
    } else {
      alert('Failed to delete task')
    }
  }

  const handleArchiveCompleted = async () => {
    const completedTasks = tasks.filter(t => t.status === 'COMPLETED')

    if (completedTasks.length === 0) {
      alert('No completed tasks to archive')
      return
    }

    if (!confirm(`Archive ${completedTasks.length} completed task${completedTasks.length > 1 ? 's' : ''}?`)) return

    console.log('[TaskBoard] Archiving completed tasks:', completedTasks.length)

    const response = await fetch('/api/tasks/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskIds: completedTasks.map(t => t.id) })
    })

    if (response.ok) {
      console.log('[TaskBoard] Tasks archived successfully')
      setTasks(tasks.filter(t => t.status !== 'COMPLETED'))
      router.refresh()
    } else {
      const errorText = await response.text()
      console.error('[TaskBoard] Failed to archive tasks:', errorText)
      alert('Failed to archive tasks')
    }
  }

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId)
    e.dataTransfer.effectAllowed = 'move'
    // Make the drag ghost slightly transparent
    const el = e.currentTarget as HTMLElement
    setTimeout(() => { el.style.opacity = '0.4' }, 0)
  }

  const handleDragEnd = useCallback(() => {
    setDraggedTaskId(null)
    setDragOverTaskId(null)
    setDragOverPosition(null)
    dragCounter.current = 0
  }, [])

  const handleColumnDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleTaskDragOver = useCallback((e: React.DragEvent, targetTaskId: string, isSubtask?: boolean) => {
    e.preventDefault()
    e.stopPropagation()
    if (!draggedTaskId || draggedTaskId === targetTaskId) return
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const h = rect.height

    // For subtasks or tasks that already are subtasks, only allow above/below
    // For top-level tasks: top 25% = above, middle 50% = nest, bottom 25% = below
    let pos: 'above' | 'below' | 'nest'
    if (isSubtask) {
      pos = y < h / 2 ? 'above' : 'below'
    } else {
      const draggedTask = tasks.find(t => t.id === draggedTaskId)
      // Don't allow nesting a parent that has subtasks, or nesting into itself
      const draggedHasSubtasks = tasks.some(t => t.parent_task_id === draggedTaskId)
      if (y < h * 0.25) pos = 'above'
      else if (y > h * 0.75) pos = 'below'
      else if (draggedHasSubtasks || draggedTask?.parent_task_id) pos = y < h / 2 ? 'above' : 'below'
      else pos = 'nest'
    }
    setDragOverTaskId(targetTaskId)
    setDragOverPosition(pos)
  }, [draggedTaskId, tasks])

  const nestTask = async (taskId: string, parentId: string | null) => {
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, parent_task_id: parentId } : t))
    const res = await fetch('/api/tasks/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, parent_task_id: parentId })
    })
    if (!res.ok) {
      router.refresh()
    } else {
      router.refresh()
    }
  }

  const handleAddSubtask = async (parentId: string) => {
    if (!subtaskTitle.trim()) return
    const res = await fetch('/api/tasks/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: subtaskTitle.trim(), status: 'TO_DO', priority: 'MEDIUM', parent_task_id: parentId })
    })
    if (res.ok) {
      const created = await res.json()
      setTasks(prev => [...prev, created])
      setSubtaskTitle('')
      setAddingSubtaskFor(null)
      router.refresh()
    }
  }

  const toggleSubtaskDone = async (subtask: Task) => {
    const newStatus = subtask.status === 'COMPLETED' ? 'TO_DO' : 'COMPLETED'
    setTasks(prev => prev.map(t => t.id === subtask.id ? { ...t, status: newStatus } : t))
    await fetch('/api/tasks/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: subtask.id, status: newStatus })
    })
    router.refresh()
  }

  const handleDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault()
    if (!draggedTaskId) return

    const task = tasks.find(t => t.id === draggedTaskId)
    if (!task) return

    // Nesting: drop onto center of another task
    if (dragOverTaskId && dragOverPosition === 'nest') {
      nestTask(draggedTaskId, dragOverTaskId)
      handleDragEnd()
      return
    }

    // Reorder within column
    if (dragOverTaskId && (dragOverPosition === 'above' || dragOverPosition === 'below')) {
      const targetTask = tasks.find(t => t.id === dragOverTaskId)

      // Check if dragging a subtask onto a sibling subtask (same parent) — just reorder, don't un-nest
      if (task.parent_task_id && targetTask?.parent_task_id === task.parent_task_id) {
        const siblings = tasks.filter(t => t.parent_task_id === task.parent_task_id && t.id !== draggedTaskId)
        const rest = tasks.filter(t => t.parent_task_id !== task.parent_task_id || t.id === draggedTaskId).filter(t => t.id !== draggedTaskId)
        const targetIdx = siblings.findIndex(t => t.id === dragOverTaskId)
        if (targetIdx !== -1) {
          const insertAt = dragOverPosition === 'below' ? targetIdx + 1 : targetIdx
          siblings.splice(insertAt, 0, task)
        } else {
          siblings.push(task)
        }
        setTasks([...rest, ...siblings])
        handleDragEnd()
        return
      }

      // Dropping onto a top-level task — un-nest if needed and reorder
      const columnTopLevel = tasks.filter(t => t.status === newStatus && !t.parent_task_id && t.id !== draggedTaskId)
      const otherTasks = tasks.filter(t => (t.status !== newStatus || t.parent_task_id) && t.id !== draggedTaskId)
      const draggedTask = { ...task, status: newStatus, parent_task_id: null }

      const targetIdx = columnTopLevel.findIndex(t => t.id === dragOverTaskId)
      if (targetIdx !== -1) {
        const insertAt = dragOverPosition === 'below' ? targetIdx + 1 : targetIdx
        columnTopLevel.splice(insertAt, 0, draggedTask)
      } else {
        columnTopLevel.push(draggedTask)
      }

      setTasks([...otherTasks, ...columnTopLevel])

      // If was a subtask, un-nest it
      if (task.parent_task_id) {
        nestTask(draggedTaskId, null)
      }
      // If status changed, persist
      if (task.status !== newStatus) {
        handleStatusChange(draggedTaskId, newStatus)
      }
    } else if (task.status !== newStatus) {
      // Dropping on empty column area
      if (task.parent_task_id) {
        nestTask(draggedTaskId, null)
      }
      handleStatusChange(draggedTaskId, newStatus)
    }

    handleDragEnd()
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
          {/* Priority Filter Tabs */}
          <div style={{ display: 'flex', gap: '4px', background: '#1a1a1a', borderRadius: '10px', padding: '4px' }}>
            {[
              { key: '', label: 'All', color: '#94a3b8' },
              { key: 'URGENT', label: 'Urgent', color: priorityColors.URGENT },
              { key: 'HIGH', label: 'High', color: priorityColors.HIGH },
              { key: 'MEDIUM', label: 'Medium', color: priorityColors.MEDIUM },
              { key: 'LOW', label: 'Low', color: priorityColors.LOW },
            ].map(p => {
              const isActive = filterPriority === p.key
              const count = p.key ? tasks.filter(t => t.priority === p.key).length : tasks.length
              return (
                <button key={p.key} onClick={() => setFilterPriority(p.key)}
                  style={{
                    padding: '7px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s',
                    background: isActive ? `${p.color}18` : 'transparent',
                    border: isActive ? `1.5px solid ${p.color}` : '1.5px solid transparent',
                    color: isActive ? p.color : '#64748b',
                  }}>
                  {p.key && <span style={{ width: 7, height: 7, borderRadius: '50%', background: p.color, flexShrink: 0 }} />}
                  {p.label}
                  {count > 0 && <span style={{ fontSize: 10, fontWeight: 700, opacity: isActive ? 1 : 0.5 }}>{count}</span>}
                </button>
              )
            })}
          </div>

          {/* Team Member Filter */}
          {teamMembers.length > 0 && (
            <div style={{ display: 'flex', gap: '4px', background: '#1a1a1a', borderRadius: '10px', padding: '4px' }}>
              <button onClick={() => setFilterMember('')}
                style={{
                  padding: '7px 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.15s',
                  background: filterMember === '' ? 'rgba(241,245,249,0.08)' : 'transparent',
                  border: filterMember === '' ? '1.5px solid #f1f5f9' : '1.5px solid transparent',
                  color: filterMember === '' ? '#f1f5f9' : '#64748b',
                }}>All</button>
              {teamMembers.filter(tm => ['Joey', 'Sharyn', 'Diogo', 'Mason', 'Jay', 'Sydney'].includes(tm.name)).map(tm => {
                const isActive = filterMember === tm.id
                const count = tasks.filter(t => assignments.some(a => a.task_id === t.id && a.team_member_id === tm.id)).length
                return (
                  <button key={tm.id} onClick={() => setFilterMember(isActive ? '' : tm.id)}
                    style={{
                      padding: '7px 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 600,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s',
                      background: isActive ? `${tm.color}18` : 'transparent',
                      border: isActive ? `1.5px solid ${tm.color}` : '1.5px solid transparent',
                      color: isActive ? tm.color : '#64748b',
                    }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: tm.color, flexShrink: 0 }} />
                    {tm.name}
                    {count > 0 && <span style={{ fontSize: 10, fontWeight: 700, opacity: isActive ? 1 : 0.5 }}>{count}</span>}
                  </button>
                )
              })}
            </div>
          )}

          {/* Print Button */}
          <button
            onClick={() => window.open('/api/tasks/print', '_blank')}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', background: '#282a30', border: '1px solid #3f4451',
              borderRadius: '8px', color: '#94a3b8', fontSize: '13px', fontWeight: 500, cursor: 'pointer'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Print
          </button>

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

          {/* Archive Completed Button - Only show when there are completed tasks */}
          {stats.completed > 0 && (
            <button
              onClick={handleArchiveCompleted}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: '500',
                background: '#22c55e',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#16a34a'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#22c55e'
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
              Archive {stats.completed} Completed
            </button>
          )}

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
                onDragOver={handleColumnDragOver}
                onDrop={(e) => handleDrop(e, column.key)}
              >
                {getTasksByStatus(column.key).length > 0 ? (
                  getTasksByStatus(column.key).map(task => {
                    const isDropTarget = dragOverTaskId === task.id
                    const showAbove = isDropTarget && dragOverPosition === 'above'
                    const showBelow = isDropTarget && dragOverPosition === 'below'
                    const showNest = isDropTarget && dragOverPosition === 'nest'
                    const subtasks = getSubtasks(task.id)
                    const subtasksDone = subtasks.filter(s => s.status === 'COMPLETED').length
                    return (
                    <div key={task.id} style={{ marginBottom: '8px' }}>
                    <div
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleTaskDragOver(e, task.id)}
                      onDragLeave={() => { if (dragOverTaskId === task.id) { setDragOverTaskId(null); setDragOverPosition(null) } }}
                      onClick={() => openTaskDetail(task)}
                      style={{
                        position: 'relative',
                        background: showNest ? 'rgba(168,85,247,0.08)' : '#282a30',
                        borderTop: showAbove ? '2px solid #a855f7' : showNest ? '2px dashed #a855f7' : '1px solid rgba(148, 163, 184, 0.1)',
                        borderBottom: showBelow ? '2px solid #a855f7' : showNest ? '2px dashed #a855f7' : '1px solid rgba(148, 163, 184, 0.1)',
                        borderLeft: showNest ? '2px dashed #a855f7' : '1px solid rgba(148, 163, 184, 0.1)',
                        borderRight: showNest ? '2px dashed #a855f7' : '1px solid rgba(148, 163, 184, 0.1)',
                        borderRadius: '8px',
                        padding: '12px',
                        cursor: 'grab',
                        opacity: draggedTaskId === task.id ? 0.3 : 1,
                        transition: 'opacity 0.15s, transform 0.15s, box-shadow 0.15s, background 0.15s',
                        transform: draggedTaskId === task.id ? 'scale(0.97)' : showNest ? 'scale(1.02)' : 'scale(1)',
                        marginTop: showAbove ? '4px' : undefined,
                        boxShadow: showNest ? '0 0 0 3px rgba(168,85,247,0.15)' : 'none',
                      }}
                      onMouseEnter={(e) => {
                        if (!draggedTaskId) {
                          e.currentTarget.style.borderTop = '1px solid rgba(168,85,247,0.4)'
                          e.currentTarget.style.borderBottom = '1px solid rgba(168,85,247,0.4)'
                          e.currentTarget.style.borderLeft = '1px solid rgba(168,85,247,0.4)'
                          e.currentTarget.style.borderRight = '1px solid rgba(168,85,247,0.4)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!draggedTaskId) {
                          e.currentTarget.style.borderTop = '1px solid rgba(148, 163, 184, 0.1)'
                          e.currentTarget.style.borderBottom = '1px solid rgba(148, 163, 184, 0.1)'
                          e.currentTarget.style.borderLeft = '1px solid rgba(148, 163, 184, 0.1)'
                          e.currentTarget.style.borderRight = '1px solid rgba(148, 163, 184, 0.1)'
                        }
                      }}
                    >
                      {/* Task Header */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: '8px',
                        marginBottom: getAssignmentsForTask(task.id).length > 0 ? '4px' : '8px'
                      }}>
                        <div style={{
                          fontWeight: '500',
                          fontSize: '14px',
                          color: '#f1f5f9',
                          lineHeight: '1.3',
                          flex: 1,
                          minWidth: 0
                        }}>
                          {task.title}
                        </div>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: '4px',
                          flexShrink: 0,
                          background: `${priorityColors[task.priority as keyof typeof priorityColors] || priorityColors.MEDIUM}18`,
                          color: priorityColors[task.priority as keyof typeof priorityColors] || priorityColors.MEDIUM,
                          border: `1px solid ${priorityColors[task.priority as keyof typeof priorityColors] || priorityColors.MEDIUM}40`,
                          textTransform: 'uppercase',
                          letterSpacing: '0.03em',
                        }}>{task.priority}</span>
                      </div>

                      {/* Assigned Team + Leader */}
                      {(getAssignmentsForTask(task.id).length > 0 || task.task_leader_id) && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px', alignItems: 'center' }}>
                          {task.task_leader_id && (() => {
                            const detail = teamMembers.find(tm => tm.id === task.task_leader_id)
                            return detail ? (
                              <span style={{ fontSize: '10px', color: '#64748b' }}>Detail Holder: <span style={{ fontWeight: 600, color: detail.color }}>{detail.name}</span></span>
                            ) : null
                          })()}
                          {task.task_leader_id && getAssignmentsForTask(task.id).length > 0 && (
                            <span style={{ color: '#3f4451', fontSize: '10px' }}>·</span>
                          )}
                          {getAssignmentsForTask(task.id).map(tm => (
                            <span key={tm.id} style={{
                              fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px',
                              background: `${tm.color}15`, color: tm.color, border: `1px solid ${tm.color}30`,
                            }}>{tm.name}</span>
                          ))}
                        </div>
                      )}

                      {/* Task Meta */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'wrap'
                      }}>
                        {task.invoice_id && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation()
                              const doc = documents.find(d => d.doc_id === task.invoice_id && d.type === 'invoice')
                              if (doc) {
                                router.push(`/documents/${doc.id}`)
                              }
                            }}
                            style={{
                              fontSize: '12px',
                              color: '#64748b',
                              background: '#111111',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#22d3ee'
                              e.currentTarget.style.color = 'white'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '#111111'
                              e.currentTarget.style.color = '#64748b'
                            }}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '10px', height: '10px', marginRight: '3px' }}>
                              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                              <line x1="1" y1="10" x2="23" y2="10"></line>
                            </svg>
                            {task.invoice_id}
                          </span>
                        )}
                        {task.invoice_id && getCustomerName(task.invoice_id) && (
                          <span style={{
                            fontSize: '12px',
                            color: '#64748b'
                          }}>
                            {getCustomerName(task.invoice_id)}
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
                      {/* Subtask count badge */}
                      {subtasks.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(148,163,184,0.08)' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
                          <span style={{ fontSize: 11, color: '#64748b' }}>{subtasksDone}/{subtasks.length} subtasks</span>
                          <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'rgba(148,163,184,0.1)', overflow: 'hidden', marginLeft: 4 }}>
                            <div style={{ width: `${subtasks.length > 0 ? (subtasksDone / subtasks.length) * 100 : 0}%`, height: '100%', borderRadius: 2, background: subtasksDone === subtasks.length ? '#22c55e' : '#a855f7', transition: 'width 0.3s' }} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Subtasks */}
                    {subtasks.length > 0 && (
                      <div style={{ marginLeft: 16, borderLeft: '2px solid rgba(168,85,247,0.2)', paddingLeft: 8, marginTop: 2 }}>
                        {subtasks.map(sub => (
                          <div key={sub.id}
                            draggable
                            onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, sub.id) }}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => handleTaskDragOver(e, sub.id, true)}
                            onDragLeave={() => { if (dragOverTaskId === sub.id) { setDragOverTaskId(null); setDragOverPosition(null) } }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                              borderRadius: 6, marginBottom: 2, cursor: 'grab',
                              background: dragOverTaskId === sub.id ? 'rgba(168,85,247,0.06)' : 'rgba(255,255,255,0.02)',
                              borderTop: dragOverTaskId === sub.id && dragOverPosition === 'above' ? '2px solid #a855f7' : '2px solid transparent',
                              borderBottom: dragOverTaskId === sub.id && dragOverPosition === 'below' ? '2px solid #a855f7' : '2px solid transparent',
                              opacity: draggedTaskId === sub.id ? 0.3 : 1,
                              transition: 'opacity 0.15s',
                            }}>
                            <div onClick={(e) => { e.stopPropagation(); toggleSubtaskDone(sub) }}
                              style={{
                                width: 16, height: 16, borderRadius: 4, flexShrink: 0, cursor: 'pointer',
                                border: `1.5px solid ${sub.status === 'COMPLETED' ? '#22c55e' : 'rgba(148,163,184,0.3)'}`,
                                background: sub.status === 'COMPLETED' ? '#22c55e' : 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                              {sub.status === 'COMPLETED' && (
                                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" width="10" height="10"><polyline points="20 6 9 17 4 12"/></svg>
                              )}
                            </div>
                            <span
                              onClick={(e) => { e.stopPropagation(); openTaskDetail(sub) }}
                              style={{
                                fontSize: 12, color: sub.status === 'COMPLETED' ? '#64748b' : '#e2e8f0',
                                textDecoration: sub.status === 'COMPLETED' ? 'line-through' : 'none', flex: 1,
                                cursor: 'pointer',
                              }}
                            >{sub.title}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add subtask */}
                    {(subtasks.length > 0 || false) && addingSubtaskFor !== task.id && (
                      <button onClick={(e) => { e.stopPropagation(); setAddingSubtaskFor(task.id); setSubtaskTitle('') }}
                        style={{ marginLeft: 16, marginTop: 2, padding: '4px 10px', fontSize: 11, color: '#64748b', background: 'transparent', border: '1px dashed rgba(148,163,184,0.15)', borderRadius: 5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                        + Add subtask
                      </button>
                    )}
                    {addingSubtaskFor === task.id && (
                      <div style={{ marginLeft: 16, marginTop: 4, display: 'flex', gap: 6, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <input value={subtaskTitle} onChange={(e) => setSubtaskTitle(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleAddSubtask(task.id); if (e.key === 'Escape') { setAddingSubtaskFor(null); setSubtaskTitle('') } }}
                          placeholder="Subtask name..." autoFocus
                          style={{ flex: 1, padding: '5px 8px', fontSize: 12, background: '#111', border: '1.5px solid #a855f7', borderRadius: 5, color: '#f1f5f9', outline: 'none' }} />
                        <button onClick={() => handleAddSubtask(task.id)} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, background: '#a855f7', border: 'none', color: '#fff', borderRadius: 5, cursor: 'pointer' }}>Add</button>
                        <button onClick={() => { setAddingSubtaskFor(null); setSubtaskTitle('') }} style={{ padding: '4px 8px', fontSize: 11, background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', color: '#94a3b8', borderRadius: 5, cursor: 'pointer' }}>x</button>
                      </div>
                    )}
                    </div>
                  )})
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
      {currentView === 'list' && (() => {
        const parentTasks = filteredTasks.filter(t => !t.parent_task_id)
        const renderListRow = (task: Task, isSubtask: boolean = false) => {
          const subtasks = getSubtasks(task.id)
          return (
            <div key={task.id}>
              <div
                onClick={() => openTaskDetail(task)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: isSubtask ? '8px 16px 8px 48px' : '12px 16px',
                  borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                  gap: '12px',
                  cursor: 'pointer',
                  background: isSubtask ? 'rgba(148,163,184,0.02)' : 'transparent',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = isSubtask ? 'rgba(148,163,184,0.06)' : '#282a30' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = isSubtask ? 'rgba(148,163,184,0.02)' : 'transparent' }}
              >
                <div
                  onClick={(e) => { e.stopPropagation(); toggleSubtaskDone(task) }}
                  style={{
                    width: isSubtask ? '16px' : '20px', height: isSubtask ? '16px' : '20px',
                    borderRadius: isSubtask ? '4px' : '50%', flexShrink: 0, cursor: 'pointer',
                    border: `2px solid ${task.status === 'COMPLETED' ? '#22c55e' : 'rgba(148, 163, 184, 0.3)'}`,
                    background: task.status === 'COMPLETED' ? '#22c55e' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                  {task.status === 'COMPLETED' && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" width={isSubtask ? 10 : 12} height={isSubtask ? 10 : 12}><polyline points="20 6 9 17 4 12"/></svg>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: isSubtask ? '13px' : '14px', fontWeight: '500', color: '#f1f5f9',
                    textDecoration: task.status === 'COMPLETED' ? 'line-through' : 'none',
                    opacity: task.status === 'COMPLETED' ? 0.6 : 1
                  }}>{task.title}</div>
                  {!isSubtask && (getAssignmentsForTask(task.id).length > 0 || task.task_leader_id) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px', alignItems: 'center' }}>
                      {task.task_leader_id && (() => {
                        const detail = teamMembers.find(tm => tm.id === task.task_leader_id)
                        return detail ? <span style={{ fontSize: '10px', color: '#64748b' }}>Detail Holder: <span style={{ fontWeight: 600, color: detail.color }}>{detail.name}</span></span> : null
                      })()}
                      {task.task_leader_id && getAssignmentsForTask(task.id).length > 0 && <span style={{ color: '#3f4451', fontSize: '10px' }}>·</span>}
                      {getAssignmentsForTask(task.id).map(tm => (
                        <span key={tm.id} style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '8px', background: `${tm.color}15`, color: tm.color, border: `1px solid ${tm.color}30` }}>{tm.name}</span>
                      ))}
                    </div>
                  )}
                </div>
                {!isSubtask && (
                  <span style={{
                    padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '500',
                    background: `${statusColors[task.status as keyof typeof statusColors]}20`,
                    color: statusColors[task.status as keyof typeof statusColors]
                  }}>{columns.find(c => c.key === task.status)?.label || task.status}</span>
                )}
                <span style={{
                  padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '500',
                  background: `${priorityColors[task.priority as keyof typeof priorityColors]}20`,
                  color: priorityColors[task.priority as keyof typeof priorityColors]
                }}>{task.priority}</span>
                {!isSubtask && task.due_date && (
                  <span style={{ fontSize: '11px', color: isOverdue(task.due_date) && task.status !== 'COMPLETED' ? '#ef4444' : '#64748b', fontWeight: isOverdue(task.due_date) ? '500' : '400' }}>{formatDate(task.due_date)}</span>
                )}
              </div>
              {!isSubtask && subtasks.length > 0 && subtasks.map(sub => renderListRow(sub, true))}
            </div>
          )
        }
        return (
        <div>
          {parentTasks.length > 0 ? (
            <div style={{ background: '#1d1d1d', border: '1px solid rgba(148, 163, 184, 0.1)', borderRadius: '12px', overflow: 'hidden' }}>
              {parentTasks.map(task => renderListRow(task))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.5 }}>📋</div>
              <div>No tasks found</div>
            </div>
          )}
        </div>
        )
      })()}

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
                    <option value="STUCK">Stuck</option>
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

              {/* Assign Team */}
              {teamMembers.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#94a3b8', marginBottom: '8px' }}>Assign To</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {teamMembers.map(tm => {
                      const isAssigned = modalAssignments.includes(tm.id)
                      return (
                        <button
                          key={tm.id}
                          type="button"
                          onClick={() => toggleModalAssignment(tm.id)}
                          style={{
                            padding: '7px 14px',
                            borderRadius: '8px',
                            border: `2px solid ${isAssigned ? tm.color : 'rgba(148,163,184,0.15)'}`,
                            background: isAssigned ? `${tm.color}18` : '#282a30',
                            color: isAssigned ? tm.color : '#64748b',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isAssigned ? tm.color : '#3f4451' }} />
                          {tm.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Task Leader */}
              {teamMembers.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#94a3b8', marginBottom: '4px' }}>Detail Holder</label>
                  <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 8px 0' }}>Who has the details on this task</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setModalData({ ...modalData, task_leader_id: '' })}
                      style={{
                        padding: '7px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                        border: !modalData.task_leader_id ? '2px solid #f1f5f9' : '1px solid rgba(148,163,184,0.15)',
                        background: !modalData.task_leader_id ? 'rgba(241,245,249,0.08)' : '#282a30',
                        color: !modalData.task_leader_id ? '#f1f5f9' : '#64748b',
                      }}
                    >None</button>
                    {teamMembers.map(tm => {
                      const isLeader = modalData.task_leader_id === tm.id
                      return (
                        <button
                          key={tm.id}
                          type="button"
                          onClick={() => setModalData({ ...modalData, task_leader_id: tm.id })}
                          style={{
                            padding: '7px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                            border: isLeader ? `2px solid ${tm.color}` : '1px solid rgba(148,163,184,0.15)',
                            background: isLeader ? `${tm.color}18` : '#282a30',
                            color: isLeader ? tm.color : '#64748b',
                            display: 'flex', alignItems: 'center', gap: '6px',
                          }}
                        >
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isLeader ? tm.color : '#3f4451' }} />
                          {tm.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* File Attachments */}
              <div style={{ marginTop: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#94a3b8', marginBottom: '8px' }}>Files</label>
                {taskAttachments.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                    {taskAttachments.map((att, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: '#282a30', borderRadius: '6px', fontSize: '12px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        <a href={att.url} target="_blank" rel="noopener noreferrer" style={{ color: '#94a3b8', textDecoration: 'none', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.filename}</a>
                        <button onClick={() => setTaskAttachments(prev => prev.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px', padding: 0 }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                <input type="file" ref={taskFileInputRef} onChange={handleTaskFileUpload} multiple style={{ display: 'none' }} />
                <button type="button" onClick={() => taskFileInputRef.current?.click()} disabled={uploadingTaskFile} style={{
                  padding: '8px 14px', background: '#282a30', border: '1px solid rgba(148,163,184,0.15)', borderRadius: '8px',
                  color: '#94a3b8', fontSize: '12px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                  {uploadingTaskFile ? 'Uploading...' : 'Attach File'}
                </button>
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
