'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Task = {
  id: string
  title: string
  status: string
  priority: string
  invoice_id?: string | null
  created_at: string
  due_date?: string | null
  description?: string | null
}

type ProductionJob = {
  id: string
  doc_id: string
  doc_number: number
  type: string
  status: string
  customer_id: string
  total: number
  category: string
  paid_at?: string
  customers: { id: string; display_name: string }[] | null
  vehicle_info?: string | null
}

type ProductionFlowProps = {
  initialJobs: ProductionJob[]
  initialTasks: Task[]
}

export default function ProductionFlow({ initialJobs, initialTasks }: ProductionFlowProps) {
  const router = useRouter()
  const [jobs, setJobs] = useState<ProductionJob[]>(initialJobs)
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set())

  // Format category label
  const formatCategoryLabel = (category: string): string => {
    const specialCases: Record<string, string> = {
      'PPF': 'PPF',
      'TINT': 'Window Tint'
    }
    if (specialCases[category]) return specialCases[category]
    return category?.split('_').map(word => word.charAt(0) + word.slice(1).toLowerCase()).join(' ') || 'General'
  }

  // Get tasks for a job
  const getJobTasks = (jobDocId: string) => {
    return tasks.filter(t => t.invoice_id === jobDocId)
  }

  // Calculate progress
  const calculateProgress = (jobTasks: Task[]) => {
    if (jobTasks.length === 0) return { completed: 0, total: 0, percent: 0 }
    const completed = jobTasks.filter(t => t.status === 'COMPLETED').length
    return {
      completed,
      total: jobTasks.length,
      percent: Math.round((completed / jobTasks.length) * 100)
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
    return taskTitle.split(' ')[0].substring(0, 8)
  }

  // Toggle task completion
  const toggleTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    const newStatus = task.status === 'COMPLETED' ? 'IN_PROGRESS' : 'COMPLETED'

    // Optimistic update
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, status: newStatus } : t
    ))

    // TODO: Save to database
    try {
      // await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId)
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

  // Filter jobs
  const filteredJobs = jobs.filter(job => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      const customerName = job.customers?.[0]?.display_name?.toLowerCase() || ''
      const vehicleInfo = (job.vehicle_info || '').toLowerCase()
      const invoiceId = job.doc_id.toLowerCase()

      if (!customerName.includes(search) && !vehicleInfo.includes(search) && !invoiceId.includes(search)) {
        return false
      }
    }

    if (categoryFilter) {
      if (job.category !== categoryFilter) return false
    }

    return true
  })

  // Get unique categories
  const uniqueCategories = Array.from(new Set(jobs.map(j => j.category).filter(Boolean)))

  const stats = {
    total: jobs.length,
    active: jobs.length
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
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
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', width: '100%', marginTop: '24px' }}>
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
              maxWidth: '300px'
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
              cursor: 'pointer'
            }}
          >
            <option value="">All Categories</option>
            {uniqueCategories.map(cat => (
              <option key={cat} value={cat}>{formatCategoryLabel(cat)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Production Queue */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {filteredJobs.length === 0 ? (
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
            <div>No jobs in production</div>
            <div style={{ fontSize: '13px', marginTop: '8px' }}>Jobs appear here when invoices are paid or manually moved to production</div>
          </div>
        ) : (
          filteredJobs.map(job => {
            const jobTasks = getJobTasks(job.doc_id)
            const progress = calculateProgress(jobTasks)
            const nextTaskIndex = jobTasks.findIndex(t => t.status !== 'COMPLETED')
            const visibleTasks = jobTasks.slice(0, 4)
            const hiddenTasks = jobTasks.slice(4)
            const isExpanded = expandedJobs.has(job.id)

            // Progress ring calculations
            const circumference = 188.5
            const strokeOffset = circumference - (progress.percent / 100) * circumference

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
                {/* Card Header */}
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
                  {/* Progress Ring */}
                  <div style={{ position: 'relative', width: '72px', height: '72px', flexShrink: 0 }}>
                    <svg width="72" height="72" style={{ transform: 'rotate(-90deg)' }}>
                      <circle
                        cx="36"
                        cy="36"
                        r="30"
                        fill="none"
                        stroke="#27272a"
                        strokeWidth="6"
                      />
                      <circle
                        cx="36"
                        cy="36"
                        r="30"
                        fill="none"
                        stroke="url(#ringGradient)"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeOffset}
                        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                      />
                    </svg>
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      fontSize: '15px',
                      fontWeight: '700',
                      fontFamily: '"Courier New", monospace',
                      color: '#f1f5f9'
                    }}>
                      {progress.percent}%
                    </div>
                  </div>

                  {/* Job Info */}
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '20px',
                      fontWeight: '600',
                      color: '#f1f5f9',
                      marginBottom: '4px'
                    }}>
                      {job.customers?.[0]?.display_name || 'Unknown'}
                    </div>
                    <div style={{ fontSize: '13px', color: '#51a8f1' }}>
                      {job.vehicle_info || 'Vehicle'} &bull; <span style={{
                        fontFamily: '"Courier New", monospace',
                        color: '#22d3ee'
                      }}>#{job.doc_id}</span>
                    </div>
                  </div>

                  {/* Job Right */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontSize: '24px',
                      fontWeight: '700',
                      color: '#22c55e',
                      marginBottom: '4px'
                    }}>
                      ${job.total.toLocaleString()}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#a855f7',
                      background: 'rgba(168, 85, 247, 0.15)',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      display: 'inline-block'
                    }}>
                      {formatCategoryLabel(job.category)}
                    </div>
                  </div>
                </div>

                {/* Pipeline Section */}
                {jobTasks.length > 0 && (
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
                        {jobTasks.map((task, i) => {
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

                {/* Task Section */}
                {jobTasks.length > 0 && (
                  <div style={{ padding: '20px 24px' }}>
                    {/* Visible Tasks */}
                    {visibleTasks.map((task, i) => {
                      const isCompleted = task.status === 'COMPLETED'
                      const isNext = i === nextTaskIndex && !isCompleted

                      return (
                        <div
                          key={task.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            padding: '14px 0',
                            borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
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
                            onClick={() => toggleTask(task.id)}
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '8px',
                              border: `2px solid ${isCompleted ? '#22c55e' : '#64748b'}`,
                              background: isCompleted ? '#22c55e' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              flexShrink: 0
                            }}
                            onMouseEnter={(e) => {
                              if (!isCompleted) {
                                e.currentTarget.style.borderColor = '#22d3ee'
                                e.currentTarget.style.background = 'rgba(34, 211, 238, 0.1)'
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isCompleted) {
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
                          </div>

                          {/* Task Content */}
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{
                              fontSize: '14px',
                              fontWeight: '500',
                              color: '#f1f5f9',
                              textDecoration: isCompleted ? 'line-through' : 'none',
                              opacity: isCompleted ? 0.6 : 1
                            }}>
                              {task.title}
                            </span>
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
                        </div>
                      )
                    })}

                    {/* Hidden Tasks */}
                    {hiddenTasks.length > 0 && isExpanded && hiddenTasks.map((task, i) => {
                      const actualIndex = i + 4
                      const isCompleted = task.status === 'COMPLETED'
                      const isNext = actualIndex === nextTaskIndex && !isCompleted

                      return (
                        <div
                          key={task.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            padding: '14px 0',
                            borderBottom: '1px solid rgba(148, 163, 184, 0.2)'
                          }}
                        >
                          <div
                            onClick={() => toggleTask(task.id)}
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '8px',
                              border: `2px solid ${isCompleted ? '#22c55e' : '#64748b'}`,
                              background: isCompleted ? '#22c55e' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              flexShrink: 0
                            }}
                          >
                            {isCompleted && (
                              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" style={{ width: '14px', height: '14px' }}>
                                <path d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{
                              fontSize: '14px',
                              fontWeight: '500',
                              color: '#f1f5f9',
                              textDecoration: isCompleted ? 'line-through' : 'none',
                              opacity: isCompleted ? 0.6 : 1
                            }}>
                              {task.title}
                            </span>
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
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Expand Toggle */}
                {hiddenTasks.length > 0 && (
                  <div
                    onClick={() => toggleExpanded(job.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '16px',
                      color: '#64748b',
                      fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      borderTop: '1px solid rgba(148, 163, 184, 0.2)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#22d3ee'
                      e.currentTarget.style.background = 'rgba(34, 211, 238, 0.05)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '#64748b'
                      e.currentTarget.style.background = 'transparent'
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
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                      }}
                    >
                      <path d="M19 9l-7 7-7-7" />
                    </svg>
                    <span>{isExpanded ? 'Show less' : `Show ${hiddenTasks.length} more tasks`}</span>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
