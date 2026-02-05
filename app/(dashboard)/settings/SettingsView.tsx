'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'

type Category = {
  id: string
  category_key: string
  label: string
  calendar_color: string
  default_rate: number
  active: boolean
}

type Material = {
  id: string
  material_key: string
  label: string
  dropdown_field: string
  cost_per_unit: number
  markup: number
  active: boolean
}

type Bucket = {
  id: string
  bucket_key: string
  label: string
  color: string
  is_active: boolean
  is_archived: boolean
  sort_order: number
}

type CallSetting = {
  id: string
  phone: string
  name: string
  enabled: boolean
  ring_order: number
}

type TemplateTask = {
  id: string
  task_key: string
  label: string
  default_priority: string
  sort_order: number
  active: boolean
}

type ProductionTemplate = {
  id: string
  template_key: string
  category_key: string
  label: string
  description: string
  active: boolean
  sort_order: number
  template_tasks: TemplateTask[]
}

type Tab = 'categories' | 'materials' | 'buckets' | 'integrations' | 'calls' | 'production'

export default function SettingsView({
  initialCategories,
  initialMaterials,
  initialBuckets,
  calendarConnected,
  initialCallSettings,
  initialTemplates
}: {
  initialCategories: Category[]
  initialMaterials: Material[]
  initialBuckets: Bucket[]
  calendarConnected: boolean
  initialCallSettings: CallSetting[]
  initialTemplates: ProductionTemplate[]
}) {
  const [activeTab, setActiveTab] = useState<Tab>('categories')
  const [categories] = useState<Category[]>(initialCategories)
  const [materials] = useState<Material[]>(initialMaterials)
  const [buckets] = useState<Bucket[]>(initialBuckets)
  const [callSettings, setCallSettings] = useState<CallSetting[]>(initialCallSettings)
  const [templates, setTemplates] = useState<ProductionTemplate[]>(initialTemplates)
  const [showAddPhone, setShowAddPhone] = useState(false)
  const [newPhone, setNewPhone] = useState({ name: '', phone: '' })
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<{ templateId: string; task: TemplateTask } | null>(null)
  const [addingTask, setAddingTask] = useState<string | null>(null)
  const [newTask, setNewTask] = useState({ task_key: '', label: '', default_priority: 'MEDIUM' })

  const tabs: { key: Tab; label: string }[] = [
    { key: 'categories', label: 'Categories' },
    { key: 'materials', label: 'Materials' },
    { key: 'buckets', label: 'Pipeline Buckets' },
    { key: 'production', label: 'Production Templates' },
    { key: 'calls', label: 'Call Forwarding' },
    { key: 'integrations', label: 'Integrations' }
  ]

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
    } else if (cleaned.length === 11 && cleaned[0] === '1') {
      return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
    }
    return phone
  }

  const togglePhoneEnabled = async (id: string, enabled: boolean) => {
    const { error } = await supabase
      .from('call_settings')
      .update({ enabled })
      .eq('id', id)
    
    if (error) {
      console.error('Toggle error:', error)
      alert('Failed to update: ' + error.message)
      return
    }
    
    setCallSettings(callSettings.map(c => 
      c.id === id ? { ...c, enabled } : c
    ))
  }

  const addTeamPhone = async () => {
    if (!newPhone.name.trim() || !newPhone.phone.trim()) {
      alert('Please enter both name and phone')
      return
    }
    
    const cleanPhone = newPhone.phone.replace(/\D/g, '')
    if (cleanPhone.length < 10) {
      alert('Please enter a valid phone number')
      return
    }
    
    const phoneFormatted = cleanPhone.length === 10 ? `+1${cleanPhone}` : `+${cleanPhone}`
    
    const { data, error } = await supabase
      .from('call_settings')
      .insert({
        name: newPhone.name.trim(),
        phone: phoneFormatted,
        enabled: true,
        ring_order: callSettings.length + 1
      })
      .select()
      .single()
    
    if (error) {
      alert('Error adding phone: ' + error.message)
      return
    }
    
    setCallSettings([...callSettings, data])
    setNewPhone({ name: '', phone: '' })
    setShowAddPhone(false)
  }

  const removeTeamPhone = async (id: string) => {
    if (!confirm('Remove this phone from call forwarding?')) return

    await supabase
      .from('call_settings')
      .delete()
      .eq('id', id)

    setCallSettings(callSettings.filter(c => c.id !== id))
  }

  const updateTemplateTask = async (taskId: string, updates: Partial<TemplateTask>) => {
    const { error } = await supabase
      .from('template_tasks')
      .update(updates)
      .eq('id', taskId)

    if (error) {
      alert('Error updating task: ' + error.message)
      return
    }

    setTemplates(templates.map(t => ({
      ...t,
      template_tasks: t.template_tasks.map(task =>
        task.id === taskId ? { ...task, ...updates } : task
      )
    })))
    setEditingTask(null)
  }

  const deleteTemplateTask = async (templateId: string, taskId: string) => {
    if (!confirm('Delete this task from the template?')) return

    const { error } = await supabase
      .from('template_tasks')
      .delete()
      .eq('id', taskId)

    if (error) {
      alert('Error deleting task: ' + error.message)
      return
    }

    setTemplates(templates.map(t =>
      t.id === templateId
        ? { ...t, template_tasks: t.template_tasks.filter(task => task.id !== taskId) }
        : t
    ))
  }

  const addTemplateTask = async (templateId: string, templateKey: string) => {
    if (!newTask.task_key.trim() || !newTask.label.trim()) {
      alert('Please enter both task key and label')
      return
    }

    const template = templates.find(t => t.id === templateId)
    const maxSortOrder = Math.max(...(template?.template_tasks.map(t => t.sort_order) || [0]), 0)

    const { data, error } = await supabase
      .from('template_tasks')
      .insert({
        template_key: templateKey,
        task_key: newTask.task_key.trim().toUpperCase().replace(/\s+/g, '_'),
        label: newTask.label.trim(),
        default_priority: newTask.default_priority,
        sort_order: maxSortOrder + 1,
        active: true
      })
      .select()
      .single()

    if (error) {
      alert('Error adding task: ' + error.message)
      return
    }

    setTemplates(templates.map(t =>
      t.id === templateId
        ? { ...t, template_tasks: [...t.template_tasks, data] }
        : t
    ))
    setNewTask({ task_key: '', label: '', default_priority: 'MEDIUM' })
    setAddingTask(null)
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ color: '#f1f5f9', fontSize: '28px', marginBottom: '24px' }}>Settings</h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 20px',
              background: activeTab === tab.key ? '#d71cd1' : '#1d1d1d',
              border: 'none',
              borderRadius: '8px',
              color: activeTab === tab.key ? 'white' : '#94a3b8',
              fontSize: '14px',
              fontWeight: activeTab === tab.key ? '600' : '400',
              cursor: 'pointer'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div style={{ background: '#1d1d1d', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ color: '#f1f5f9', fontSize: '16px', margin: 0 }}>Service Categories</h3>
            <button style={{
              padding: '8px 16px',
              background: '#d71cd1',
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer'
            }}>
              + Add Category
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Key</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Label</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Color</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Default Rate</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Active</th>
              </tr>
            </thead>
            <tbody>
              {categories.length > 0 ? categories.map((cat) => (
                <tr key={cat.id} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                  <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '13px', fontFamily: 'monospace' }}>{cat.category_key}</td>
                  <td style={{ padding: '12px 16px', color: '#f1f5f9', fontSize: '14px' }}>{cat.label}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: cat.calendar_color || '#666' }} />
                      <span style={{ color: '#94a3b8', fontSize: '13px' }}>{cat.calendar_color}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#f1f5f9', fontSize: '14px', textAlign: 'right' }}>
                    ${cat.default_rate?.toFixed(2) || '0.00'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      background: cat.active ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: cat.active ? '#22c55e' : '#ef4444'
                    }}>
                      {cat.active ? 'Yes' : 'No'}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    No categories configured
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Materials Tab */}
      {activeTab === 'materials' && (
        <div style={{ background: '#1d1d1d', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ color: '#f1f5f9', fontSize: '16px', margin: 0 }}>Materials</h3>
            <button style={{
              padding: '8px 16px',
              background: '#d71cd1',
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer'
            }}>
              + Add Material
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Key</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Label</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Type</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Cost/Unit</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Markup %</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Active</th>
              </tr>
            </thead>
            <tbody>
              {materials.length > 0 ? materials.map((mat) => (
                <tr key={mat.id} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                  <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '13px', fontFamily: 'monospace' }}>{mat.material_key}</td>
                  <td style={{ padding: '12px 16px', color: '#f1f5f9', fontSize: '14px' }}>{mat.label}</td>
                  <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '14px' }}>{mat.dropdown_field || '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#f1f5f9', fontSize: '14px', textAlign: 'right' }}>
                    ${mat.cost_per_unit?.toFixed(2) || '0.00'}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#f1f5f9', fontSize: '14px', textAlign: 'right' }}>
                    {mat.markup || 0}%
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      background: mat.active ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: mat.active ? '#22c55e' : '#ef4444'
                    }}>
                      {mat.active ? 'Yes' : 'No'}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    No materials configured
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Buckets Tab */}
      {activeTab === 'buckets' && (
        <div style={{ background: '#1d1d1d', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ color: '#f1f5f9', fontSize: '16px', margin: 0 }}>Pipeline Buckets</h3>
            <button style={{
              padding: '8px 16px',
              background: '#d71cd1',
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer'
            }}>
              + Add Bucket
            </button>
          </div>
          <div style={{ padding: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {buckets.length > 0 ? buckets.map((bucket) => (
              <div
                key={bucket.id}
                style={{
                  padding: '16px 20px',
                  background: '#282a30',
                  borderRadius: '8px',
                  borderLeft: `4px solid ${bucket.color || '#666'}`,
                  minWidth: '180px'
                }}
              >
                <p style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: '600', margin: '0 0 4px 0' }}>
                  {bucket.label}
                </p>
                <p style={{ color: '#64748b', fontSize: '12px', fontFamily: 'monospace', margin: 0 }}>
                  {bucket.bucket_key}
                </p>
              </div>
            )) : (
              <p style={{ color: '#64748b', padding: '20px' }}>No buckets configured</p>
            )}
          </div>
        </div>
      )}

      {/* Production Templates Tab */}
      {activeTab === 'production' && (
        <div style={{ background: '#1d1d1d', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
            <h3 style={{ color: '#f1f5f9', fontSize: '16px', margin: '0 0 4px 0' }}>Production Workflow Templates</h3>
            <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Manage task templates for each service category</p>
          </div>
          <div style={{ padding: '12px' }}>
            {templates.length > 0 ? templates.map((template) => (
              <div
                key={template.id}
                style={{
                  background: '#282a30',
                  borderRadius: '8px',
                  marginBottom: '12px',
                  overflow: 'hidden'
                }}
              >
                {/* Template Header */}
                <div
                  onClick={() => setExpandedTemplate(expandedTemplate === template.id ? null : template.id)}
                  style={{
                    padding: '16px 20px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <h4 style={{ color: '#f1f5f9', fontSize: '15px', fontWeight: '600', margin: 0 }}>
                        {template.label}
                      </h4>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        background: 'rgba(168, 85, 247, 0.1)',
                        color: '#a855f7',
                        fontFamily: 'monospace'
                      }}>
                        {template.category_key}
                      </span>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        background: template.active ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: template.active ? '#22c55e' : '#ef4444'
                      }}>
                        {template.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0 0' }}>
                      {template.description || 'No description'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ color: '#64748b', fontSize: '13px' }}>
                      {template.template_tasks?.length || 0} tasks
                    </span>
                    <span style={{ color: '#64748b', fontSize: '18px' }}>
                      {expandedTemplate === template.id ? '▼' : '▶'}
                    </span>
                  </div>
                </div>

                {/* Template Tasks */}
                {expandedTemplate === template.id && (
                  <div style={{ borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>
                    <div style={{ padding: '12px 20px', background: '#1d1d1d' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h5 style={{ color: '#94a3b8', fontSize: '13px', margin: 0, fontWeight: '600' }}>Tasks</h5>
                        <button
                          onClick={() => setAddingTask(template.id)}
                          style={{
                            padding: '6px 12px',
                            background: '#d71cd1',
                            border: 'none',
                            borderRadius: '6px',
                            color: 'white',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          + Add Task
                        </button>
                      </div>
                      {template.template_tasks && template.template_tasks.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {template.template_tasks
                            .sort((a, b) => a.sort_order - b.sort_order)
                            .map((task, index) => (
                            <div
                              key={task.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '12px 16px',
                                background: '#282a30',
                                borderRadius: '6px'
                              }}
                            >
                              <span style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                background: '#d71cd1',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px',
                                fontWeight: '600'
                              }}>
                                {index + 1}
                              </span>
                              <div style={{ flex: 1 }}>
                                <p style={{ color: '#f1f5f9', fontSize: '14px', margin: '0 0 2px 0' }}>
                                  {task.label}
                                </p>
                                <p style={{ color: '#64748b', fontSize: '12px', margin: 0, fontFamily: 'monospace' }}>
                                  {task.task_key}
                                </p>
                              </div>
                              <span style={{
                                padding: '4px 10px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: '600',
                                background: task.default_priority === 'HIGH' ? 'rgba(239, 68, 68, 0.1)' :
                                           task.default_priority === 'MEDIUM' ? 'rgba(245, 158, 11, 0.1)' :
                                           'rgba(148, 163, 184, 0.1)',
                                color: task.default_priority === 'HIGH' ? '#ef4444' :
                                       task.default_priority === 'MEDIUM' ? '#f59e0b' :
                                       '#94a3b8'
                              }}>
                                {task.default_priority}
                              </span>
                              <button
                                onClick={() => setEditingTask({ templateId: template.id, task })}
                                style={{
                                  padding: '6px 10px',
                                  background: 'transparent',
                                  border: '1px solid rgba(148, 163, 184, 0.2)',
                                  borderRadius: '4px',
                                  color: '#94a3b8',
                                  fontSize: '12px',
                                  cursor: 'pointer'
                                }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => deleteTemplateTask(template.id, task.id)}
                                style={{
                                  padding: '6px 10px',
                                  background: 'transparent',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  borderRadius: '4px',
                                  color: '#ef4444',
                                  fontSize: '12px',
                                  cursor: 'pointer'
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ color: '#64748b', fontSize: '13px', padding: '20px', textAlign: 'center', margin: 0 }}>
                          No tasks defined for this template
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )) : (
              <p style={{ color: '#64748b', padding: '40px', textAlign: 'center' }}>
                No production templates configured
              </p>
            )}
          </div>

          {/* Edit Task Modal */}
          {editingTask && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}>
              <div style={{
                background: '#1d1d1d',
                borderRadius: '16px',
                width: '500px',
                overflow: 'hidden'
              }}>
                <div style={{ padding: '20px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ color: '#f1f5f9', fontSize: '18px', margin: 0 }}>Edit Task</h3>
                  <button onClick={() => setEditingTask(null)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '24px' }}>×</button>
                </div>
                <div style={{ padding: '20px' }}>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Task Key</label>
                    <input
                      type="text"
                      value={editingTask.task.task_key}
                      disabled
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: '#282a30',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        borderRadius: '8px',
                        color: '#64748b',
                        fontSize: '14px',
                        fontFamily: 'monospace'
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Label</label>
                    <input
                      type="text"
                      value={editingTask.task.label}
                      onChange={(e) => setEditingTask({
                        ...editingTask,
                        task: { ...editingTask.task, label: e.target.value }
                      })}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: '#111111',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        borderRadius: '8px',
                        color: '#f1f5f9',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Priority</label>
                    <select
                      value={editingTask.task.default_priority}
                      onChange={(e) => setEditingTask({
                        ...editingTask,
                        task: { ...editingTask.task, default_priority: e.target.value }
                      })}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: '#111111',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        borderRadius: '8px',
                        color: '#f1f5f9',
                        fontSize: '14px'
                      }}
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                    </select>
                  </div>
                </div>
                <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(148, 163, 184, 0.1)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button onClick={() => setEditingTask(null)} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
                  <button
                    onClick={() => updateTemplateTask(editingTask.task.id, {
                      label: editingTask.task.label,
                      default_priority: editingTask.task.default_priority
                    })}
                    style={{ padding: '10px 20px', background: '#d71cd1', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Add Task Modal */}
          {addingTask && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}>
              <div style={{
                background: '#1d1d1d',
                borderRadius: '16px',
                width: '500px',
                overflow: 'hidden'
              }}>
                <div style={{ padding: '20px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ color: '#f1f5f9', fontSize: '18px', margin: 0 }}>Add New Task</h3>
                  <button onClick={() => { setAddingTask(null); setNewTask({ task_key: '', label: '', default_priority: 'MEDIUM' }) }} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '24px' }}>×</button>
                </div>
                <div style={{ padding: '20px' }}>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Task Key</label>
                    <input
                      type="text"
                      value={newTask.task_key}
                      onChange={(e) => setNewTask({ ...newTask, task_key: e.target.value })}
                      placeholder="e.g. PREP_SURFACE"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: '#111111',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        borderRadius: '8px',
                        color: '#f1f5f9',
                        fontSize: '14px',
                        fontFamily: 'monospace'
                      }}
                    />
                    <p style={{ color: '#64748b', fontSize: '12px', margin: '4px 0 0 0' }}>
                      Unique identifier (will be converted to UPPERCASE)
                    </p>
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Label</label>
                    <input
                      type="text"
                      value={newTask.label}
                      onChange={(e) => setNewTask({ ...newTask, label: e.target.value })}
                      placeholder="e.g. Prep Surface"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: '#111111',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        borderRadius: '8px',
                        color: '#f1f5f9',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Priority</label>
                    <select
                      value={newTask.default_priority}
                      onChange={(e) => setNewTask({ ...newTask, default_priority: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: '#111111',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        borderRadius: '8px',
                        color: '#f1f5f9',
                        fontSize: '14px'
                      }}
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                    </select>
                  </div>
                </div>
                <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(148, 163, 184, 0.1)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button onClick={() => { setAddingTask(null); setNewTask({ task_key: '', label: '', default_priority: 'MEDIUM' }) }} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
                  <button
                    onClick={() => {
                      const template = templates.find(t => t.id === addingTask)
                      if (template) addTemplateTask(template.id, template.template_key)
                    }}
                    style={{ padding: '10px 20px', background: '#d71cd1', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}
                  >
                    Add Task
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Call Forwarding Tab */}
      {activeTab === 'calls' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: '#1d1d1d', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ color: '#f1f5f9', fontSize: '16px', margin: '0 0 4px 0' }}>Team Phone Numbers</h3>
                <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Incoming calls will ring all enabled phones simultaneously</p>
              </div>
              <button 
                onClick={() => setShowAddPhone(true)}
                style={{
                  padding: '8px 16px',
                  background: '#d71cd1',
                  border: 'none',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                + Add Phone
              </button>
            </div>
            <div style={{ padding: '12px' }}>
              {callSettings.length > 0 ? callSettings.map((setting) => (
                <div
                  key={setting.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    background: '#282a30',
                    borderRadius: '8px',
                    marginBottom: '8px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: setting.enabled ? '#d71cd1' : '#64748b',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      fontWeight: 600
                    }}>
                      {setting.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p style={{ color: '#f1f5f9', fontSize: '15px', fontWeight: '500', margin: '0 0 2px 0' }}>
                        {setting.name}
                      </p>
                      <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
                        {formatPhone(setting.phone)}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <label style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      cursor: 'pointer'
                    }}>
                      <span style={{ color: '#64748b', fontSize: '13px' }}>
                        {setting.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                      <div
                        onClick={() => togglePhoneEnabled(setting.id, !setting.enabled)}
                        style={{
                          width: '44px',
                          height: '24px',
                          background: setting.enabled ? '#d71cd1' : '#4b5563',
                          borderRadius: '12px',
                          position: 'relative',
                          cursor: 'pointer',
                          transition: 'background 0.2s'
                        }}
                      >
                        <div style={{
                          width: '18px',
                          height: '18px',
                          background: 'white',
                          borderRadius: '50%',
                          position: 'absolute',
                          top: '3px',
                          left: setting.enabled ? '23px' : '3px',
                          transition: 'left 0.2s'
                        }} />
                      </div>
                    </label>
                    <button
                      onClick={() => removeTeamPhone(setting.id)}
                      style={{
                        padding: '6px 10px',
                        background: 'transparent',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '6px',
                        color: '#ef4444',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )) : (
                <p style={{ color: '#64748b', padding: '20px', textAlign: 'center' }}>No team phones configured</p>
              )}
            </div>
          </div>

          <div style={{ background: '#1d1d1d', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ color: '#f1f5f9', fontSize: '16px', margin: '0 0 12px 0' }}>How Call Forwarding Works</h3>
            <ul style={{ color: '#94a3b8', fontSize: '14px', margin: 0, paddingLeft: '20px', lineHeight: '1.8' }}>
              <li>When someone calls your Twilio number, all enabled phones ring simultaneously</li>
              <li>First person to answer gets the call, others stop ringing</li>
              <li>Your business number shows as the caller ID (save it as "FWG" in your contacts)</li>
              <li>If no one answers within 25 seconds, caller goes to voicemail</li>
              <li>All calls are logged in the dashboard with caller info and duration</li>
            </ul>
          </div>

          {/* Add Phone Modal */}
          {showAddPhone && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}>
              <div style={{
                background: '#1d1d1d',
                borderRadius: '16px',
                width: '400px',
                overflow: 'hidden'
              }}>
                <div style={{ padding: '20px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ color: '#f1f5f9', fontSize: '18px', margin: 0 }}>Add Team Phone</h3>
                  <button onClick={() => setShowAddPhone(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '24px' }}>×</button>
                </div>
                <div style={{ padding: '20px' }}>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Team Member Name</label>
                    <input
                      type="text"
                      value={newPhone.name}
                      onChange={(e) => setNewPhone({ ...newPhone, name: e.target.value })}
                      placeholder="e.g. John Smith"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: '#111111',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        borderRadius: '8px',
                        color: '#f1f5f9',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Phone Number</label>
                    <input
                      type="tel"
                      value={newPhone.phone}
                      onChange={(e) => setNewPhone({ ...newPhone, phone: e.target.value })}
                      placeholder="(240) 555-1234"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: '#111111',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        borderRadius: '8px',
                        color: '#f1f5f9',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                </div>
                <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(148, 163, 184, 0.1)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button onClick={() => setShowAddPhone(false)} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
                  <button onClick={addTeamPhone} style={{ padding: '10px 20px', background: '#d71cd1', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>Add Phone</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Integrations Tab */}
      {activeTab === 'integrations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: '#1d1d1d', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ color: '#f1f5f9', fontSize: '16px', margin: '0 0 4px 0' }}>Twilio SMS</h3>
                <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Send and receive text messages with customers</p>
              </div>
              <span style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                background: 'rgba(34, 197, 94, 0.1)',
                color: '#22c55e'
              }}>
                Connected
              </span>
            </div>
          </div>

          <div style={{ background: '#1d1d1d', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ color: '#f1f5f9', fontSize: '16px', margin: '0 0 4px 0' }}>Stripe Payments</h3>
                <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Accept credit card payments on invoices</p>
              </div>
              <span style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                background: 'rgba(34, 197, 94, 0.1)',
                color: '#22c55e'
              }}>
                Connected
              </span>
            </div>
          </div>

          <div style={{ background: '#1d1d1d', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ color: '#f1f5f9', fontSize: '16px', margin: '0 0 4px 0' }}>Resend Email</h3>
                <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Send quotes and invoices via email</p>
              </div>
              <span style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                background: 'rgba(34, 197, 94, 0.1)',
                color: '#22c55e'
              }}>
                Connected
              </span>
            </div>
          </div>

          <div style={{ background: '#1d1d1d', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ color: '#f1f5f9', fontSize: '16px', margin: '0 0 4px 0' }}>Google Calendar</h3>
                <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Sync appointments with your Google Calendar</p>
              </div>
              {calendarConnected ? (
                <span style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  background: 'rgba(34, 197, 94, 0.1)',
                  color: '#22c55e'
                }}>
                  Connected
                </span>
              ) : (
                <button
                  onClick={() => window.location.href = '/api/calendar/auth'}
                  style={{
                    padding: '8px 16px',
                    background: '#3b82f6',
                    border: 'none',
                    borderRadius: '6px',
                    color: 'white',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Connect Google Calendar
                </button>
              )}
            </div>
          </div>

          <div style={{ background: '#1d1d1d', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ color: '#f1f5f9', fontSize: '16px', margin: '0 0 4px 0' }}>Cloudflare R2</h3>
                <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Store customer files and project images</p>
              </div>
              <span style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                background: 'rgba(245, 158, 11, 0.1)',
                color: '#f59e0b'
              }}>
                Not Configured
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}