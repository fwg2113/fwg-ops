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

type TaskStatus = {
  id: string
  status_key: string
  label: string
  color: string
  is_complete: boolean
  sort_order: number
  active: boolean
}

type TaskPriority = {
  id: string
  priority_key: string
  label: string
  color: string
  sort_order: number
  active: boolean
}

type AutomationSetting = {
  id: string
  automation_key: string
  enabled: boolean
  label: string
  description: string
  created_at: string
  updated_at: string
}

type VehicleCategory = {
  id: number
  category_key: string
  label: string
  size_factor: string
  base_sqft_min: number
  base_sqft_max: number
  sort_order: number
  active: boolean
  notes: string
}

type ProjectType = {
  id: number
  project_key: string
  label: string
}

type PricingRow = {
  id: number
  category_key: string
  project_key: string
  price_min: number
  price_max: number
  typical_price: number
  notes: string
}

type Tab = 'categories' | 'materials' | 'buckets' | 'integrations' | 'calls' | 'production' | 'statuses' | 'priorities' | 'automations' | 'estimator'

export default function SettingsView({
  initialCategories,
  initialMaterials,
  initialBuckets,
  calendarConnected,
  gmailConnected,
  initialCallSettings,
  initialTemplates,
  initialTaskStatuses,
  initialTaskPriorities,
  initialAutomationSettings,
  initialVehicleCategories,
  initialProjectTypes,
  initialPricingMatrix
}: {
  initialCategories: Category[]
  initialMaterials: Material[]
  initialBuckets: Bucket[]
  calendarConnected: boolean
  gmailConnected: boolean
  initialCallSettings: CallSetting[]
  initialTemplates: ProductionTemplate[]
  initialTaskStatuses: TaskStatus[]
  initialTaskPriorities: TaskPriority[]
  initialAutomationSettings: AutomationSetting[]
  initialVehicleCategories: VehicleCategory[]
  initialProjectTypes: ProjectType[]
  initialPricingMatrix: PricingRow[]
}) {
  const [activeTab, setActiveTab] = useState<Tab>('categories')
  const [categories] = useState<Category[]>(initialCategories)
  const [materials] = useState<Material[]>(initialMaterials)
  const [buckets] = useState<Bucket[]>(initialBuckets)
  const [callSettings, setCallSettings] = useState<CallSetting[]>(initialCallSettings)
  const [templates, setTemplates] = useState<ProductionTemplate[]>(initialTemplates)
  const [taskStatuses, setTaskStatuses] = useState<TaskStatus[]>(initialTaskStatuses)
  const [taskPriorities, setTaskPriorities] = useState<TaskPriority[]>(initialTaskPriorities)
  const [showAddPhone, setShowAddPhone] = useState(false)
  const [newPhone, setNewPhone] = useState({ name: '', phone: '' })
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<{ templateId: string; task: TemplateTask } | null>(null)
  const [addingTask, setAddingTask] = useState<string | null>(null)
  const [newTask, setNewTask] = useState({ task_key: '', label: '', default_priority: 'MEDIUM' })
  const [editingStatus, setEditingStatus] = useState<TaskStatus | null>(null)
  const [editingPriority, setEditingPriority] = useState<TaskPriority | null>(null)
  const [addingStatus, setAddingStatus] = useState(false)
  const [addingPriority, setAddingPriority] = useState(false)
  const [newStatus, setNewStatus] = useState({ status_key: '', label: '', color: '#64748b', is_complete: false })
  const [newPriority, setNewPriority] = useState({ priority_key: '', label: '', color: '#64748b' })
  const [automationSettings, setAutomationSettings] = useState<AutomationSetting[]>(initialAutomationSettings)
  const [editingAutomation, setEditingAutomation] = useState<AutomationSetting | null>(null)
  const [vehicleCategories, setVehicleCategories] = useState<VehicleCategory[]>(initialVehicleCategories)
  const [projectTypes] = useState<ProjectType[]>(initialProjectTypes)
  const [pricingMatrix, setPricingMatrix] = useState<PricingRow[]>(initialPricingMatrix)
  const [editingVehicle, setEditingVehicle] = useState<VehicleCategory | null>(null)
  const [editingPricing, setEditingPricing] = useState<PricingRow | null>(null)
  const [savingEstimator, setSavingEstimator] = useState(false)
  const [addingVehicle, setAddingVehicle] = useState(false)
  const [newVehicle, setNewVehicle] = useState({
    category_key: '',
    label: '',
    size_factor: '',
    base_sqft_min: 0,
    base_sqft_max: 0,
    sort_order: 0,
    notes: '',
    pricing: {} as Record<string, { price_min: number; price_max: number; typical_price: number }>
  })

  const tabs: { key: Tab; label: string }[] = [
    { key: 'categories', label: 'Categories' },
    { key: 'materials', label: 'Materials' },
    { key: 'buckets', label: 'Pipeline Buckets' },
    { key: 'production', label: 'Production Templates' },
    { key: 'statuses', label: 'Task Statuses' },
    { key: 'priorities', label: 'Task Priorities' },
    { key: 'estimator', label: 'Estimator Config' },
    { key: 'automations', label: 'Automations' },
    { key: 'calls', label: 'Call Forwarding' },
    { key: 'integrations', label: 'Integrations' }
  ]

  const addVehicleCategory = async () => {
    if (!newVehicle.category_key.trim() || !newVehicle.label.trim()) {
      alert('Please enter both a key and label')
      return
    }
    setSavingEstimator(true)
    try {
      // Create the vehicle category
      const res = await fetch('/api/estimator/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'estimator_vehicle_categories',
          data: {
            category_key: newVehicle.category_key.trim().toUpperCase().replace(/\s+/g, '_'),
            label: newVehicle.label.trim(),
            size_factor: newVehicle.size_factor || 'medium',
            base_sqft_min: newVehicle.base_sqft_min || 0,
            base_sqft_max: newVehicle.base_sqft_max || 0,
            sort_order: newVehicle.sort_order || vehicleCategories.length + 1,
            active: true,
            notes: newVehicle.notes || ''
          }
        })
      })
      const json = await res.json()
      if (!json.ok) {
        alert('Error creating category: ' + json.error)
        setSavingEstimator(false)
        return
      }
      const createdVehicle = json.data

      // Create pricing rows for each project type
      const newPricingRows: PricingRow[] = []
      for (const pt of projectTypes) {
        const p = newVehicle.pricing[pt.project_key] || { price_min: 0, price_max: 0, typical_price: 0 }
        const pRes = await fetch('/api/estimator/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table: 'estimator_pricing',
            data: {
              category_key: createdVehicle.category_key,
              project_key: pt.project_key,
              price_min: p.price_min,
              price_max: p.price_max,
              typical_price: p.typical_price,
              notes: ''
            }
          })
        })
        const pJson = await pRes.json()
        if (pJson.ok) newPricingRows.push(pJson.data)
      }

      setVehicleCategories([...vehicleCategories, createdVehicle])
      setPricingMatrix([...pricingMatrix, ...newPricingRows])
      setAddingVehicle(false)
      setNewVehicle({
        category_key: '', label: '', size_factor: '', base_sqft_min: 0, base_sqft_max: 0,
        sort_order: 0, notes: '',
        pricing: {}
      })
    } catch (e: any) {
      alert('Error: ' + e.message)
    }
    setSavingEstimator(false)
  }

  const deleteVehicleCategory = async (vehicle: VehicleCategory) => {
    if (!confirm(`Delete "${vehicle.label}" and all its pricing data? This cannot be undone.`)) return
    setSavingEstimator(true)
    try {
      // Delete pricing rows first
      const pricingRows = pricingMatrix.filter(p => p.category_key === vehicle.category_key)
      for (const row of pricingRows) {
        await fetch('/api/estimator/settings', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ table: 'estimator_pricing', id: row.id })
        })
      }
      // Delete the category
      const res = await fetch('/api/estimator/settings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: 'estimator_vehicle_categories', id: vehicle.id })
      })
      const json = await res.json()
      if (json.ok) {
        setVehicleCategories(vehicleCategories.filter(v => v.id !== vehicle.id))
        setPricingMatrix(pricingMatrix.filter(p => p.category_key !== vehicle.category_key))
      } else {
        alert('Error deleting: ' + json.error)
      }
    } catch (e: any) {
      alert('Error: ' + e.message)
    }
    setSavingEstimator(false)
  }

  const saveVehicleCategory = async (vehicle: VehicleCategory) => {
    setSavingEstimator(true)
    try {
      const res = await fetch('/api/estimator/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'estimator_vehicle_categories',
          id: vehicle.id,
          data: {
            label: vehicle.label,
            notes: vehicle.notes,
            sort_order: vehicle.sort_order,
            active: vehicle.active,
            size_factor: vehicle.size_factor,
            base_sqft_min: vehicle.base_sqft_min,
            base_sqft_max: vehicle.base_sqft_max
          }
        })
      })
      const json = await res.json()
      if (json.ok) {
        setVehicleCategories(vehicleCategories.map(v => v.id === vehicle.id ? { ...v, ...vehicle } : v))
        setEditingVehicle(null)
      } else {
        alert('Error saving: ' + json.error)
      }
    } catch (e: any) {
      alert('Error: ' + e.message)
    }
    setSavingEstimator(false)
  }

  const savePricingRow = async (row: PricingRow) => {
    setSavingEstimator(true)
    try {
      const res = await fetch('/api/estimator/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'estimator_pricing',
          id: row.id,
          data: {
            price_min: row.price_min,
            price_max: row.price_max,
            typical_price: row.typical_price
          }
        })
      })
      const json = await res.json()
      if (json.ok) {
        setPricingMatrix(pricingMatrix.map(p => p.id === row.id ? { ...p, ...row } : p))
        setEditingPricing(null)
      } else {
        alert('Error saving: ' + json.error)
      }
    } catch (e: any) {
      alert('Error: ' + e.message)
    }
    setSavingEstimator(false)
  }

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

  const toggleAutomation = async (id: string, enabled: boolean) => {
    const { error } = await supabase
      .from('automation_settings')
      .update({
        enabled,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      console.error('Automation toggle error:', error)
      alert('Failed to update automation: ' + error.message)
      return
    }

    setAutomationSettings(automationSettings.map(a =>
      a.id === id ? { ...a, enabled, updated_at: new Date().toISOString() } : a
    ))
  }

  const saveAutomation = async () => {
    if (!editingAutomation) return

    if (!editingAutomation.label.trim()) {
      alert('Label is required')
      return
    }

    const { error } = await supabase
      .from('automation_settings')
      .update({
        label: editingAutomation.label.trim(),
        description: editingAutomation.description?.trim() || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', editingAutomation.id)

    if (error) {
      console.error('Error updating automation:', error)
      alert('Failed to save automation: ' + error.message)
      return
    }

    setAutomationSettings(automationSettings.map(a =>
      a.id === editingAutomation.id ? { ...editingAutomation, updated_at: new Date().toISOString() } : a
    ))
    setEditingAutomation(null)
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

  const addTaskStatus = async () => {
    if (!newStatus.status_key.trim() || !newStatus.label.trim()) {
      alert('Please enter both status key and label')
      return
    }

    const maxSortOrder = Math.max(...(taskStatuses.map(s => s.sort_order) || [0]), 0)

    const { data, error } = await supabase
      .from('task_statuses')
      .insert({
        status_key: newStatus.status_key.trim().toUpperCase().replace(/\s+/g, '_'),
        label: newStatus.label.trim(),
        color: newStatus.color,
        is_complete: newStatus.is_complete,
        sort_order: maxSortOrder + 1,
        active: true
      })
      .select()
      .single()

    if (error) {
      alert('Error adding status: ' + error.message)
      return
    }

    setTaskStatuses([...taskStatuses, data])
    setNewStatus({ status_key: '', label: '', color: '#64748b', is_complete: false })
    setAddingStatus(false)
  }

  const updateTaskStatus = async (statusId: string, updates: Partial<TaskStatus>) => {
    const { error } = await supabase
      .from('task_statuses')
      .update(updates)
      .eq('id', statusId)

    if (error) {
      alert('Error updating status: ' + error.message)
      return
    }

    setTaskStatuses(taskStatuses.map(s =>
      s.id === statusId ? { ...s, ...updates } : s
    ))
    setEditingStatus(null)
  }

  const deleteTaskStatus = async (statusId: string) => {
    if (!confirm('Delete this status? This may affect existing tasks.')) return

    const { error } = await supabase
      .from('task_statuses')
      .delete()
      .eq('id', statusId)

    if (error) {
      alert('Error deleting status: ' + error.message)
      return
    }

    setTaskStatuses(taskStatuses.filter(s => s.id !== statusId))
  }

  const addTaskPriority = async () => {
    if (!newPriority.priority_key.trim() || !newPriority.label.trim()) {
      alert('Please enter both priority key and label')
      return
    }

    const maxSortOrder = Math.max(...(taskPriorities.map(p => p.sort_order) || [0]), 0)

    const { data, error } = await supabase
      .from('task_priorities')
      .insert({
        priority_key: newPriority.priority_key.trim().toUpperCase().replace(/\s+/g, '_'),
        label: newPriority.label.trim(),
        color: newPriority.color,
        sort_order: maxSortOrder + 1,
        active: true
      })
      .select()
      .single()

    if (error) {
      alert('Error adding priority: ' + error.message)
      return
    }

    setTaskPriorities([...taskPriorities, data])
    setNewPriority({ priority_key: '', label: '', color: '#64748b' })
    setAddingPriority(false)
  }

  const updateTaskPriority = async (priorityId: string, updates: Partial<TaskPriority>) => {
    const { error } = await supabase
      .from('task_priorities')
      .update(updates)
      .eq('id', priorityId)

    if (error) {
      alert('Error updating priority: ' + error.message)
      return
    }

    setTaskPriorities(taskPriorities.map(p =>
      p.id === priorityId ? { ...p, ...updates } : p
    ))
    setEditingPriority(null)
  }

  const deleteTaskPriority = async (priorityId: string) => {
    if (!confirm('Delete this priority? This may affect existing tasks.')) return

    const { error } = await supabase
      .from('task_priorities')
      .delete()
      .eq('id', priorityId)

    if (error) {
      alert('Error deleting priority: ' + error.message)
      return
    }

    setTaskPriorities(taskPriorities.filter(p => p.id !== priorityId))
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

      {/* Edit Status Modal */}
      {editingStatus && (
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
              <h3 style={{ color: '#f1f5f9', fontSize: '18px', margin: 0 }}>Edit Task Status</h3>
              <button onClick={() => setEditingStatus(null)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '24px' }}>×</button>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Status Key</label>
                <input
                  type="text"
                  value={editingStatus.status_key}
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
                  value={editingStatus.label}
                  onChange={(e) => setEditingStatus({ ...editingStatus, label: e.target.value })}
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
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Color (hex)</label>
                <input
                  type="text"
                  value={editingStatus.color}
                  onChange={(e) => setEditingStatus({ ...editingStatus, color: e.target.value })}
                  placeholder="#64748b"
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
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editingStatus.is_complete}
                    onChange={(e) => setEditingStatus({ ...editingStatus, is_complete: e.target.checked })}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <span style={{ color: '#94a3b8', fontSize: '13px' }}>Mark tasks with this status as complete</span>
                </label>
              </div>
            </div>
            <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(148, 163, 184, 0.1)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setEditingStatus(null)} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
              <button
                onClick={() => updateTaskStatus(editingStatus.id, {
                  label: editingStatus.label,
                  color: editingStatus.color,
                  is_complete: editingStatus.is_complete
                })}
                style={{ padding: '10px 20px', background: '#d71cd1', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Status Modal */}
      {addingStatus && (
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
              <h3 style={{ color: '#f1f5f9', fontSize: '18px', margin: 0 }}>Add Task Status</h3>
              <button onClick={() => { setAddingStatus(false); setNewStatus({ status_key: '', label: '', color: '#64748b', is_complete: false }) }} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '24px' }}>×</button>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Status Key</label>
                <input
                  type="text"
                  value={newStatus.status_key}
                  onChange={(e) => setNewStatus({ ...newStatus, status_key: e.target.value })}
                  placeholder="e.g. IN_REVIEW"
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
                  value={newStatus.label}
                  onChange={(e) => setNewStatus({ ...newStatus, label: e.target.value })}
                  placeholder="e.g. In Review"
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
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Color (hex)</label>
                <input
                  type="text"
                  value={newStatus.color}
                  onChange={(e) => setNewStatus({ ...newStatus, color: e.target.value })}
                  placeholder="#64748b"
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
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={newStatus.is_complete}
                    onChange={(e) => setNewStatus({ ...newStatus, is_complete: e.target.checked })}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <span style={{ color: '#94a3b8', fontSize: '13px' }}>Mark tasks with this status as complete</span>
                </label>
              </div>
            </div>
            <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(148, 163, 184, 0.1)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => { setAddingStatus(false); setNewStatus({ status_key: '', label: '', color: '#64748b', is_complete: false }) }} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
              <button
                onClick={addTaskStatus}
                style={{ padding: '10px 20px', background: '#d71cd1', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}
              >
                Add Status
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Priority Modal */}
      {editingPriority && (
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
              <h3 style={{ color: '#f1f5f9', fontSize: '18px', margin: 0 }}>Edit Task Priority</h3>
              <button onClick={() => setEditingPriority(null)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '24px' }}>×</button>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Priority Key</label>
                <input
                  type="text"
                  value={editingPriority.priority_key}
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
                  value={editingPriority.label}
                  onChange={(e) => setEditingPriority({ ...editingPriority, label: e.target.value })}
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
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Color (hex)</label>
                <input
                  type="text"
                  value={editingPriority.color}
                  onChange={(e) => setEditingPriority({ ...editingPriority, color: e.target.value })}
                  placeholder="#64748b"
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
              </div>
            </div>
            <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(148, 163, 184, 0.1)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setEditingPriority(null)} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
              <button
                onClick={() => updateTaskPriority(editingPriority.id, {
                  label: editingPriority.label,
                  color: editingPriority.color
                })}
                style={{ padding: '10px 20px', background: '#d71cd1', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Priority Modal */}
      {addingPriority && (
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
              <h3 style={{ color: '#f1f5f9', fontSize: '18px', margin: 0 }}>Add Task Priority</h3>
              <button onClick={() => { setAddingPriority(false); setNewPriority({ priority_key: '', label: '', color: '#64748b' }) }} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '24px' }}>×</button>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Priority Key</label>
                <input
                  type="text"
                  value={newPriority.priority_key}
                  onChange={(e) => setNewPriority({ ...newPriority, priority_key: e.target.value })}
                  placeholder="e.g. CRITICAL"
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
                  value={newPriority.label}
                  onChange={(e) => setNewPriority({ ...newPriority, label: e.target.value })}
                  placeholder="e.g. Critical"
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
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Color (hex)</label>
                <input
                  type="text"
                  value={newPriority.color}
                  onChange={(e) => setNewPriority({ ...newPriority, color: e.target.value })}
                  placeholder="#64748b"
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
              </div>
            </div>
            <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(148, 163, 184, 0.1)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => { setAddingPriority(false); setNewPriority({ priority_key: '', label: '', color: '#64748b' }) }} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
              <button
                onClick={addTaskPriority}
                style={{ padding: '10px 20px', background: '#d71cd1', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}
              >
                Add Priority
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Statuses Tab */}
      {activeTab === 'statuses' && (
        <div style={{ background: '#1d1d1d', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ color: '#f1f5f9', fontSize: '16px', margin: '0 0 4px 0' }}>Task Statuses</h3>
              <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Manage available task status options</p>
            </div>
            <button
              onClick={() => setAddingStatus(true)}
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
              + Add Status
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Order</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Key</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Label</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Color</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Complete?</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Active</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {taskStatuses.length > 0 ? taskStatuses.map((status) => (
                <tr key={status.id} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                  <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '13px' }}>{status.sort_order}</td>
                  <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '13px', fontFamily: 'monospace' }}>{status.status_key}</td>
                  <td style={{ padding: '12px 16px', color: '#f1f5f9', fontSize: '14px' }}>{status.label}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: status.color }} />
                      <span style={{ color: '#94a3b8', fontSize: '13px' }}>{status.color}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      background: status.is_complete ? 'rgba(34, 197, 94, 0.1)' : 'rgba(148, 163, 184, 0.1)',
                      color: status.is_complete ? '#22c55e' : '#94a3b8'
                    }}>
                      {status.is_complete ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      background: status.active ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: status.active ? '#22c55e' : '#ef4444'
                    }}>
                      {status.active ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => setEditingStatus(status)}
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
                        onClick={() => deleteTaskStatus(status.id)}
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
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    No task statuses configured
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Task Priorities Tab */}
      {activeTab === 'priorities' && (
        <div style={{ background: '#1d1d1d', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ color: '#f1f5f9', fontSize: '16px', margin: '0 0 4px 0' }}>Task Priorities</h3>
              <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Manage available task priority levels</p>
            </div>
            <button
              onClick={() => setAddingPriority(true)}
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
              + Add Priority
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Order</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Key</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Label</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Color</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Active</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {taskPriorities.length > 0 ? taskPriorities.map((priority) => (
                <tr key={priority.id} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                  <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '13px' }}>{priority.sort_order}</td>
                  <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '13px', fontFamily: 'monospace' }}>{priority.priority_key}</td>
                  <td style={{ padding: '12px 16px', color: '#f1f5f9', fontSize: '14px' }}>{priority.label}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: priority.color }} />
                      <span style={{ color: '#94a3b8', fontSize: '13px' }}>{priority.color}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      background: priority.active ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: priority.active ? '#22c55e' : '#ef4444'
                    }}>
                      {priority.active ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => setEditingPriority(priority)}
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
                        onClick={() => deleteTaskPriority(priority.id)}
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
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    No task priorities configured
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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

      {/* Automations Tab */}
      {activeTab === 'automations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(215, 28, 209, 0.05), rgba(168, 85, 247, 0.05))',
            border: '1px solid rgba(215, 28, 209, 0.2)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '8px'
          }}>
            <h3 style={{
              color: '#f1f5f9',
              fontSize: '18px',
              fontWeight: '600',
              margin: '0 0 8px 0'
            }}>
              Production Automations
            </h3>
            <p style={{
              color: '#94a3b8',
              fontSize: '14px',
              margin: 0,
              lineHeight: '1.5'
            }}>
              Configure automated workflows to streamline your production process.
              Toggle each automation on or off based on your needs.
            </p>
          </div>

          {automationSettings.length > 0 ? (
            automationSettings.map((automation) => (
              <div
                key={automation.id}
                style={{
                  background: '#1d1d1d',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: '12px',
                  padding: '24px',
                  transition: 'all 0.2s ease'
                }}
              >
                {editingAutomation?.id === automation.id ? (
                  /* Edit Mode */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px', fontWeight: '500' }}>
                        Label
                      </label>
                      <input
                        type="text"
                        value={editingAutomation.label}
                        onChange={(e) => setEditingAutomation({ ...editingAutomation, label: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: '#0a0a0a',
                          border: '1px solid rgba(148, 163, 184, 0.2)',
                          borderRadius: '8px',
                          color: '#f1f5f9',
                          fontSize: '14px'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px', fontWeight: '500' }}>
                        Description
                      </label>
                      <textarea
                        value={editingAutomation.description || ''}
                        onChange={(e) => setEditingAutomation({ ...editingAutomation, description: e.target.value })}
                        rows={3}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: '#0a0a0a',
                          border: '1px solid rgba(148, 163, 184, 0.2)',
                          borderRadius: '8px',
                          color: '#f1f5f9',
                          fontSize: '14px',
                          fontFamily: 'inherit',
                          resize: 'vertical'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => setEditingAutomation(null)}
                        style={{
                          padding: '8px 16px',
                          background: '#374151',
                          border: 'none',
                          borderRadius: '8px',
                          color: '#f1f5f9',
                          fontSize: '14px',
                          fontWeight: '500',
                          cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveAutomation}
                        style={{
                          padding: '8px 16px',
                          background: 'linear-gradient(135deg, #d71cd1, #8b5cf6)',
                          border: 'none',
                          borderRadius: '8px',
                          color: 'white',
                          fontSize: '14px',
                          fontWeight: '500',
                          cursor: 'pointer'
                        }}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View Mode */
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '20px'
                  }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{
                        color: '#f1f5f9',
                        fontSize: '16px',
                        fontWeight: '600',
                        margin: '0 0 8px 0'
                      }}>
                        {automation.label}
                      </h3>
                      <p style={{
                        color: '#64748b',
                        fontSize: '14px',
                        margin: 0,
                        lineHeight: '1.5'
                      }}>
                        {automation.description}
                      </p>
                    </div>

                    {/* Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button
                        onClick={() => setEditingAutomation(automation)}
                        style={{
                          padding: '6px 12px',
                          background: 'rgba(100, 116, 139, 0.1)',
                          border: '1px solid rgba(100, 116, 139, 0.3)',
                          borderRadius: '6px',
                          color: '#94a3b8',
                          fontSize: '13px',
                          fontWeight: '500',
                          cursor: 'pointer'
                        }}
                      >
                        Edit
                      </button>
                      <span style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        color: automation.enabled ? '#22c55e' : '#64748b'
                      }}>
                        {automation.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                      <button
                        onClick={() => toggleAutomation(automation.id, !automation.enabled)}
                        style={{
                          width: '52px',
                          height: '28px',
                          borderRadius: '14px',
                          border: 'none',
                          background: automation.enabled
                            ? 'linear-gradient(135deg, #22d3ee, #a855f7)'
                            : '#374151',
                          position: 'relative',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        <div style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          background: 'white',
                          position: 'absolute',
                          top: '3px',
                          left: automation.enabled ? '27px' : '3px',
                          transition: 'left 0.3s ease',
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                        }} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div style={{
              background: '#1d1d1d',
              borderRadius: '12px',
              padding: '40px',
              textAlign: 'center'
            }}>
              <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
                No automations configured. Please run the automation settings migration.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Estimator Config Tab */}
      {activeTab === 'estimator' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Vehicle Categories */}
          <div style={{ background: '#1d1d1d', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
              <h3 style={{ color: '#f1f5f9', fontSize: '16px', margin: '0 0 4px 0' }}>Vehicle Categories</h3>
              <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>These appear on the Shopify estimator for customers to select</p>
            </div>
            <button onClick={() => {
              setNewVehicle({
                category_key: '', label: '', size_factor: 'medium', base_sqft_min: 0, base_sqft_max: 0,
                sort_order: vehicleCategories.length + 1, notes: '',
                pricing: Object.fromEntries(projectTypes.map(pt => [pt.project_key, { price_min: 0, price_max: 0, typical_price: 0 }]))
              })
              setAddingVehicle(true)
            }} style={{
              padding: '8px 16px', background: '#d71cd1', border: 'none', borderRadius: '6px',
              color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer'
            }}>+ Add Category</button>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Order</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Label</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Key</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Size</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Notes</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Active</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {vehicleCategories.length > 0 ? vehicleCategories.map((v) => (
                  <tr key={v.id} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                    <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '13px' }}>{v.sort_order}</td>
                    <td style={{ padding: '12px 16px', color: '#f1f5f9', fontSize: '14px', fontWeight: '500' }}>{v.label}</td>
                    <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '12px', fontFamily: 'monospace' }}>{v.category_key}</td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '13px' }}>{v.size_factor}</td>
                    <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '13px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.notes || '-'}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{
                        padding: '4px 8px', borderRadius: '4px', fontSize: '12px',
                        background: v.active ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: v.active ? '#22c55e' : '#ef4444'
                      }}>{v.active ? 'Yes' : 'No'}</span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button onClick={() => setEditingVehicle({ ...v })} style={{
                          padding: '6px 10px', background: 'transparent', border: '1px solid rgba(148, 163, 184, 0.2)',
                          borderRadius: '4px', color: '#94a3b8', fontSize: '12px', cursor: 'pointer'
                        }}>Edit</button>
                        <button onClick={() => deleteVehicleCategory(v)} style={{
                          padding: '6px 10px', background: 'transparent', border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: '4px', color: '#ef4444', fontSize: '12px', cursor: 'pointer'
                        }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No vehicle categories found. Run the migration SQL first.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pricing Matrix */}
          <div style={{ background: '#1d1d1d', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
              <h3 style={{ color: '#f1f5f9', fontSize: '16px', margin: '0 0 4px 0' }}>Pricing Matrix</h3>
              <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Price ranges shown to customers on the estimator (per vehicle per project type)</p>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Vehicle</th>
                    {projectTypes.map(pt => (
                      <th key={pt.project_key} style={{ padding: '12px 16px', textAlign: 'center', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>{pt.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vehicleCategories.filter(v => v.active).map((v) => (
                    <tr key={v.category_key} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                      <td style={{ padding: '12px 16px', color: '#f1f5f9', fontSize: '14px', fontWeight: '500', whiteSpace: 'nowrap' }}>{v.label}</td>
                      {projectTypes.map(pt => {
                        const row = pricingMatrix.find(p => p.category_key === v.category_key && p.project_key === pt.project_key)
                        if (!row) return <td key={pt.project_key} style={{ padding: '12px 16px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>-</td>
                        return (
                          <td key={pt.project_key} style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <div
                              onClick={() => setEditingPricing({ ...row })}
                              style={{
                                padding: '8px 12px', background: '#282a30', borderRadius: '6px', cursor: 'pointer',
                                border: '1px solid transparent', transition: 'border-color 0.15s'
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(215, 28, 209, 0.4)')}
                              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'transparent')}
                            >
                              <span style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: '500' }}>
                                ${row.price_min.toLocaleString()} - ${row.price_max.toLocaleString()}
                              </span>
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

{/* Add Vehicle Modal */}
          {addingVehicle && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ background: '#1d1d1d', borderRadius: '16px', width: '600px', maxHeight: '90vh', overflow: 'auto' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#1d1d1d', zIndex: 1 }}>
                  <h3 style={{ color: '#f1f5f9', fontSize: '18px', margin: 0 }}>Add Vehicle Category</h3>
                  <button onClick={() => setAddingVehicle(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '24px' }}>x</button>
                </div>
                <div style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Category Key</label>
                      <input type="text" value={newVehicle.category_key} onChange={(e) => setNewVehicle({ ...newVehicle, category_key: e.target.value })} placeholder="e.g. MINIVAN" style={{ width: '100%', padding: '10px 14px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px', fontFamily: 'monospace' }} />
                      <p style={{ color: '#64748b', fontSize: '11px', margin: '4px 0 0 0' }}>Auto-uppercased, no spaces</p>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Label (shown to customers)</label>
                      <input type="text" value={newVehicle.label} onChange={(e) => setNewVehicle({ ...newVehicle, label: e.target.value })} placeholder="e.g. Minivan" style={{ width: '100%', padding: '10px 14px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }} />
                    </div>
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Notes (shown under label on estimator)</label>
                    <input type="text" value={newVehicle.notes} onChange={(e) => setNewVehicle({ ...newVehicle, notes: e.target.value })} placeholder="e.g. Odyssey, Sienna, Pacifica" style={{ width: '100%', padding: '10px 14px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Size Factor</label>
                      <select value={newVehicle.size_factor} onChange={(e) => setNewVehicle({ ...newVehicle, size_factor: e.target.value })} style={{ width: '100%', padding: '10px 14px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }}>
                        <option value="small">Small</option>
                        <option value="medium">Medium</option>
                        <option value="large">Large</option>
                        <option value="x-large">X-Large</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Sort Order</label>
                      <input type="number" value={newVehicle.sort_order} onChange={(e) => setNewVehicle({ ...newVehicle, sort_order: parseInt(e.target.value) || 0 })} style={{ width: '100%', padding: '10px 14px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }} />
                    </div>
                  </div>

                  {/* Pricing Section */}
                  <div style={{ borderTop: '1px solid rgba(148, 163, 184, 0.1)', paddingTop: '20px', marginTop: '8px' }}>
                    <h4 style={{ color: '#f1f5f9', fontSize: '15px', fontWeight: '600', margin: '0 0 16px 0' }}>Pricing by Project Type</h4>
                    {projectTypes.map(pt => {
                      const p = newVehicle.pricing[pt.project_key] || { price_min: 0, price_max: 0, typical_price: 0 }
                      return (
                        <div key={pt.project_key} style={{ marginBottom: '16px', padding: '16px', background: '#282a30', borderRadius: '8px' }}>
                          <p style={{ color: '#d71cd1', fontSize: '13px', fontWeight: '600', margin: '0 0 12px 0' }}>{pt.label}</p>
                          <div style={{ display: 'flex', gap: '12px' }}>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: 'block', color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>Min ($)</label>
                              <input type="number" value={p.price_min} onChange={(e) => setNewVehicle({
                                ...newVehicle,
                                pricing: { ...newVehicle.pricing, [pt.project_key]: { ...p, price_min: parseInt(e.target.value) || 0 } }
                              })} style={{ width: '100%', padding: '8px 12px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', color: '#f1f5f9', fontSize: '14px' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: 'block', color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>Max ($)</label>
                              <input type="number" value={p.price_max} onChange={(e) => setNewVehicle({
                                ...newVehicle,
                                pricing: { ...newVehicle.pricing, [pt.project_key]: { ...p, price_max: parseInt(e.target.value) || 0 } }
                              })} style={{ width: '100%', padding: '8px 12px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', color: '#f1f5f9', fontSize: '14px' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: 'block', color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>Typical ($)</label>
                              <input type="number" value={p.typical_price} onChange={(e) => setNewVehicle({
                                ...newVehicle,
                                pricing: { ...newVehicle.pricing, [pt.project_key]: { ...p, typical_price: parseInt(e.target.value) || 0 } }
                              })} style={{ width: '100%', padding: '8px 12px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', color: '#f1f5f9', fontSize: '14px' }} />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'flex-end', gap: '12px', position: 'sticky', bottom: 0, background: '#1d1d1d' }}>
                  <button onClick={() => setAddingVehicle(false)} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
                  <button onClick={addVehicleCategory} disabled={savingEstimator} style={{ padding: '10px 20px', background: '#d71cd1', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 500, opacity: savingEstimator ? 0.6 : 1 }}>
                    {savingEstimator ? 'Creating...' : 'Create Category'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Edit Vehicle Modal */}
          {editingVehicle && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ background: '#1d1d1d', borderRadius: '16px', width: '500px', overflow: 'hidden' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ color: '#f1f5f9', fontSize: '18px', margin: 0 }}>Edit Vehicle Category</h3>
                  <button onClick={() => setEditingVehicle(null)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '24px' }}>x</button>
                </div>
                <div style={{ padding: '20px' }}>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Key</label>
                    <input type="text" value={editingVehicle.category_key} disabled style={{ width: '100%', padding: '10px 14px', background: '#282a30', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#64748b', fontSize: '14px', fontFamily: 'monospace' }} />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Label (shown to customers)</label>
                    <input type="text" value={editingVehicle.label} onChange={(e) => setEditingVehicle({ ...editingVehicle, label: e.target.value })} style={{ width: '100%', padding: '10px 14px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }} />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Notes (shown under label)</label>
                    <input type="text" value={editingVehicle.notes || ''} onChange={(e) => setEditingVehicle({ ...editingVehicle, notes: e.target.value })} placeholder="e.g. Camry, Accord, Mustang" style={{ width: '100%', padding: '10px 14px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Size Factor</label>
                      <input type="text" value={editingVehicle.size_factor || ''} onChange={(e) => setEditingVehicle({ ...editingVehicle, size_factor: e.target.value })} style={{ width: '100%', padding: '10px 14px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Sort Order</label>
                      <input type="number" value={editingVehicle.sort_order} onChange={(e) => setEditingVehicle({ ...editingVehicle, sort_order: parseInt(e.target.value) || 0 })} style={{ width: '100%', padding: '10px 14px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }} />
                    </div>
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={editingVehicle.active} onChange={(e) => setEditingVehicle({ ...editingVehicle, active: e.target.checked })} style={{ width: '16px', height: '16px' }} />
                      <span style={{ color: '#94a3b8', fontSize: '13px' }}>Active (visible on estimator)</span>
                    </label>
                  </div>
                </div>
                <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button onClick={() => setEditingVehicle(null)} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
                  <button onClick={() => saveVehicleCategory(editingVehicle)} disabled={savingEstimator} style={{ padding: '10px 20px', background: '#d71cd1', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 500, opacity: savingEstimator ? 0.6 : 1 }}>
                    {savingEstimator ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Edit Pricing Modal */}
          {editingPricing && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ background: '#1d1d1d', borderRadius: '16px', width: '450px', overflow: 'hidden' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ color: '#f1f5f9', fontSize: '18px', margin: '0 0 4px 0' }}>Edit Pricing</h3>
                    <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
                      {vehicleCategories.find(v => v.category_key === editingPricing.category_key)?.label || editingPricing.category_key}
                      {' / '}
                      {projectTypes.find(p => p.project_key === editingPricing.project_key)?.label || editingPricing.project_key}
                    </p>
                  </div>
                  <button onClick={() => setEditingPricing(null)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '24px' }}>x</button>
                </div>
                <div style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Min Price ($)</label>
                      <input type="number" value={editingPricing.price_min} onChange={(e) => setEditingPricing({ ...editingPricing, price_min: parseInt(e.target.value) || 0 })} style={{ width: '100%', padding: '10px 14px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Max Price ($)</label>
                      <input type="number" value={editingPricing.price_max} onChange={(e) => setEditingPricing({ ...editingPricing, price_max: parseInt(e.target.value) || 0 })} style={{ width: '100%', padding: '10px 14px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }} />
                    </div>
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Typical Price ($)</label>
                    <input type="number" value={editingPricing.typical_price} onChange={(e) => setEditingPricing({ ...editingPricing, typical_price: parseInt(e.target.value) || 0 })} style={{ width: '100%', padding: '10px 14px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }} />
                  </div>
                </div>
                <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button onClick={() => setEditingPricing(null)} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
                  <button onClick={() => savePricingRow(editingPricing)} disabled={savingEstimator} style={{ padding: '10px 20px', background: '#d71cd1', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 500, opacity: savingEstimator ? 0.6 : 1 }}>
                    {savingEstimator ? 'Saving...' : 'Save Changes'}
                  </button>
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
                <h3 style={{ color: '#f1f5f9', fontSize: '16px', margin: '0 0 4px 0' }}>Gmail</h3>
                <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Read and send email from info@frederickwraps.com</p>
              </div>
              {gmailConnected ? (
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
                  onClick={() => window.location.href = '/api/gmail/auth'}
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
                  Connect Gmail
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