'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

type Task = {
  id: string
  title: string
  status: string
  priority: string
  document_id?: string | null
  line_item_id?: string | null
  created_at: string
  due_date?: string | null
  description?: string | null
  sort_order?: number
  template_task_key?: string
  auto_generated?: boolean
  started_at?: string | null
  time_spent_minutes?: number
  completed_at?: string | null
  depends_on_task_id?: string | null
  line_items?: {
    id: string
    description: string
    category: string
  } | null
}

type ProductionJob = {
  id: string
  doc_number: number
  doc_type: string
  status: string
  customer_id: string
  total: number
  category: string
  paid_at?: string
  customer_name: string
  vehicle_description?: string | null
  project_description?: string | null
  snoozed?: boolean
  snoozed_at?: string | null
}

type ProductionFlowProps = {
  initialJobs: ProductionJob[]
  initialTasks: Task[]
}

type LineItemGroup = {
  lineItemId: string
  lineItemDescription: string
  category: string
  tasks: Task[]
}

export default function ProductionFlow({ initialJobs, initialTasks }: ProductionFlowProps) {
  const router = useRouter()
  const [jobs, setJobs] = useState<ProductionJob[]>(initialJobs)
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortBy, setSortBy] = useState('invoice-desc')
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set())
  const [collapsedLineItems, setCollapsedLineItems] = useState<Set<string>>(() => {
    // Initialize with all line item IDs to collapse them by default
    const lineItemIds = new Set<string>()
    initialTasks.forEach(task => {
      const lineItemId = task.line_item_id || 'no-line-item'
      lineItemIds.add(lineItemId)
    })
    return lineItemIds
  })
  const [lineItemOrder, setLineItemOrder] = useState<Record<string, string[]>>({})
  const [draggedItem, setDraggedItem] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(Date.now())
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Update current time every second for timer display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Category color map (matching calendar colors)
  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      'PPF': '#ec4899',
      'FULL_PPF': '#ec4899',
      'PARTIAL_PPF': '#ec4899',
      'VINYL_WRAP': '#a855f7',
      'FULL_WRAP': '#a855f7',
      'CHROME_DELETE': '#a855f7',
      'COLOR_CHANGE': '#a855f7',
      'COMMERCIAL_WRAP': '#a855f7',
      'WINDOW_TINT': '#f59e0b',
      'RESIDENTIAL_TINT': '#f59e0b',
      'COMMERCIAL_TINT': '#f59e0b',
      'TINT': '#f59e0b',
      'SIGNAGE': '#14b8a6',
      'CHANNEL_LETTERS': '#14b8a6',
      'MONUMENT_SIGN': '#14b8a6',
      'APPAREL': '#3b82f6',
      'CERAMIC_COATING': '#22c55e',
      'DETAILING': '#22c55e'
    }
    return colors[category] || '#6b7280' // Gray for unknown
  }

  // Format category label
  const formatCategoryLabel = (category: string): string => {
    const specialCases: Record<string, string> = {
      'PPF': 'PPF',
      'TINT': 'Window Tint'
    }
    if (specialCases[category]) return specialCases[category]
    return category?.split('_').map(word => word.charAt(0) + word.slice(1).toLowerCase()).join(' ') || 'General'
  }

  // Group tasks by line item for a job
  const getLineItemGroups = (jobId: string): LineItemGroup[] => {
    const jobTasks = tasks.filter(t => t.document_id === jobId)
    const groups = new Map<string, LineItemGroup>()

    jobTasks.forEach(task => {
      const lineItemId = task.line_item_id || 'no-line-item'
      if (!groups.has(lineItemId)) {
        groups.set(lineItemId, {
          lineItemId,
          lineItemDescription: task.line_items?.description || 'Unknown line item',
          category: task.line_items?.category || '',
          tasks: []
        })
      }
      groups.get(lineItemId)!.tasks.push(task)
    })

    // Sort tasks within each group by sort_order
    groups.forEach(group => {
      group.tasks.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    })

    let groupArray = Array.from(groups.values())

    // Apply custom order if it exists
    if (lineItemOrder[jobId]) {
      const order = lineItemOrder[jobId]
      groupArray.sort((a, b) => {
        const indexA = order.indexOf(a.lineItemId)
        const indexB = order.indexOf(b.lineItemId)
        if (indexA === -1) return 1
        if (indexB === -1) return -1
        return indexA - indexB
      })
    }

    return groupArray
  }

  // Toggle line item collapse
  const toggleLineItemCollapse = (lineItemId: string) => {
    setCollapsedLineItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(lineItemId)) {
        newSet.delete(lineItemId)
      } else {
        newSet.add(lineItemId)
      }
      return newSet
    })
  }

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, lineItemId: string) => {
    setDraggedItem(lineItemId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, targetLineItemId: string, jobId: string) => {
    e.preventDefault()
    if (!draggedItem || draggedItem === targetLineItemId) return

    const groups = getLineItemGroups(jobId)
    const currentOrder = lineItemOrder[jobId] || groups.map(g => g.lineItemId)

    const draggedIndex = currentOrder.indexOf(draggedItem)
    const targetIndex = currentOrder.indexOf(targetLineItemId)

    if (draggedIndex === -1 || targetIndex === -1) return

    const newOrder = [...currentOrder]
    newOrder.splice(draggedIndex, 1)
    newOrder.splice(targetIndex, 0, draggedItem)

    setLineItemOrder(prev => ({
      ...prev,
      [jobId]: newOrder
    }))

    setDraggedItem(null)
  }

  const handleDragEnd = () => {
    setDraggedItem(null)
  }

  // Calculate progress for a line item group
  const calculateProgress = (groupTasks: Task[]) => {
    if (groupTasks.length === 0) return { completed: 0, total: 0, percent: 0 }
    const completed = groupTasks.filter(t => t.status === 'COMPLETED').length
    return {
      completed,
      total: groupTasks.length,
      percent: Math.round((completed / groupTasks.length) * 100)
    }
  }

  // Check if task is blocked by dependency
  const isTaskBlocked = (task: Task): boolean => {
    if (!task.depends_on_task_id) return false
    const prerequisiteTask = tasks.find(t => t.id === task.depends_on_task_id)
    return prerequisiteTask?.status !== 'COMPLETED'
  }

  // Get prerequisite task for a blocked task
  const getPrerequisiteTask = (task: Task): Task | undefined => {
    if (!task.depends_on_task_id) return undefined
    return tasks.find(t => t.id === task.depends_on_task_id)
  }

  // Calculate elapsed time for running timer
  const getElapsedMinutes = (task: Task): number => {
    if (!task.started_at) return task.time_spent_minutes || 0
    const startTime = new Date(task.started_at).getTime()
    const elapsed = Math.floor((currentTime - startTime) / 1000 / 60)
    return (task.time_spent_minutes || 0) + elapsed
  }

  // Format time display
  const formatTime = (minutes: number): string => {
    if (minutes === 0) return '0m'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
    }
    return `${mins}m`
  }

  // Start timer for a task
  const startTimer = async (taskId: string) => {
    try {
      await supabase.from('tasks').update({
        started_at: new Date().toISOString()
      }).eq('id', taskId)

      // Optimistic update
      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, started_at: new Date().toISOString() } : t
      ))
    } catch (error) {
      console.error('Error starting timer:', error)
    }
  }

  // Stop timer for a task
  const stopTimer = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task || !task.started_at) return

    const startTime = new Date(task.started_at).getTime()
    const elapsedMinutes = Math.floor((Date.now() - startTime) / 1000 / 60)
    const totalMinutes = (task.time_spent_minutes || 0) + elapsedMinutes

    try {
      await supabase.from('tasks').update({
        started_at: null,
        time_spent_minutes: totalMinutes
      }).eq('id', taskId)

      // Optimistic update
      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, started_at: null, time_spent_minutes: totalMinutes } : t
      ))
    } catch (error) {
      console.error('Error stopping timer:', error)
    }
  }

  // Archive line item and all its tasks
  const archiveLineItem = async (lineItemId: string, jobId: string) => {
    const lineItemTasks = tasks.filter(t => t.line_item_id === lineItemId)

    if (!confirm(`Archive this line item and all ${lineItemTasks.length} tasks?`)) return

    try {
      console.log('[ProductionFlow] Archiving line item:', lineItemId)

      // Archive all tasks for this line item
      const response = await fetch('/api/tasks/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds: lineItemTasks.map(t => t.id) })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[ProductionFlow] Failed to archive:', errorText)
        alert('Failed to archive line item')
        return
      }

      console.log('[ProductionFlow] Line item archived successfully')

      // Optimistically remove tasks from UI
      setTasks(prev => prev.filter(t => t.line_item_id !== lineItemId))

      // Refresh to get updated data
      router.refresh()
    } catch (error) {
      console.error('[ProductionFlow] Error archiving line item:', error)
      alert('Failed to archive line item')
    }
  }

  // Snooze/unsnooze a production job
  const toggleSnooze = async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId)
    if (!job) return
    const newSnoozed = !job.snoozed
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, snoozed: newSnoozed, snoozed_at: newSnoozed ? new Date().toISOString() : null } : j))
    try {
      const res = await fetch('/api/documents/snooze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: jobId, type: 'document', snoozed: newSnoozed })
      })
      if (!res.ok) console.error('Failed to toggle snooze:', await res.text())
      else router.refresh()
    } catch (err) {
      console.error('Failed to toggle snooze:', err)
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, snoozed: !newSnoozed } : j))
    }
  }

  // Get abbreviated step labels
  const getStepLabel = (taskTitle: string): string => {
    const lower = taskTitle.toLowerCase()
    if (lower.includes('verify')) return 'Verify'
    if (lower.includes('design') || lower.includes('artwork')) return 'Design'
    if (lower.includes('print')) return 'Print'
    if (lower.includes('outgas')) return 'Outgas'
    if (lower.includes('laminate')) return 'Laminate'
    if (lower.includes('cutdown') || lower.includes('cut')) return 'Cut'
    if (lower.includes('prep')) return 'Prep'
    if (lower.includes('install')) return 'Install'
    if (lower.includes('quality') || lower.includes('qc')) return 'QC'
    if (lower.includes('pickup')) return 'Pickup'
    if (lower.includes('order')) return 'Order'
    if (lower.includes('pattern')) return 'Patterns'
    if (lower.includes('plot')) return 'Plot'
    return taskTitle.split(' ')[0].substring(0, 8)
  }

  // Confetti animation
  const launchConfetti = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    canvas.style.display = 'block'

    const particles: Array<{
      x: number
      y: number
      vx: number
      vy: number
      color: string
      size: number
      rotation: number
      rotationSpeed: number
    }> = []

    const colors = ['#22d3ee', '#a855f7', '#ec4899', '#22c55e', '#f59e0b']

    for (let i = 0; i < 100; i++) {
      particles.push({
        x: canvas.width / 2,
        y: canvas.height / 2,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10 - 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10
      })
    }

    let animationId: number
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      particles.forEach((p, index) => {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.3 // gravity
        p.rotation += p.rotationSpeed

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation * Math.PI / 180)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
        ctx.restore()

        if (p.y > canvas.height) {
          particles.splice(index, 1)
        }
      })

      if (particles.length > 0) {
        animationId = requestAnimationFrame(animate)
      } else {
        canvas.style.display = 'none'
        cancelAnimationFrame(animationId)
      }
    }

    animate()
  }

  // Toggle task completion
  const toggleTask = async (taskId: string, lineItemTasks: Task[]) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    // Prevent completing blocked tasks
    if (task.status !== 'COMPLETED' && isTaskBlocked(task)) {
      const prereq = getPrerequisiteTask(task)
      alert(`This task is blocked. Please complete "${prereq?.title}" first.`)
      return
    }

    const newStatus = task.status === 'COMPLETED' ? 'TODO' : 'COMPLETED'

    // If completing task and timer is running, stop it first
    let finalTimeSpent = task.time_spent_minutes || 0
    if (newStatus === 'COMPLETED' && task.started_at) {
      const startTime = new Date(task.started_at).getTime()
      const elapsedMinutes = Math.floor((Date.now() - startTime) / 1000 / 60)
      finalTimeSpent = (task.time_spent_minutes || 0) + elapsedMinutes
    }

    // Optimistic update
    setTasks(prev => prev.map(t =>
      t.id === taskId ? {
        ...t,
        status: newStatus,
        started_at: newStatus === 'COMPLETED' ? null : t.started_at,
        time_spent_minutes: newStatus === 'COMPLETED' ? finalTimeSpent : t.time_spent_minutes
      } : t
    ))

    // Save to database
    try {
      const updates: any = {
        status: newStatus,
        completed_at: newStatus === 'COMPLETED' ? new Date().toISOString() : null
      }

      if (newStatus === 'COMPLETED') {
        updates.started_at = null
        updates.time_spent_minutes = finalTimeSpent
      }

      await supabase.from('tasks').update(updates).eq('id', taskId)

      // Check if all tasks in this line item are now completed
      if (newStatus === 'COMPLETED') {
        const allCompleted = lineItemTasks.every(t =>
          t.id === taskId || t.status === 'COMPLETED'
        )
        if (allCompleted) {
          launchConfetti()
        }
      }
    } catch (error) {
      // Revert on error
      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, status: task.status } : t
      ))
    }
  }

  // Toggle expanded state
  const toggleExpanded = (jobId: string) => {
    setExpandedJobs(prev => {
      const newSet = new Set(prev)
      if (newSet.has(jobId)) {
        newSet.delete(jobId)
      } else {
        newSet.add(jobId)
      }
      return newSet
    })
  }

  // Calculate job progress
  const getJobProgress = (jobId: string) => {
    const jobTasks = tasks.filter(t => t.document_id === jobId)
    if (jobTasks.length === 0) return { completed: 0, total: 0, percent: 0 }
    const completed = jobTasks.filter(t => t.status === 'COMPLETED').length
    return {
      completed,
      total: jobTasks.length,
      percent: Math.round((completed / jobTasks.length) * 100)
    }
  }

  // Filter jobs
  const filteredJobs = jobs.filter(job => {
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      const customerName = (job.customer_name || '').toLowerCase()
      const vehicleInfo = (job.vehicle_description || '').toLowerCase()
      const invoiceNum = String(job.doc_number).toLowerCase()

      if (!customerName.includes(search) && !vehicleInfo.includes(search) && !invoiceNum.includes(search)) {
        return false
      }
    }

    // Category filter
    if (categoryFilter) {
      if (job.category !== categoryFilter) return false
    }

    // Status filter
    if (statusFilter) {
      const progress = getJobProgress(job.id)
      if (statusFilter === 'not-started' && progress.percent > 0) return false
      if (statusFilter === 'in-progress' && (progress.percent === 0 || progress.percent === 100)) return false
      if (statusFilter === 'completed' && progress.percent !== 100) return false
    }

    return true
  })

  // Sort jobs
  const sortedJobs = [...filteredJobs].sort((a, b) => {
    switch (sortBy) {
      case 'customer-asc':
        return (a.customer_name || '').localeCompare(b.customer_name || '')
      case 'customer-desc':
        return (b.customer_name || '').localeCompare(a.customer_name || '')
      case 'invoice-asc':
        return a.doc_number - b.doc_number
      case 'invoice-desc':
        return b.doc_number - a.doc_number
      case 'category-asc':
        return (a.category || '').localeCompare(b.category || '')
      case 'category-desc':
        return (b.category || '').localeCompare(a.category || '')
      case 'progress-asc':
        return getJobProgress(a.id).percent - getJobProgress(b.id).percent
      case 'progress-desc':
        return getJobProgress(b.id).percent - getJobProgress(a.id).percent
      default:
        return 0
    }
  })

  // Get unique categories
  const uniqueCategories = Array.from(new Set(jobs.map(j => j.category).filter(Boolean)))

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('')
    setCategoryFilter('')
    setStatusFilter('')
    setSortBy('invoice-desc')
  }

  // Check if any filters are active
  const hasActiveFilters = searchTerm || categoryFilter || statusFilter || sortBy !== 'invoice-desc'

  const stats = {
    total: jobs.length,
    active: jobs.length
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', position: 'relative' }}>
      {/* Confetti Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 9999,
          display: 'none'
        }}
      />

      {/* SVG Defs for gradients */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="50%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
      </svg>

      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <h1 style={{
              fontSize: '28px',
              fontWeight: '700',
              marginBottom: '4px',
              color: '#f1f5f9'
            }}>
              Production <span style={{
                background: 'linear-gradient(135deg, #22d3ee, #a855f7)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>Flow</span>
            </h1>
            <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
              Track and manage jobs through production
            </p>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: '32px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '32px',
                fontWeight: '700',
                fontFamily: '"Courier New", monospace',
                background: 'linear-gradient(135deg, #ec4899, #a855f7)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                {stats.active}
              </div>
              <div style={{
                fontSize: '11px',
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '1.5px'
              }}>
                Active
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', width: '100%', marginTop: '24px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search by customer, vehicle, or invoice..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '10px 14px',
              background: '#1d1d1d',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: '10px',
              color: '#f1f5f9',
              fontSize: '14px',
              flex: 1,
              minWidth: '150px',
              maxWidth: '350px'
            }}
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{
              padding: '10px 14px',
              background: '#1d1d1d',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: '10px',
              color: '#f1f5f9',
              fontSize: '14px',
              cursor: 'pointer',
              minWidth: '150px'
            }}
          >
            <option value="">All Categories</option>
            {uniqueCategories.map(cat => (
              <option key={cat} value={cat}>{formatCategoryLabel(cat)}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '10px 14px',
              background: '#1d1d1d',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: '10px',
              color: '#f1f5f9',
              fontSize: '14px',
              cursor: 'pointer',
              minWidth: '150px'
            }}
          >
            <option value="">All Status</option>
            <option value="not-started">Not Started</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              padding: '10px 14px',
              background: '#1d1d1d',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: '10px',
              color: '#f1f5f9',
              fontSize: '14px',
              cursor: 'pointer',
              minWidth: '180px'
            }}
          >
            <option value="invoice-desc">Invoice # (Newest)</option>
            <option value="invoice-asc">Invoice # (Oldest)</option>
            <option value="customer-asc">Customer (A-Z)</option>
            <option value="customer-desc">Customer (Z-A)</option>
            <option value="category-asc">Category (A-Z)</option>
            <option value="category-desc">Category (Z-A)</option>
            <option value="progress-asc">Progress (Low-High)</option>
            <option value="progress-desc">Progress (High-Low)</option>
          </select>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              style={{
                padding: '10px 16px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '10px',
                color: '#ef4444',
                fontSize: '14px',
                cursor: 'pointer',
                fontWeight: '500',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)'
              }}
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Production Queue */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {sortedJobs.length === 0 ? (
          <div style={{
            background: '#111111',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: '20px',
            padding: '60px 20px',
            textAlign: 'center',
            color: '#64748b'
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" style={{ width: '48px', height: '48px', margin: '0 auto 12px' }}>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <div>{hasActiveFilters ? 'No jobs match your filters' : 'No jobs in production'}</div>
            <div style={{ fontSize: '13px', marginTop: '8px' }}>
              {hasActiveFilters ? 'Try adjusting your search or filters' : 'Jobs appear here when invoices are paid or manually moved to production'}
            </div>
          </div>
        ) : (
          sortedJobs
            .filter(job => {
              // Only show jobs that have at least one line item group with tasks
              const lineItemGroups = getLineItemGroups(job.id)
              return lineItemGroups.length > 0
            })
            .map(job => {
            const lineItemGroups = getLineItemGroups(job.id)
            const isExpanded = expandedJobs.has(job.id)

            return (
              <div
                key={job.id}
                style={{
                  background: '#111111',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: '20px',
                  overflow: 'hidden',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.3)'
                  e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.2)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                {/* Card Header - Job Info */}
                <div
                  onClick={() => router.push(`/documents/${job.id}`)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '24px',
                    gap: '24px',
                    borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#1d1d1d'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                      <span style={{
                        fontSize: '11px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        fontWeight: '700',
                        background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.15), rgba(168, 85, 247, 0.15))',
                        color: '#22d3ee',
                        border: '1px solid rgba(34, 211, 238, 0.3)'
                      }}>
                        #{job.doc_number}
                      </span>
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: '600', color: '#f1f5f9', marginBottom: '4px' }}>
                      {job.customer_name}
                    </div>
                    <div style={{ fontSize: '14px', color: '#64748b' }}>
                      {job.vehicle_description || 'No vehicle description'}
                    </div>
                  </div>
                  {/* Snooze button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSnooze(job.id) }}
                    title={job.snoozed ? 'Unsnooze - restore to action queue' : 'Snooze - hide from action queue'}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '8px 14px', borderRadius: '8px',
                      border: job.snoozed ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(148, 163, 184, 0.2)',
                      background: job.snoozed ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                      color: job.snoozed ? '#f59e0b' : '#64748b',
                      fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                      transition: 'all 0.15s', flexShrink: 0
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#f59e0b'; e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.4)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = job.snoozed ? '#f59e0b' : '#64748b'; e.currentTarget.style.borderColor = job.snoozed ? 'rgba(245, 158, 11, 0.3)' : 'rgba(148, 163, 184, 0.2)' }}
                  >
                    {job.snoozed ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 3l14 0" />
                        <path d="M5 3l14 14" />
                        <path d="M5 17l14 0" />
                      </svg>
                    )}
                    {job.snoozed ? 'Unsnooze' : 'Snooze'}
                  </button>
                </div>

                {/* Line Item Groups */}
                {lineItemGroups.map((group, groupIndex) => {
                  const progress = calculateProgress(group.tasks)
                  const nextTaskIndex = group.tasks.findIndex(t => t.status !== 'COMPLETED')
                  const isCollapsed = collapsedLineItems.has(group.lineItemId)
                  const isDragging = draggedItem === group.lineItemId
                  const categoryColor = getCategoryColor(group.category)

                  // Progress ring calculations
                  const circumference = 188.5
                  const strokeOffset = circumference - (progress.percent / 100) * circumference

                  return (
                    <div
                      key={group.lineItemId}
                      draggable
                      onDragStart={(e) => handleDragStart(e, group.lineItemId)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, group.lineItemId, job.id)}
                      onDragEnd={handleDragEnd}
                      style={{
                        borderTop: groupIndex > 0 ? '2px solid rgba(148, 163, 184, 0.3)' : 'none',
                        marginTop: groupIndex > 0 ? '12px' : '0',
                        opacity: isDragging ? 0.5 : 1,
                        cursor: 'grab',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {/* Line Item Header */}
                      <div style={{
                        padding: '20px 24px',
                        background: isDragging ? '#1d1d1d' : '#0a0a0a',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '20px',
                        borderLeft: `4px solid ${categoryColor}`,
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (!isDragging) e.currentTarget.style.background = '#151515'
                      }}
                      onMouseLeave={(e) => {
                        if (!isDragging) e.currentTarget.style.background = '#0a0a0a'
                      }}>
                        {/* Progress Ring */}
                        <div style={{ position: 'relative', width: '64px', height: '64px', flexShrink: 0 }}>
                          <svg width="64" height="64" style={{ transform: 'rotate(-90deg)' }}>
                            <circle
                              cx="32"
                              cy="32"
                              r="28"
                              fill="none"
                              stroke="#27272a"
                              strokeWidth="5"
                            />
                            <circle
                              cx="32"
                              cy="32"
                              r="28"
                              fill="none"
                              stroke={categoryColor}
                              strokeWidth="5"
                              strokeLinecap="round"
                              strokeDasharray={circumference}
                              strokeDashoffset={strokeOffset}
                              style={{
                                transition: 'stroke-dashoffset 0.6s ease',
                                filter: `drop-shadow(0 0 6px ${categoryColor}80)`
                              }}
                            />
                          </svg>
                          <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            fontSize: '14px',
                            fontWeight: '700',
                            color: '#f1f5f9'
                          }}>
                            {progress.percent}%
                          </div>
                        </div>

                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: '15px',
                            fontWeight: '600',
                            color: '#f1f5f9',
                            marginBottom: '4px'
                          }}>
                            {group.lineItemDescription}
                          </div>
                          <div style={{
                            fontSize: '12px',
                            color: '#64748b',
                            textTransform: 'uppercase',
                            letterSpacing: '1px'
                          }}>
                            {formatCategoryLabel(group.category)} • {progress.completed}/{progress.total} tasks
                          </div>
                        </div>

                        {/* Archive Button - Shows when 100% complete */}
                        {progress.percent === 100 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              archiveLineItem(group.lineItemId, job.id)
                            }}
                            style={{
                              background: '#22c55e',
                              border: '1px solid rgba(34, 197, 94, 0.3)',
                              borderRadius: '8px',
                              padding: '8px 12px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              transition: 'all 0.2s ease',
                              color: 'white',
                              fontSize: '13px',
                              fontWeight: '600'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#16a34a'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '#22c55e'
                            }}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px' }}>
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              <line x1="10" y1="11" x2="10" y2="17"></line>
                              <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                            Archive
                          </button>
                        )}

                        {/* Collapse/Expand Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleLineItemCollapse(group.lineItemId)
                          }}
                          style={{
                            background: 'rgba(148, 163, 184, 0.1)',
                            border: '1px solid rgba(148, 163, 184, 0.2)',
                            borderRadius: '8px',
                            padding: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease',
                            color: '#64748b'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(34, 211, 238, 0.15)'
                            e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.3)'
                            e.currentTarget.style.color = '#22d3ee'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(148, 163, 184, 0.1)'
                            e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.2)'
                            e.currentTarget.style.color = '#64748b'
                          }}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            style={{
                              width: '18px',
                              height: '18px',
                              transition: 'transform 0.3s ease',
                              transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'
                            }}
                          >
                            <path d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>

                      {/* Pipeline Section */}
                      {!isCollapsed && group.tasks.length > 0 && (
                        <div style={{
                          padding: '24px',
                          background: '#1d1d1d'
                        }}>
                          <div style={{ position: 'relative', padding: '0 10px' }}>
                            {/* Pipeline Track */}
                            <div style={{
                              position: 'absolute',
                              top: '50%',
                              left: '20px',
                              right: '20px',
                              height: '4px',
                              background: '#27272a',
                              borderRadius: '2px',
                              transform: 'translateY(-50%)',
                              zIndex: 0
                            }}>
                              <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                height: '100%',
                                background: 'linear-gradient(90deg, #22d3ee, #a855f7)',
                                borderRadius: '2px',
                                width: `${progress.percent}%`,
                                transition: 'width 0.6s ease',
                                boxShadow: '0 0 20px rgba(34, 211, 238, 0.4)'
                              }} />
                            </div>

                            {/* Pipeline Steps */}
                            <div style={{ display: 'flex', alignItems: 'center', position: 'relative', zIndex: 1 }}>
                              {group.tasks.map((task, i) => {
                                const isDone = task.status === 'COMPLETED'
                                const isActive = i === nextTaskIndex

                                return (
                                  <div key={task.id} style={{
                                    flex: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center'
                                  }}>
                                    <div style={{
                                      width: '16px',
                                      height: '16px',
                                      borderRadius: '50%',
                                      background: isDone ? '#22c55e' : '#111111',
                                      border: `3px solid ${isDone ? '#22c55e' : isActive ? '#22d3ee' : '#27272a'}`,
                                      transition: 'all 0.3s ease',
                                      boxShadow: isDone ? '0 0 12px rgba(34, 197, 94, 0.5)' : isActive ? '0 0 12px rgba(34, 211, 238, 0.4)' : 'none'
                                    }} />
                                    <div style={{
                                      marginTop: '10px',
                                      fontSize: '10px',
                                      color: isDone ? '#22c55e' : isActive ? '#22d3ee' : '#64748b',
                                      textAlign: 'center',
                                      maxWidth: '70px',
                                      lineHeight: 1.3,
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.5px',
                                      fontWeight: isDone || isActive ? '600' : '400'
                                    }}>
                                      {getStepLabel(task.title)}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Task List */}
                      {!isCollapsed && group.tasks.length > 0 && (
                        <div style={{ padding: '20px 24px' }}>
                          {group.tasks.map((task, i) => {
                            const isCompleted = task.status === 'COMPLETED'
                            const isBlocked = isTaskBlocked(task)
                            const isNext = i === nextTaskIndex && !isCompleted && !isBlocked

                            return (
                              <div
                                key={task.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '16px',
                                  padding: '14px 0',
                                  borderBottom: i < group.tasks.length - 1 ? '1px solid rgba(148, 163, 184, 0.2)' : 'none',
                                  transition: 'background 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                                  e.currentTarget.style.marginLeft = '-24px'
                                  e.currentTarget.style.marginRight = '-24px'
                                  e.currentTarget.style.paddingLeft = '24px'
                                  e.currentTarget.style.paddingRight = '24px'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'transparent'
                                  e.currentTarget.style.marginLeft = '0'
                                  e.currentTarget.style.marginRight = '0'
                                  e.currentTarget.style.paddingLeft = '0'
                                  e.currentTarget.style.paddingRight = '0'
                                }}
                              >
                                {/* Checkbox */}
                                <div
                                  onClick={() => !isBlocked && toggleTask(task.id, group.tasks)}
                                  style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '8px',
                                    border: `2px solid ${isCompleted ? '#22c55e' : isBlocked ? '#f59e0b' : '#64748b'}`,
                                    background: isCompleted ? '#22c55e' : isBlocked ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: isBlocked ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s ease',
                                    flexShrink: 0,
                                    opacity: isBlocked ? 0.7 : 1
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isCompleted && !isBlocked) {
                                      e.currentTarget.style.borderColor = '#22d3ee'
                                      e.currentTarget.style.background = 'rgba(34, 211, 238, 0.1)'
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isCompleted && !isBlocked) {
                                      e.currentTarget.style.borderColor = '#64748b'
                                      e.currentTarget.style.background = 'transparent'
                                    }
                                  }}
                                >
                                  {isCompleted && (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" style={{ width: '14px', height: '14px' }}>
                                      <path d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                  {isBlocked && !isCompleted && (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" style={{ width: '12px', height: '12px' }}>
                                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                    </svg>
                                  )}
                                </div>

                                {/* Task Content */}
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <span style={{
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    color: '#f1f5f9',
                                    textDecoration: isCompleted ? 'line-through' : 'none',
                                    opacity: isCompleted ? 0.6 : isBlocked ? 0.5 : 1
                                  }}>
                                    {task.title}
                                  </span>
                                  {isBlocked && (
                                    <span style={{
                                      fontSize: '9px',
                                      padding: '3px 8px',
                                      borderRadius: '6px',
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.5px',
                                      fontWeight: '600',
                                      background: 'rgba(245, 158, 11, 0.15)',
                                      color: '#f59e0b',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}>
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '10px', height: '10px' }}>
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                      </svg>
                                      Blocked
                                    </span>
                                  )}
                                  {isNext && (
                                    <span style={{
                                      fontSize: '9px',
                                      padding: '3px 8px',
                                      borderRadius: '6px',
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.5px',
                                      fontWeight: '600',
                                      background: 'rgba(34, 211, 238, 0.15)',
                                      color: '#22d3ee'
                                    }}>
                                      Next
                                    </span>
                                  )}
                                </div>

                                {/* Timer Section - Removed per user request */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {/* Start button removed - not needed in production flow */}
                                  {isCompleted && task.time_spent_minutes && task.time_spent_minutes > 0 && (
                                    <span style={{
                                      fontSize: '11px',
                                      color: '#64748b',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}>
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '12px', height: '12px' }}>
                                        <circle cx="12" cy="12" r="10" />
                                        <polyline points="12 6 12 12 16 14" />
                                      </svg>
                                      {formatTime(task.time_spent_minutes)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
