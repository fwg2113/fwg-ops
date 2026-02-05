'use client'

import { useState, useMemo } from 'react'

type Task = {
  id: string
  title: string
  template_task_key: string
  time_spent_minutes: number
  completed_at: string
  created_at: string
  document_id: string
  line_item_id: string
  line_items?: {
    id: string
    category: string
    description: string
  } | null
}

type ProductionJob = {
  id: string
  doc_number: number
  customer_name: string
  category: string
  total: number
  created_at: string
}

type AnalyticsDashboardProps = {
  completedTasks: Task[]
  productionJobs: ProductionJob[]
}

export default function AnalyticsDashboard({ completedTasks, productionJobs }: AnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState<'all' | '7d' | '30d' | '90d'>('all')

  // Filter tasks by time range
  const filteredTasks = useMemo(() => {
    if (timeRange === 'all') return completedTasks

    const now = new Date()
    const cutoff = new Date()

    if (timeRange === '7d') cutoff.setDate(now.getDate() - 7)
    else if (timeRange === '30d') cutoff.setDate(now.getDate() - 30)
    else if (timeRange === '90d') cutoff.setDate(now.getDate() - 90)

    return completedTasks.filter(task => new Date(task.completed_at) >= cutoff)
  }, [completedTasks, timeRange])

  // Calculate overview metrics
  const metrics = useMemo(() => {
    const totalTasks = filteredTasks.length
    const totalMinutes = filteredTasks.reduce((sum, task) => sum + task.time_spent_minutes, 0)
    const totalHours = Math.round(totalMinutes / 60 * 10) / 10
    const avgMinutes = totalTasks > 0 ? Math.round(totalMinutes / totalTasks) : 0

    return {
      totalTasks,
      totalHours,
      avgMinutes,
      avgHours: Math.round(avgMinutes / 60 * 10) / 10
    }
  }, [filteredTasks])

  // Calculate category breakdown
  const categoryBreakdown = useMemo(() => {
    const categoryMap = new Map<string, { tasks: number; totalMinutes: number }>()

    filteredTasks.forEach(task => {
      const category = task.line_items?.category || 'Unknown'
      const existing = categoryMap.get(category) || { tasks: 0, totalMinutes: 0 }
      categoryMap.set(category, {
        tasks: existing.tasks + 1,
        totalMinutes: existing.totalMinutes + task.time_spent_minutes
      })
    })

    return Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        tasks: data.tasks,
        totalMinutes: data.totalMinutes,
        totalHours: Math.round(data.totalMinutes / 60 * 10) / 10,
        avgMinutes: Math.round(data.totalMinutes / data.tasks)
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes)
  }, [filteredTasks])

  // Calculate task bottlenecks (which task types take longest on average)
  const taskBottlenecks = useMemo(() => {
    const taskMap = new Map<string, { count: number; totalMinutes: number; instances: number[] }>()

    filteredTasks.forEach(task => {
      const taskKey = task.template_task_key || task.title
      const existing = taskMap.get(taskKey) || { count: 0, totalMinutes: 0, instances: [] }
      taskMap.set(taskKey, {
        count: existing.count + 1,
        totalMinutes: existing.totalMinutes + task.time_spent_minutes,
        instances: [...existing.instances, task.time_spent_minutes]
      })
    })

    return Array.from(taskMap.entries())
      .map(([taskKey, data]) => ({
        taskKey,
        taskTitle: filteredTasks.find(t => (t.template_task_key || t.title) === taskKey)?.title || taskKey,
        count: data.count,
        totalMinutes: data.totalMinutes,
        avgMinutes: Math.round(data.totalMinutes / data.count),
        minMinutes: Math.min(...data.instances),
        maxMinutes: Math.max(...data.instances)
      }))
      .filter(item => item.count >= 2) // Only show tasks completed at least twice
      .sort((a, b) => b.avgMinutes - a.avgMinutes)
      .slice(0, 10) // Top 10 slowest
  }, [filteredTasks])

  // Format category label
  const formatCategoryLabel = (category: string): string => {
    const specialCases: Record<string, string> = {
      'PPF': 'PPF',
      'TINT': 'Window Tint'
    }
    if (specialCases[category]) return specialCases[category]
    return category?.split('_').map(word => word.charAt(0) + word.slice(1).toLowerCase()).join(' ') || 'General'
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

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
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
              }}>Analytics</span>
            </h1>
            <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
              Track production efficiency and identify bottlenecks
            </p>
          </div>

          {/* Time Range Filter */}
          <div style={{ display: 'flex', gap: '8px', background: '#1d1d1d', padding: '4px', borderRadius: '10px' }}>
            {[
              { key: 'all' as const, label: 'All Time' },
              { key: '7d' as const, label: 'Last 7 Days' },
              { key: '30d' as const, label: 'Last 30 Days' },
              { key: '90d' as const, label: 'Last 90 Days' }
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTimeRange(key)}
                style={{
                  padding: '8px 16px',
                  background: timeRange === key ? '#d71cd1' : 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  color: timeRange === key ? 'white' : '#94a3b8',
                  fontSize: '13px',
                  fontWeight: timeRange === key ? '600' : '400',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Overview Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div style={{
          background: '#111111',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: '16px',
          padding: '24px'
        }}>
          <div style={{ color: '#64748b', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
            Tasks Completed
          </div>
          <div style={{
            fontSize: '36px',
            fontWeight: '700',
            background: 'linear-gradient(135deg, #22d3ee, #a855f7)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontFamily: '"Courier New", monospace'
          }}>
            {metrics.totalTasks}
          </div>
        </div>

        <div style={{
          background: '#111111',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: '16px',
          padding: '24px'
        }}>
          <div style={{ color: '#64748b', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
            Total Time Spent
          </div>
          <div style={{
            fontSize: '36px',
            fontWeight: '700',
            background: 'linear-gradient(135deg, #ec4899, #a855f7)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontFamily: '"Courier New", monospace'
          }}>
            {metrics.totalHours}h
          </div>
        </div>

        <div style={{
          background: '#111111',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: '16px',
          padding: '24px'
        }}>
          <div style={{ color: '#64748b', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
            Avg Time Per Task
          </div>
          <div style={{
            fontSize: '36px',
            fontWeight: '700',
            color: '#22c55e',
            fontFamily: '"Courier New", monospace'
          }}>
            {formatTime(metrics.avgMinutes)}
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div style={{
        background: '#111111',
        border: '1px solid rgba(148, 163, 184, 0.2)',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '32px'
      }}>
        <h2 style={{ color: '#f1f5f9', fontSize: '20px', fontWeight: '600', marginBottom: '20px' }}>
          Time by Category
        </h2>
        {categoryBreakdown.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {categoryBreakdown.map(cat => {
              const maxMinutes = Math.max(...categoryBreakdown.map(c => c.totalMinutes))
              const widthPercent = (cat.totalMinutes / maxMinutes) * 100

              return (
                <div key={cat.category}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: '500' }}>
                      {formatCategoryLabel(cat.category)}
                    </span>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                      <span style={{ color: '#64748b', fontSize: '13px' }}>
                        {cat.tasks} tasks
                      </span>
                      <span style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: '600', minWidth: '60px', textAlign: 'right' }}>
                        {cat.totalHours}h
                      </span>
                    </div>
                  </div>
                  <div style={{
                    width: '100%',
                    height: '8px',
                    background: '#27272a',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${widthPercent}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #22d3ee, #a855f7)',
                      borderRadius: '4px',
                      transition: 'width 0.6s ease'
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p style={{ color: '#64748b', textAlign: 'center', padding: '40px' }}>
            No category data available
          </p>
        )}
      </div>

      {/* Task Bottlenecks */}
      <div style={{
        background: '#111111',
        border: '1px solid rgba(148, 163, 184, 0.2)',
        borderRadius: '16px',
        padding: '24px'
      }}>
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ color: '#f1f5f9', fontSize: '20px', fontWeight: '600', marginBottom: '4px' }}>
            Task Bottlenecks
          </h2>
          <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
            Tasks that take the longest on average (minimum 2 completions)
          </p>
        </div>
        {taskBottlenecks.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>
                <th style={{ padding: '12px', textAlign: 'left', color: '#64748b', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Task
                </th>
                <th style={{ padding: '12px', textAlign: 'center', color: '#64748b', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Count
                </th>
                <th style={{ padding: '12px', textAlign: 'right', color: '#64748b', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Avg Time
                </th>
                <th style={{ padding: '12px', textAlign: 'right', color: '#64748b', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Range
                </th>
                <th style={{ padding: '12px', textAlign: 'right', color: '#64748b', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Total Time
                </th>
              </tr>
            </thead>
            <tbody>
              {taskBottlenecks.map((task, i) => (
                <tr key={task.taskKey} style={{ borderBottom: i < taskBottlenecks.length - 1 ? '1px solid rgba(148, 163, 184, 0.1)' : 'none' }}>
                  <td style={{ padding: '16px 12px', color: '#f1f5f9', fontSize: '14px' }}>
                    {task.taskTitle}
                  </td>
                  <td style={{ padding: '16px 12px', color: '#94a3b8', fontSize: '14px', textAlign: 'center' }}>
                    {task.count}
                  </td>
                  <td style={{ padding: '16px 12px', color: '#f59e0b', fontSize: '14px', fontWeight: '600', textAlign: 'right' }}>
                    {formatTime(task.avgMinutes)}
                  </td>
                  <td style={{ padding: '16px 12px', color: '#64748b', fontSize: '13px', textAlign: 'right' }}>
                    {formatTime(task.minMinutes)} - {formatTime(task.maxMinutes)}
                  </td>
                  <td style={{ padding: '16px 12px', color: '#94a3b8', fontSize: '14px', textAlign: 'right' }}>
                    {formatTime(task.totalMinutes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ color: '#64748b', textAlign: 'center', padding: '40px' }}>
            Not enough data to identify bottlenecks (need tasks completed at least twice)
          </p>
        )}
      </div>
    </div>
  )
}
