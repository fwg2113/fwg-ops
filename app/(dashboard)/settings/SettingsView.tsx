'use client'

import { useState, useEffect, Fragment } from 'react'
import { supabase } from '../../lib/supabase'
import { BUILTIN_SOUNDS, playSound, playCustomSound, type SoundOption } from '../../lib/notificationSounds'

type Category = {
  id: string
  category_key: string
  label: string
  calendar_color: string
  default_rate: number
  active: boolean
  template_key?: string
  customer_template_key?: string
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
  sip_uri: string | null
}

type TemplateTask = {
  id: string
  task_key: string
  label: string
  instructions: string | null
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

type CustomerWorkflowStep = {
  id: string
  template_key: string
  step_key: string
  label: string
  description: string | null
  instructions: string | null
  default_priority: string
  sort_order: number
  auto_complete_on_status: string | null
  active: boolean
}

type CustomerWorkflowTemplate = {
  id: string
  template_key: string
  category_key: string
  label: string
  description: string | null
  active: boolean
  sort_order: number
  customer_workflow_steps: CustomerWorkflowStep[]
}

type CustomSound = {
  id: string
  label: string
  dataUrl: string
  fileName: string
  size: number
  uploadedAt: string
}

type NotificationSettings = {
  sound_enabled: boolean
  sound_key: string
  message_sound_key: string
  email_sound_key: string
  payment_sound_key: string
  start_hour: number
  end_hour: number
  message_repeat_interval: number
  email_repeat_interval: number
  email_alerts_enabled: boolean
  email_alert_address: string
}

type Tab = 'categories' | 'materials' | 'buckets' | 'integrations' | 'calls' | 'production' | 'workflows' | 'statuses' | 'priorities' | 'automations' | 'estimator' | 'notifications' | 'dtf-pricing' | 'embroidery-markup' | 'embroidery-fee' | 'qty-tiers'

type DtfPricingMatrix = {
  id: string
  name: string
  decoration_type: string
  applies_to: string[]
  quantity_breaks: {
    min: number
    max: number
    markup_pct: number
    decoration_prices: Record<string, number>
  }[]
  created_at: string
  updated_at: string
}

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
  initialPricingMatrix,
  initialCustomerWorkflows,
  initialDtfPricing,
  initialEmbroideryMarkupPricing,
  initialEmbroideryFeePricing
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
  initialCustomerWorkflows: CustomerWorkflowTemplate[]
  initialDtfPricing?: DtfPricingMatrix | null
  initialEmbroideryMarkupPricing?: DtfPricingMatrix | null
  initialEmbroideryFeePricing?: DtfPricingMatrix | null
}) {
  const [activeTab, setActiveTab] = useState<Tab>('categories')
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [materials] = useState<Material[]>(initialMaterials)
  const [buckets] = useState<Bucket[]>(initialBuckets)
  const [callSettings, setCallSettings] = useState<CallSetting[]>(initialCallSettings)
  const [templates, setTemplates] = useState<ProductionTemplate[]>(initialTemplates)
  const [taskStatuses, setTaskStatuses] = useState<TaskStatus[]>(initialTaskStatuses)
  const [taskPriorities, setTaskPriorities] = useState<TaskPriority[]>(initialTaskPriorities)
  const [showAddPhone, setShowAddPhone] = useState(false)
  const [newPhone, setNewPhone] = useState({ name: '', phone: '', sip_uri: '' })
  const [editingSipId, setEditingSipId] = useState<string | null>(null)
  const [editingSipValue, setEditingSipValue] = useState('')
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<{ templateId: string; task: TemplateTask } | null>(null)
  const [addingTask, setAddingTask] = useState<string | null>(null)
  const [newTask, setNewTask] = useState({ task_key: '', label: '', instructions: '', default_priority: 'MEDIUM' })
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
  // DTF Pricing state
  const [dtfPricing, setDtfPricing] = useState<DtfPricingMatrix | null>(initialDtfPricing || null)
  const [editingDtfBreak, setEditingDtfBreak] = useState<number | null>(null)
  const [savingDtfPricing, setSavingDtfPricing] = useState(false)
  const [addingDtfBreak, setAddingDtfBreak] = useState(false)
  const [newDtfBreak, setNewDtfBreak] = useState({ min: 0, max: 0, markup_pct: 200, decoration_prices: { front: 5.00, back: 5.00, left_sleeve: 5.00, right_sleeve: 5.00, extra: 5.00 } })
  // Embroidery Markup state (separate qty breaks)
  const [embMarkupPricing, setEmbMarkupPricing] = useState<DtfPricingMatrix | null>(initialEmbroideryMarkupPricing || null)
  const [editingEmbMarkupBreak, setEditingEmbMarkupBreak] = useState<number | null>(null)
  const [savingEmbMarkupPricing, setSavingEmbMarkupPricing] = useState(false)
  const [addingEmbMarkupBreak, setAddingEmbMarkupBreak] = useState(false)
  const [newEmbMarkupBreak, setNewEmbMarkupBreak] = useState({ min: 0, max: 0, markup_pct: 200, decoration_prices: {} as Record<string, number> })
  // Embroidery Fee state (separate qty breaks)
  const [embFeePricing, setEmbFeePricing] = useState<DtfPricingMatrix | null>(initialEmbroideryFeePricing || null)
  const [editingEmbFeeBreak, setEditingEmbFeeBreak] = useState<number | null>(null)
  const [savingEmbFeePricing, setSavingEmbFeePricing] = useState(false)
  const [addingEmbFeeBreak, setAddingEmbFeeBreak] = useState(false)
  const [newEmbFeeBreak, setNewEmbFeeBreak] = useState({ min: 0, max: 0, markup_pct: 0, decoration_prices: { up_to_10k: 8.00 } })
  // Universal Qty Tiers state
  const [qtyTiers, setQtyTiers] = useState<{ min: number; max: number }[]>([])
  const [qtyTiersLoaded, setQtyTiersLoaded] = useState(false)
  const [editingTierIdx, setEditingTierIdx] = useState<number | null>(null)
  const [savingQtyTiers, setSavingQtyTiers] = useState(false)
  const [addingTier, setAddingTier] = useState(false)
  const [newTier, setNewTier] = useState({ min: 0, max: 0 })
  // Derive qty tiers from existing pricing matrix on mount
  useEffect(() => {
    if (!qtyTiersLoaded) {
      const source = dtfPricing || embMarkupPricing
      if (source && source.quantity_breaks) {
        const sorted = [...source.quantity_breaks].sort((a, b) => a.min - b.min)
        setQtyTiers(sorted.map(qb => ({ min: qb.min, max: qb.max })))
        setQtyTiersLoaded(true)
      }
    }
  }, [dtfPricing, embMarkupPricing, qtyTiersLoaded])
  // Customer Workflows state
  const [customerWorkflows, setCustomerWorkflows] = useState<CustomerWorkflowTemplate[]>(initialCustomerWorkflows)
  const [expandedWorkflow, setExpandedWorkflow] = useState<string | null>(null)
  const [editingWorkflowStep, setEditingWorkflowStep] = useState<{ templateId: string; templateKey: string; step: CustomerWorkflowStep } | null>(null)
  const [addingWorkflowStep, setAddingWorkflowStep] = useState<{ templateId: string; templateKey: string } | null>(null)
  const [newWorkflowStep, setNewWorkflowStep] = useState({ step_key: '', label: '', description: '', instructions: '', default_priority: 'MEDIUM', auto_complete_on_status: '' })
  const [propagating, setPropagating] = useState<string | null>(null)
  const [propagateResult, setPropagateResult] = useState<{ templateKey: string; message: string } | null>(null)
  const [linkingTemplate, setLinkingTemplate] = useState<{ type: 'production' | 'customer'; templateKey: string } | null>(null)

  // Notification settings state
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>({
    sound_enabled: true,
    sound_key: 'chime',
    message_sound_key: 'chime',
    email_sound_key: 'bell',
    payment_sound_key: 'cascade',
    start_hour: 9,
    end_hour: 17,
    message_repeat_interval: 60,
    email_repeat_interval: 60,
    email_alerts_enabled: true,
    email_alert_address: 'info@frederickwraps.com',
  })
  const [notifLoading, setNotifLoading] = useState(true)
  const [notifSaving, setNotifSaving] = useState(false)
  const [notifSaved, setNotifSaved] = useState(false)
  const [customSounds, setCustomSounds] = useState<CustomSound[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadLabel, setUploadLabel] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/settings/notifications').then(r => r.json()),
      fetch('/api/settings/notification-sounds').then(r => r.json()),
    ]).then(([notifData, soundsData]) => {
      setNotifSettings(notifData)
      setCustomSounds(soundsData.sounds || [])
      setNotifLoading(false)
    }).catch(() => setNotifLoading(false))
  }, [])

  const saveNotifSettings = async () => {
    setNotifSaving(true)
    setNotifSaved(false)
    try {
      const res = await fetch('/api/settings/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notifSettings)
      })
      if (res.ok) {
        setNotifSaved(true)
        window.dispatchEvent(new Event('notification-settings-changed'))
        setTimeout(() => setNotifSaved(false), 3000)
      }
    } catch (err) {
      alert('Failed to save notification settings')
    }
    setNotifSaving(false)
  }

  // Helpers: which categories use which template
  const getCategoriesForProductionTemplate = (templateKey: string) =>
    categories.filter(c => c.template_key === templateKey)
  const getCategoriesForCustomerTemplate = (templateKey: string) =>
    categories.filter(c => c.customer_template_key === templateKey)
  const getUnlinkedCategories = (type: 'production' | 'customer', currentTemplateKey: string) => {
    const column = type === 'production' ? 'template_key' : 'customer_template_key'
    return categories.filter(c => c[column] !== currentTemplateKey)
  }

  const linkCategoryToTemplate = async (categoryKey: string, type: 'production' | 'customer', targetTemplateKey: string) => {
    try {
      const res = await fetch('/api/settings/link-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryKey, type, targetTemplateKey })
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)
      const column = type === 'production' ? 'template_key' : 'customer_template_key'
      setCategories(categories.map(c =>
        c.category_key === categoryKey ? { ...c, [column]: targetTemplateKey } : c
      ))
      setLinkingTemplate(null)
    } catch (err: any) {
      alert('Error linking: ' + (err.message || 'Failed'))
    }
  }

  const unlinkCategory = async (categoryKey: string, type: 'production' | 'customer') => {
    try {
      const res = await fetch('/api/settings/link-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryKey, type, targetTemplateKey: null })
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)
      const column = type === 'production' ? 'template_key' : 'customer_template_key'
      setCategories(categories.map(c =>
        c.category_key === categoryKey ? { ...c, [column]: result.newTemplateKey } : c
      ))
    } catch (err: any) {
      alert('Error unlinking: ' + (err.message || 'Failed'))
    }
  }

  // Template CRUD state
  const [creatingTemplate, setCreatingTemplate] = useState<'production' | 'customer' | null>(null)
  const [newTemplate, setNewTemplate] = useState({ template_key: '', label: '', description: '', category_key: '' })
  const [editingTemplate, setEditingTemplate] = useState<{ type: 'production' | 'customer'; id: string; label: string; description: string } | null>(null)

  // Get categories that have no template assigned (for the create template modal)
  const getUnassignedCategories = (type: 'production' | 'customer') => {
    const column = type === 'production' ? 'template_key' : 'customer_template_key'
    return categories.filter(c => !c[column])
  }

  const createTemplate = async (type: 'production' | 'customer') => {
    if (!newTemplate.template_key.trim() || !newTemplate.label.trim()) {
      alert('Please enter both a key and label')
      return
    }
    try {
      const res = await fetch('/api/settings/manage-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', type, ...newTemplate })
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)
      if (type === 'production') {
        setTemplates([...templates, result.template])
      } else {
        setCustomerWorkflows([...customerWorkflows, result.template])
      }
      // Update category link if one was selected
      if (newTemplate.category_key) {
        const column = type === 'production' ? 'template_key' : 'customer_template_key'
        const cleanKey = newTemplate.template_key.trim().toUpperCase().replace(/\s+/g, '_')
        setCategories(categories.map(c =>
          c.category_key === newTemplate.category_key ? { ...c, [column]: cleanKey } : c
        ))
      }
      setNewTemplate({ template_key: '', label: '', description: '', category_key: '' })
      setCreatingTemplate(null)
    } catch (err: any) {
      alert('Error: ' + (err.message || 'Failed to create template'))
    }
  }

  const renameTemplate = async () => {
    if (!editingTemplate) return
    try {
      const res = await fetch('/api/settings/manage-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          type: editingTemplate.type,
          id: editingTemplate.id,
          label: editingTemplate.label,
          description: editingTemplate.description
        })
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)
      if (editingTemplate.type === 'production') {
        setTemplates(templates.map(t =>
          t.id === editingTemplate.id ? { ...t, label: editingTemplate.label, description: editingTemplate.description } : t
        ))
      } else {
        setCustomerWorkflows(customerWorkflows.map(w =>
          w.id === editingTemplate.id ? { ...w, label: editingTemplate.label, description: editingTemplate.description } : w
        ))
      }
      setEditingTemplate(null)
    } catch (err: any) {
      alert('Error: ' + (err.message || 'Failed to rename'))
    }
  }

  const deleteTemplate = async (type: 'production' | 'customer', id: string, templateKey: string) => {
    const linkedCount = type === 'production'
      ? getCategoriesForProductionTemplate(templateKey).length
      : getCategoriesForCustomerTemplate(templateKey).length
    if (linkedCount > 0) {
      alert(`Cannot delete: ${linkedCount} categories still use this template. Unlink them first.`)
      return
    }
    if (!confirm(`Delete template "${templateKey}" and all its ${type === 'production' ? 'tasks' : 'steps'}? This cannot be undone.`)) return
    try {
      const res = await fetch('/api/settings/manage-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', type, id })
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)
      if (type === 'production') {
        setTemplates(templates.filter(t => t.id !== id))
      } else {
        setCustomerWorkflows(customerWorkflows.filter(w => w.id !== id))
      }
    } catch (err: any) {
      alert('Error: ' + (err.message || 'Failed to delete'))
    }
  }

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
    { key: 'workflows', label: 'Customer Workflows' },
    { key: 'statuses', label: 'Task Statuses' },
    { key: 'priorities', label: 'Task Priorities' },
    { key: 'estimator', label: 'Estimator Config' },
    { key: 'qty-tiers', label: 'Qty Tiers' },
    { key: 'dtf-pricing', label: 'DTF Pricing' },
    { key: 'embroidery-markup', label: 'Emb. Markup' },
    { key: 'embroidery-fee', label: 'Emb. Fee' },
    { key: 'automations', label: 'Automations' },
    { key: 'notifications', label: 'Notifications' },
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
      const createdVehicle = json.record

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
        if (pJson.ok) newPricingRows.push(pJson.record)
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
        await fetch(`/api/estimator/settings?table=estimator_pricing&id=${row.id}`, {
          method: 'DELETE'
        })
      }
      // Delete the category
      const res = await fetch(`/api/estimator/settings?table=estimator_vehicle_categories&id=${vehicle.id}`, {
        method: 'DELETE'
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
    
    const insertData: Record<string, unknown> = {
      name: newPhone.name.trim(),
      phone: phoneFormatted,
      enabled: true,
      ring_order: callSettings.length + 1
    }
    if (newPhone.sip_uri.trim()) {
      let sipVal = newPhone.sip_uri.trim().replace(/^SIP:\s*/i, '')
      if (sipVal && !sipVal.startsWith('sip:')) sipVal = 'sip:' + sipVal
      insertData.sip_uri = sipVal
    }

    const { data, error } = await supabase
      .from('call_settings')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      alert('Error adding phone: ' + error.message)
      return
    }

    setCallSettings([...callSettings, data])
    setNewPhone({ name: '', phone: '', sip_uri: '' })
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

  const saveSipUri = async (id: string) => {
    let value = editingSipValue.trim() || null
    if (value) {
      value = value.replace(/^SIP:\s*/i, '')
      if (!value.startsWith('sip:')) value = 'sip:' + value
    }
    const { error } = await supabase
      .from('call_settings')
      .update({ sip_uri: value })
      .eq('id', id)

    if (error) {
      alert('Error saving SIP URI: ' + error.message)
      return
    }

    setCallSettings(callSettings.map(c =>
      c.id === id ? { ...c, sip_uri: value } : c
    ))
    setEditingSipId(null)
    setEditingSipValue('')
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
        instructions: newTask.instructions.trim() || null,
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
    setNewTask({ task_key: '', label: '', instructions: '', default_priority: 'MEDIUM' })
    setAddingTask(null)
  }

  // ---- Customer Workflow Step CRUD ----

  const addWorkflowStep = async (templateId: string, templateKey: string) => {
    if (!newWorkflowStep.step_key.trim() || !newWorkflowStep.label.trim()) {
      alert('Please enter both step key and label')
      return
    }

    const wf = customerWorkflows.find(w => w.id === templateId)
    const maxSort = Math.max(...(wf?.customer_workflow_steps.map(s => s.sort_order) || [0]), 0)

    const { data, error } = await supabase
      .from('customer_workflow_steps')
      .insert({
        template_key: templateKey,
        step_key: newWorkflowStep.step_key.trim().toUpperCase().replace(/\s+/g, '_'),
        label: newWorkflowStep.label.trim(),
        description: newWorkflowStep.description.trim() || null,
        instructions: newWorkflowStep.instructions.trim() || null,
        default_priority: newWorkflowStep.default_priority,
        sort_order: maxSort + 1,
        auto_complete_on_status: newWorkflowStep.auto_complete_on_status.trim() || null,
        active: true
      })
      .select()
      .single()

    if (error) {
      alert('Error adding step: ' + error.message)
      return
    }

    setCustomerWorkflows(customerWorkflows.map(w =>
      w.id === templateId
        ? { ...w, customer_workflow_steps: [...w.customer_workflow_steps, data] }
        : w
    ))
    setNewWorkflowStep({ step_key: '', label: '', description: '', instructions: '', default_priority: 'MEDIUM', auto_complete_on_status: '' })
    setAddingWorkflowStep(null)
  }

  const updateWorkflowStep = async (stepId: string, templateId: string, updates: Partial<CustomerWorkflowStep>) => {
    const { error } = await supabase
      .from('customer_workflow_steps')
      .update(updates)
      .eq('id', stepId)

    if (error) {
      alert('Error updating step: ' + error.message)
      return
    }

    setCustomerWorkflows(customerWorkflows.map(w => ({
      ...w,
      customer_workflow_steps: w.customer_workflow_steps.map(s =>
        s.id === stepId ? { ...s, ...updates } : s
      )
    })))
    setEditingWorkflowStep(null)
  }

  const deleteWorkflowStep = async (templateId: string, stepId: string) => {
    if (!confirm('Delete this step from the workflow? This will NOT remove completed actions from existing documents.')) return

    const { error } = await supabase
      .from('customer_workflow_steps')
      .delete()
      .eq('id', stepId)

    if (error) {
      alert('Error deleting step: ' + error.message)
      return
    }

    setCustomerWorkflows(customerWorkflows.map(w =>
      w.id === templateId
        ? { ...w, customer_workflow_steps: w.customer_workflow_steps.filter(s => s.id !== stepId) }
        : w
    ))
  }

  const propagateWorkflowChanges = async (templateKey: string) => {
    setPropagating(templateKey)
    setPropagateResult(null)
    try {
      const res = await fetch('/api/customer-actions/propagate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateKey })
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)
      setPropagateResult({
        templateKey,
        message: `Updated ${result.updated} actions, added ${result.added} new, removed ${result.removed} across ${result.totalDocuments} documents`
      })
    } catch (err: any) {
      setPropagateResult({ templateKey, message: 'Error: ' + (err.message || 'Failed to propagate') })
    }
    setPropagating(null)
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
      {activeTab === 'production' && (() => {
        const prodTemplatesWithUsers = templates.filter(t => getCategoriesForProductionTemplate(t.template_key).length > 0)
        const prodTemplatesOrphaned = templates.filter(t => getCategoriesForProductionTemplate(t.template_key).length === 0)
        return (
        <div style={{ background: '#1d1d1d', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ color: '#f1f5f9', fontSize: '16px', margin: '0 0 4px 0' }}>Production Workflow Templates</h3>
              <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Manage task templates for each service category. Link categories to share the same workflow.</p>
            </div>
            <button onClick={() => setCreatingTemplate('production')} style={{
              padding: '8px 16px', background: '#d71cd1', border: 'none', borderRadius: '8px',
              color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap'
            }}>
              + New Template
            </button>
          </div>
          <div style={{ padding: '12px' }}>
            {prodTemplatesWithUsers.length > 0 ? prodTemplatesWithUsers.map((template) => {
              const linkedCats = getCategoriesForProductionTemplate(template.template_key)
              const primaryCat = linkedCats.find(c => c.category_key === template.category_key)
              const additionalCats = linkedCats.filter(c => c.category_key !== template.category_key)
              return (
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
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
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
                      {additionalCats.map(c => (
                        <span key={c.category_key} style={{
                          padding: '4px 8px', borderRadius: '4px', fontSize: '11px',
                          background: 'rgba(6,182,212,0.1)', color: '#06b6d4', fontFamily: 'monospace',
                          display: 'flex', alignItems: 'center', gap: '4px'
                        }}>
                          {c.category_key}
                          <button onClick={(e) => { e.stopPropagation(); unlinkCategory(c.category_key, 'production') }}
                            style={{ background: 'none', border: 'none', color: '#06b6d4', cursor: 'pointer', fontSize: '13px', padding: '0 2px', lineHeight: 1 }}
                          >&times;</button>
                        </span>
                      ))}
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
                      {linkedCats.length > 1 && <span style={{ color: '#06b6d4' }}> &middot; Shared by {linkedCats.length} categories</span>}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <button onClick={(e) => { e.stopPropagation(); setEditingTemplate({ type: 'production', id: template.id, label: template.label, description: template.description || '' }) }}
                      style={{ padding: '4px 8px', background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '4px', color: '#94a3b8', fontSize: '11px', cursor: 'pointer' }}>
                      Rename
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); deleteTemplate('production', template.id, template.template_key) }}
                      style={{ padding: '4px 8px', background: 'transparent', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px', color: '#ef4444', fontSize: '11px', cursor: 'pointer' }}>
                      Delete
                    </button>
                    <span style={{ color: '#64748b', fontSize: '13px', marginLeft: '4px' }}>
                      {template.template_tasks?.length || 0} tasks
                    </span>
                    <span style={{ color: '#64748b', fontSize: '18px' }}>
                      {expandedTemplate === template.id ? '\u25BC' : '\u25B6'}
                    </span>
                  </div>
                </div>

                {/* Template Tasks */}
                {expandedTemplate === template.id && (
                  <div style={{ borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>
                    <div style={{ padding: '12px 20px', background: '#1d1d1d' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h5 style={{ color: '#94a3b8', fontSize: '13px', margin: 0, fontWeight: '600' }}>Tasks</h5>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setLinkingTemplate({ type: 'production', templateKey: template.template_key }) }}
                            style={{
                              padding: '6px 12px', background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.3)',
                              borderRadius: '6px', color: '#06b6d4', fontSize: '12px', fontWeight: '600', cursor: 'pointer'
                            }}
                          >
                            + Link Category
                          </button>
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
              )
            }) : (
              <p style={{ color: '#64748b', padding: '40px', textAlign: 'center' }}>
                No production templates configured
              </p>
            )}
            {prodTemplatesOrphaned.length > 0 && (
              <div style={{ marginTop: '16px', padding: '12px 16px', background: '#1a1a1a', borderRadius: '8px', border: '1px solid rgba(148,163,184,0.1)' }}>
                <p style={{ color: '#64748b', fontSize: '12px', margin: '0 0 8px 0' }}>Unused templates (no categories linked):</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {prodTemplatesOrphaned.map(t => (
                    <span key={t.id} style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', background: 'rgba(148,163,184,0.1)', color: '#64748b', fontFamily: 'monospace' }}>
                      {t.template_key}
                    </span>
                  ))}
                </div>
              </div>
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
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Instructions</label>
                    <textarea
                      value={editingTask.task.instructions || ''}
                      onChange={(e) => setEditingTask({
                        ...editingTask,
                        task: { ...editingTask.task, instructions: e.target.value || null }
                      })}
                      placeholder="Any specific instructions for this task..."
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: '#111111',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        borderRadius: '8px',
                        color: '#f1f5f9',
                        fontSize: '14px',
                        resize: 'vertical',
                        fontFamily: 'inherit'
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
                      instructions: editingTask.task.instructions,
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
                  <button onClick={() => { setAddingTask(null); setNewTask({ task_key: '', label: '', instructions: '', default_priority: 'MEDIUM' }) }} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '24px' }}>×</button>
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
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Instructions</label>
                    <textarea
                      value={newTask.instructions}
                      onChange={(e) => setNewTask({ ...newTask, instructions: e.target.value })}
                      placeholder="Any specific instructions for this task..."
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: '#111111',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        borderRadius: '8px',
                        color: '#f1f5f9',
                        fontSize: '14px',
                        resize: 'vertical',
                        fontFamily: 'inherit'
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
                  <button onClick={() => { setAddingTask(null); setNewTask({ task_key: '', label: '', instructions: '', default_priority: 'MEDIUM' }) }} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
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

          {/* Link Category Modal - Production */}
          {linkingTemplate && linkingTemplate.type === 'production' && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
              onClick={() => setLinkingTemplate(null)}>
              <div style={{ background: '#1d1d1d', borderRadius: '16px', width: '440px', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                <div style={{ padding: '20px', borderBottom: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ color: '#f1f5f9', fontSize: '18px', margin: 0 }}>Link Category</h3>
                  <button onClick={() => setLinkingTemplate(null)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '24px' }}>&times;</button>
                </div>
                <div style={{ padding: '20px' }}>
                  <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 12px 0' }}>
                    Select a category to share the <span style={{ color: '#06b6d4' }}>{linkingTemplate.templateKey}</span> production workflow:
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '300px', overflowY: 'auto' }}>
                    {getUnlinkedCategories('production', linkingTemplate.templateKey).map(c => (
                      <button key={c.category_key}
                        onClick={() => linkCategoryToTemplate(c.category_key, 'production', linkingTemplate.templateKey)}
                        style={{
                          padding: '10px 14px', background: '#282a30', border: '1px solid rgba(148,163,184,0.1)',
                          borderRadius: '8px', color: '#f1f5f9', fontSize: '14px', cursor: 'pointer', textAlign: 'left',
                          transition: 'border-color 0.15s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = '#06b6d4'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(148,163,184,0.1)'}
                      >
                        <span style={{ fontWeight: 600 }}>{c.label}</span>
                        <span style={{ color: '#64748b', fontSize: '12px', marginLeft: '8px', fontFamily: 'monospace' }}>{c.category_key}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        )
      })()}

      {/* Customer Workflows Tab */}
      {activeTab === 'workflows' && (() => {
        const cwfWithUsers = customerWorkflows.filter(w => getCategoriesForCustomerTemplate(w.template_key).length > 0)
        const cwfOrphaned = customerWorkflows.filter(w => getCategoriesForCustomerTemplate(w.template_key).length === 0)
        return (
        <div style={{ background: '#1d1d1d', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ color: '#f1f5f9', fontSize: '16px', margin: '0 0 4px 0' }}>Customer Workflow Templates</h3>
              <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Manage Action Center workflow steps for each service category. Link categories to share workflows. Use &quot;Save &amp; Push to Live&quot; to update all existing documents.</p>
            </div>
            <button onClick={() => setCreatingTemplate('customer')} style={{
              padding: '8px 16px', background: '#d71cd1', border: 'none', borderRadius: '8px',
              color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap'
            }}>
              + New Template
            </button>
          </div>
          <div style={{ padding: '12px' }}>
            {cwfWithUsers.length > 0 ? cwfWithUsers.map((wf) => {
              const linkedCats = getCategoriesForCustomerTemplate(wf.template_key)
              const additionalCats = linkedCats.filter(c => c.category_key !== wf.category_key)
              return (
              <div key={wf.id} style={{ background: '#282a30', borderRadius: '8px', marginBottom: '12px', overflow: 'hidden' }}>
                {/* Workflow Header */}
                <div
                  onClick={() => setExpandedWorkflow(expandedWorkflow === wf.id ? null : wf.id)}
                  style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <h4 style={{ color: '#f1f5f9', fontSize: '15px', fontWeight: '600', margin: 0 }}>{wf.label}</h4>
                      <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', background: 'rgba(168,85,247,0.1)', color: '#a855f7', fontFamily: 'monospace' }}>
                        {wf.category_key}
                      </span>
                      {additionalCats.map(c => (
                        <span key={c.category_key} style={{
                          padding: '4px 8px', borderRadius: '4px', fontSize: '11px',
                          background: 'rgba(6,182,212,0.1)', color: '#06b6d4', fontFamily: 'monospace',
                          display: 'flex', alignItems: 'center', gap: '4px'
                        }}>
                          {c.category_key}
                          <button onClick={(e) => { e.stopPropagation(); unlinkCategory(c.category_key, 'customer') }}
                            style={{ background: 'none', border: 'none', color: '#06b6d4', cursor: 'pointer', fontSize: '13px', padding: '0 2px', lineHeight: 1 }}
                          >&times;</button>
                        </span>
                      ))}
                      <span style={{
                        padding: '4px 8px', borderRadius: '4px', fontSize: '11px',
                        background: wf.active ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                        color: wf.active ? '#22c55e' : '#ef4444'
                      }}>
                        {wf.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0 0' }}>
                      {wf.description || 'No description'}
                      {linkedCats.length > 1 && <span style={{ color: '#06b6d4' }}> &middot; Shared by {linkedCats.length} categories</span>}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <button onClick={(e) => { e.stopPropagation(); setEditingTemplate({ type: 'customer', id: wf.id, label: wf.label, description: wf.description || '' }) }}
                      style={{ padding: '4px 8px', background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '4px', color: '#94a3b8', fontSize: '11px', cursor: 'pointer' }}>
                      Rename
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); deleteTemplate('customer', wf.id, wf.template_key) }}
                      style={{ padding: '4px 8px', background: 'transparent', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px', color: '#ef4444', fontSize: '11px', cursor: 'pointer' }}>
                      Delete
                    </button>
                    <span style={{ color: '#64748b', fontSize: '13px', marginLeft: '4px' }}>
                      {wf.customer_workflow_steps?.length || 0} steps
                    </span>
                    <span style={{ color: '#64748b', fontSize: '18px' }}>
                      {expandedWorkflow === wf.id ? '\u25BC' : '\u25B6'}
                    </span>
                  </div>
                </div>

                {/* Workflow Steps */}
                {expandedWorkflow === wf.id && (
                  <div style={{ borderTop: '1px solid rgba(148,163,184,0.1)' }}>
                    <div style={{ padding: '12px 20px', background: '#1d1d1d' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h5 style={{ color: '#94a3b8', fontSize: '13px', margin: 0, fontWeight: '600' }}>Workflow Steps</h5>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setLinkingTemplate({ type: 'customer', templateKey: wf.template_key }) }}
                            style={{
                              padding: '6px 12px', background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.3)',
                              borderRadius: '6px', color: '#06b6d4', fontSize: '12px', fontWeight: '600', cursor: 'pointer'
                            }}
                          >
                            + Link Category
                          </button>
                          <button
                            onClick={() => propagateWorkflowChanges(wf.template_key)}
                            disabled={propagating === wf.template_key}
                            style={{
                              padding: '6px 12px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)',
                              borderRadius: '6px', color: '#22c55e', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                              opacity: propagating === wf.template_key ? 0.5 : 1
                            }}
                          >
                            {propagating === wf.template_key ? 'Pushing...' : 'Save & Push to Live'}
                          </button>
                          <button
                            onClick={() => setAddingWorkflowStep({ templateId: wf.id, templateKey: wf.template_key })}
                            style={{ padding: '6px 12px', background: '#d71cd1', border: 'none', borderRadius: '6px', color: 'white', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                          >
                            + Add Step
                          </button>
                        </div>
                      </div>

                      {/* Propagate result message */}
                      {propagateResult && propagateResult.templateKey === wf.template_key && (
                        <div style={{
                          padding: '10px 14px', marginBottom: '12px', borderRadius: '8px', fontSize: '13px',
                          background: propagateResult.message.startsWith('Error') ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                          color: propagateResult.message.startsWith('Error') ? '#ef4444' : '#22c55e',
                          border: `1px solid ${propagateResult.message.startsWith('Error') ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`
                        }}>
                          {propagateResult.message}
                        </div>
                      )}

                      {wf.customer_workflow_steps && wf.customer_workflow_steps.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {wf.customer_workflow_steps
                            .sort((a, b) => a.sort_order - b.sort_order)
                            .map((step, index) => (
                            <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: '#282a30', borderRadius: '6px' }}>
                              <span style={{
                                width: '24px', height: '24px', borderRadius: '50%', background: '#06b6d4', color: 'white',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600', flexShrink: 0
                              }}>
                                {index + 1}
                              </span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ color: '#f1f5f9', fontSize: '14px', margin: '0 0 2px 0' }}>{step.label}</p>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  <span style={{ color: '#64748b', fontSize: '12px', fontFamily: 'monospace' }}>{step.step_key}</span>
                                  {step.auto_complete_on_status && (
                                    <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(168,85,247,0.1)', color: '#a855f7' }}>
                                      auto: {step.auto_complete_on_status}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span style={{
                                padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', flexShrink: 0,
                                background: step.default_priority === 'HIGH' ? 'rgba(239,68,68,0.1)' : step.default_priority === 'MEDIUM' ? 'rgba(245,158,11,0.1)' : 'rgba(148,163,184,0.1)',
                                color: step.default_priority === 'HIGH' ? '#ef4444' : step.default_priority === 'MEDIUM' ? '#f59e0b' : '#94a3b8'
                              }}>
                                {step.default_priority}
                              </span>
                              <button
                                onClick={() => setEditingWorkflowStep({ templateId: wf.id, templateKey: wf.template_key, step })}
                                style={{ padding: '6px 10px', background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '4px', color: '#94a3b8', fontSize: '12px', cursor: 'pointer' }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => deleteWorkflowStep(wf.id, step.id)}
                                style={{ padding: '6px 10px', background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', color: '#ef4444', fontSize: '12px', cursor: 'pointer' }}
                              >
                                Delete
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ color: '#64748b', fontSize: '13px', padding: '20px', textAlign: 'center', margin: 0 }}>
                          No steps defined for this workflow
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              )
            }) : (
              <p style={{ color: '#64748b', padding: '40px', textAlign: 'center' }}>
                No customer workflow templates configured
              </p>
            )}
            {cwfOrphaned.length > 0 && (
              <div style={{ marginTop: '16px', padding: '12px 16px', background: '#1a1a1a', borderRadius: '8px', border: '1px solid rgba(148,163,184,0.1)' }}>
                <p style={{ color: '#64748b', fontSize: '12px', margin: '0 0 8px 0' }}>Unused templates (no categories linked):</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {cwfOrphaned.map(w => (
                    <span key={w.id} style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', background: 'rgba(148,163,184,0.1)', color: '#64748b', fontFamily: 'monospace' }}>
                      {w.template_key}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Edit Workflow Step Modal */}
          {editingWorkflowStep && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ background: '#1d1d1d', borderRadius: '16px', width: '500px', overflow: 'hidden' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ color: '#f1f5f9', fontSize: '18px', margin: 0 }}>Edit Workflow Step</h3>
                  <button onClick={() => setEditingWorkflowStep(null)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '24px' }}>&times;</button>
                </div>
                <div style={{ padding: '20px' }}>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Step Key</label>
                    <input type="text" value={editingWorkflowStep.step.step_key} disabled
                      style={{ width: '100%', padding: '10px 14px', background: '#282a30', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#64748b', fontSize: '14px', fontFamily: 'monospace' }}
                    />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Label</label>
                    <input type="text" value={editingWorkflowStep.step.label}
                      onChange={e => setEditingWorkflowStep({ ...editingWorkflowStep, step: { ...editingWorkflowStep.step, label: e.target.value } })}
                      style={{ width: '100%', padding: '10px 14px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }}
                    />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Description</label>
                    <input type="text" value={editingWorkflowStep.step.description || ''}
                      onChange={e => setEditingWorkflowStep({ ...editingWorkflowStep, step: { ...editingWorkflowStep.step, description: e.target.value || null } })}
                      placeholder="Optional description"
                      style={{ width: '100%', padding: '10px 14px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }}
                    />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Instructions</label>
                    <textarea value={editingWorkflowStep.step.instructions || ''}
                      onChange={e => setEditingWorkflowStep({ ...editingWorkflowStep, step: { ...editingWorkflowStep.step, instructions: e.target.value || null } })}
                      placeholder="Any specific instructions for this step..."
                      rows={3}
                      style={{ width: '100%', padding: '10px 14px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px', resize: 'vertical', fontFamily: 'inherit' }}
                    />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Priority</label>
                    <select value={editingWorkflowStep.step.default_priority}
                      onChange={e => setEditingWorkflowStep({ ...editingWorkflowStep, step: { ...editingWorkflowStep.step, default_priority: e.target.value } })}
                      style={{ width: '100%', padding: '10px 14px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }}
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Auto-complete on Status</label>
                    <select value={editingWorkflowStep.step.auto_complete_on_status || ''}
                      onChange={e => setEditingWorkflowStep({ ...editingWorkflowStep, step: { ...editingWorkflowStep.step, auto_complete_on_status: e.target.value || null } })}
                      style={{ width: '100%', padding: '10px 14px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }}
                    >
                      <option value="">None (manual)</option>
                      <option value="draft">Draft</option>
                      <option value="sent">Sent</option>
                      <option value="viewed">Viewed</option>
                      <option value="approved">Approved</option>
                      <option value="partial">Partial Payment</option>
                      <option value="paid">Paid</option>
                    </select>
                    <p style={{ color: '#64748b', fontSize: '12px', margin: '4px 0 0 0' }}>
                      Step auto-completes when document reaches this status
                    </p>
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Sort Order</label>
                    <input type="number" value={editingWorkflowStep.step.sort_order}
                      onChange={e => setEditingWorkflowStep({ ...editingWorkflowStep, step: { ...editingWorkflowStep.step, sort_order: parseInt(e.target.value) || 0 } })}
                      style={{ width: '100%', padding: '10px 14px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }}
                    />
                  </div>
                </div>
                <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button onClick={() => setEditingWorkflowStep(null)} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
                  <button
                    onClick={() => updateWorkflowStep(editingWorkflowStep.step.id, editingWorkflowStep.templateId, {
                      label: editingWorkflowStep.step.label,
                      description: editingWorkflowStep.step.description,
                      instructions: editingWorkflowStep.step.instructions,
                      default_priority: editingWorkflowStep.step.default_priority,
                      auto_complete_on_status: editingWorkflowStep.step.auto_complete_on_status,
                      sort_order: editingWorkflowStep.step.sort_order
                    })}
                    style={{ padding: '10px 20px', background: '#d71cd1', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Add Workflow Step Modal */}
          {addingWorkflowStep && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ background: '#1d1d1d', borderRadius: '16px', width: '500px', overflow: 'hidden' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ color: '#f1f5f9', fontSize: '18px', margin: 0 }}>Add Workflow Step</h3>
                  <button onClick={() => { setAddingWorkflowStep(null); setNewWorkflowStep({ step_key: '', label: '', description: '', instructions: '', default_priority: 'MEDIUM', auto_complete_on_status: '' }) }} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '24px' }}>&times;</button>
                </div>
                <div style={{ padding: '20px' }}>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Step Key</label>
                    <input type="text" value={newWorkflowStep.step_key}
                      onChange={e => setNewWorkflowStep({ ...newWorkflowStep, step_key: e.target.value })}
                      placeholder="e.g. SEND_INVOICE"
                      style={{ width: '100%', padding: '10px 14px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px', fontFamily: 'monospace' }}
                    />
                    <p style={{ color: '#64748b', fontSize: '12px', margin: '4px 0 0 0' }}>Unique identifier (auto-converted to UPPERCASE)</p>
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Label</label>
                    <input type="text" value={newWorkflowStep.label}
                      onChange={e => setNewWorkflowStep({ ...newWorkflowStep, label: e.target.value })}
                      placeholder="e.g. Send Invoice"
                      style={{ width: '100%', padding: '10px 14px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }}
                    />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Description</label>
                    <input type="text" value={newWorkflowStep.description}
                      onChange={e => setNewWorkflowStep({ ...newWorkflowStep, description: e.target.value })}
                      placeholder="Optional description"
                      style={{ width: '100%', padding: '10px 14px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }}
                    />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Instructions</label>
                    <textarea value={newWorkflowStep.instructions}
                      onChange={e => setNewWorkflowStep({ ...newWorkflowStep, instructions: e.target.value })}
                      placeholder="Any specific instructions for this step..."
                      rows={3}
                      style={{ width: '100%', padding: '10px 14px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px', resize: 'vertical', fontFamily: 'inherit' }}
                    />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Priority</label>
                    <select value={newWorkflowStep.default_priority}
                      onChange={e => setNewWorkflowStep({ ...newWorkflowStep, default_priority: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }}
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Auto-complete on Status</label>
                    <select value={newWorkflowStep.auto_complete_on_status}
                      onChange={e => setNewWorkflowStep({ ...newWorkflowStep, auto_complete_on_status: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }}
                    >
                      <option value="">None (manual)</option>
                      <option value="draft">Draft</option>
                      <option value="sent">Sent</option>
                      <option value="viewed">Viewed</option>
                      <option value="approved">Approved</option>
                      <option value="partial">Partial Payment</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>
                </div>
                <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button onClick={() => { setAddingWorkflowStep(null); setNewWorkflowStep({ step_key: '', label: '', description: '', instructions: '', default_priority: 'MEDIUM', auto_complete_on_status: '' }) }} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
                  <button
                    onClick={() => addWorkflowStep(addingWorkflowStep.templateId, addingWorkflowStep.templateKey)}
                    style={{ padding: '10px 20px', background: '#d71cd1', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}
                  >
                    Add Step
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Link Category Modal - Customer */}
          {linkingTemplate && linkingTemplate.type === 'customer' && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
              onClick={() => setLinkingTemplate(null)}>
              <div style={{ background: '#1d1d1d', borderRadius: '16px', width: '440px', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                <div style={{ padding: '20px', borderBottom: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ color: '#f1f5f9', fontSize: '18px', margin: 0 }}>Link Category</h3>
                  <button onClick={() => setLinkingTemplate(null)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '24px' }}>&times;</button>
                </div>
                <div style={{ padding: '20px' }}>
                  <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 12px 0' }}>
                    Select a category to share the <span style={{ color: '#06b6d4' }}>{linkingTemplate.templateKey}</span> customer workflow:
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '300px', overflowY: 'auto' }}>
                    {getUnlinkedCategories('customer', linkingTemplate.templateKey).map(c => (
                      <button key={c.category_key}
                        onClick={() => linkCategoryToTemplate(c.category_key, 'customer', linkingTemplate.templateKey)}
                        style={{
                          padding: '10px 14px', background: '#282a30', border: '1px solid rgba(148,163,184,0.1)',
                          borderRadius: '8px', color: '#f1f5f9', fontSize: '14px', cursor: 'pointer', textAlign: 'left',
                          transition: 'border-color 0.15s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = '#06b6d4'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(148,163,184,0.1)'}
                      >
                        <span style={{ fontWeight: 600 }}>{c.label}</span>
                        <span style={{ color: '#64748b', fontSize: '12px', marginLeft: '8px', fontFamily: 'monospace' }}>{c.category_key}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        )
      })()}

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
                <Fragment key={setting.id}>
                <div
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
                      {setting.sip_uri && (
                        <p style={{ color: '#8b5cf6', fontSize: '12px', margin: '2px 0 0 0', fontFamily: 'monospace' }}>
                          SIP: {setting.sip_uri}
                        </p>
                      )}
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
                      onClick={() => {
                        setEditingSipId(editingSipId === setting.id ? null : setting.id)
                        setEditingSipValue(setting.sip_uri || '')
                      }}
                      style={{
                        padding: '6px 10px',
                        background: 'transparent',
                        border: `1px solid ${setting.sip_uri ? 'rgba(139, 92, 246, 0.4)' : 'rgba(148, 163, 184, 0.2)'}`,
                        borderRadius: '6px',
                        color: setting.sip_uri ? '#8b5cf6' : '#64748b',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      {setting.sip_uri ? 'SIP' : '+ SIP'}
                    </button>
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
                {editingSipId === setting.id && (
                  <div style={{
                    padding: '10px 16px 14px',
                    background: '#1e1f25',
                    borderRadius: '0 0 8px 8px',
                    marginTop: '-8px',
                    marginBottom: '8px',
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center'
                  }}>
                    <label style={{ color: '#8b5cf6', fontSize: '12px', fontWeight: 500, whiteSpace: 'nowrap' }}>SIP URI</label>
                    <input
                      type="text"
                      value={editingSipValue}
                      onChange={(e) => setEditingSipValue(e.target.value)}
                      placeholder="sip:name@yourdomain.sip.twilio.com"
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        background: '#282a30',
                        border: '1px solid rgba(139, 92, 246, 0.3)',
                        borderRadius: '6px',
                        color: '#f1f5f9',
                        fontSize: '13px',
                        fontFamily: 'monospace'
                      }}
                    />
                    <button
                      onClick={() => saveSipUri(setting.id)}
                      style={{
                        padding: '8px 14px',
                        background: '#8b5cf6',
                        border: 'none',
                        borderRadius: '6px',
                        color: 'white',
                        fontSize: '12px',
                        cursor: 'pointer',
                        fontWeight: 500
                      }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => { setEditingSipId(null); setEditingSipValue('') }}
                      style={{
                        padding: '8px 10px',
                        background: 'transparent',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        borderRadius: '6px',
                        color: '#64748b',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
                </Fragment>
              )) : (
                <p style={{ color: '#64748b', padding: '20px', textAlign: 'center' }}>No team phones configured</p>
              )}
            </div>
          </div>

          <div style={{ background: '#1d1d1d', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ color: '#f1f5f9', fontSize: '16px', margin: '0 0 12px 0' }}>How Call Forwarding Works</h3>
            <ul style={{ color: '#94a3b8', fontSize: '14px', margin: 0, paddingLeft: '20px', lineHeight: '1.8' }}>
              <li>When someone calls your Twilio number, all enabled phones, SIP apps, and the browser ring simultaneously</li>
              <li>First person to answer gets the call, others stop ringing</li>
              <li>Your business number shows as the caller ID (save it as "FWG" in your contacts)</li>
              <li>If no one answers within 40 seconds, caller goes to voicemail</li>
              <li>All calls are logged in the dashboard with caller info and duration</li>
              <li><strong style={{ color: '#8b5cf6' }}>SIP Apps:</strong> Add a SIP URI to ring a SIP app (Oiga, Linphone) on your phone — like Google Voice for your business number</li>
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
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>SIP URI <span style={{ color: '#64748b' }}>(optional — for SIP app calling)</span></label>
                    <input
                      type="text"
                      value={newPhone.sip_uri}
                      onChange={(e) => setNewPhone({ ...newPhone, sip_uri: e.target.value })}
                      placeholder="sip:name@yourdomain.sip.twilio.com"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: '#111111',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        borderRadius: '8px',
                        color: '#f1f5f9',
                        fontSize: '13px',
                        fontFamily: 'monospace'
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
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
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
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontSize: '12px', fontWeight: '600', width: '50px' }}>Order</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Label</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Key</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontSize: '12px', fontWeight: '600', width: '90px' }}>Size</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b', fontSize: '12px', fontWeight: '600', width: '60px' }}>Active</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b', fontSize: '12px', fontWeight: '600', width: '130px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {vehicleCategories.length > 0 ? vehicleCategories.map((v) => (
                  <tr key={v.id} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                    <td style={{ padding: '10px 12px', color: '#94a3b8', fontSize: '13px' }}>{v.sort_order}</td>
                    <td style={{ padding: '10px 12px', color: '#f1f5f9', fontSize: '13px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.label}</td>
                    <td style={{ padding: '10px 12px', color: '#64748b', fontSize: '11px', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.category_key}</td>
                    <td style={{ padding: '10px 12px', color: '#94a3b8', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.size_factor}</td>
                    
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
                  <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No vehicle categories found. Run the migration SQL first.</td></tr>
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
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
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
                    <tr key={v.id} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
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
                      <input type="text" inputMode="numeric" value={newVehicle.sort_order} onChange={(e) => setNewVehicle({ ...newVehicle, sort_order: parseInt(e.target.value) || 0 })} style={{ width: '100%', padding: '10px 14px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }} />
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
                              <input type="text" inputMode="numeric" value={p.price_min} onChange={(e) => setNewVehicle({
                                ...newVehicle,
                                pricing: { ...newVehicle.pricing, [pt.project_key]: { ...p, price_min: parseInt(e.target.value) || 0 } }
                              })} style={{ width: '100%', padding: '8px 12px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', color: '#f1f5f9', fontSize: '14px' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: 'block', color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>Max ($)</label>
                              <input type="text" inputMode="numeric" value={p.price_max} onChange={(e) => setNewVehicle({
                                ...newVehicle,
                                pricing: { ...newVehicle.pricing, [pt.project_key]: { ...p, price_max: parseInt(e.target.value) || 0 } }
                              })} style={{ width: '100%', padding: '8px 12px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', color: '#f1f5f9', fontSize: '14px' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: 'block', color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>Typical ($)</label>
                              <input type="text" inputMode="numeric" value={p.typical_price} onChange={(e) => setNewVehicle({
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
                      <input type="text" inputMode="numeric" value={editingVehicle.sort_order} onChange={(e) => setEditingVehicle({ ...editingVehicle, sort_order: parseInt(e.target.value) || 0 })} style={{ width: '100%', padding: '10px 14px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }} />
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
                      <input type="text" inputMode="numeric" value={editingPricing.price_min} onChange={(e) => setEditingPricing({ ...editingPricing, price_min: parseInt(e.target.value) || 0 })} style={{ width: '100%', padding: '10px 14px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Max Price ($)</label>
                      <input type="text" inputMode="numeric" value={editingPricing.price_max} onChange={(e) => setEditingPricing({ ...editingPricing, price_max: parseInt(e.target.value) || 0 })} style={{ width: '100%', padding: '10px 14px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }} />
                    </div>
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Typical Price ($)</label>
                    <input type="text" inputMode="numeric" value={editingPricing.typical_price} onChange={(e) => setEditingPricing({ ...editingPricing, typical_price: parseInt(e.target.value) || 0 })} style={{ width: '100%', padding: '10px 14px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }} />
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

      {/* Qty Tiers Tab */}
      {activeTab === 'qty-tiers' && (
        <div style={{ background: '#1d1d1d', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
            <h3 style={{ color: '#f1f5f9', fontSize: '16px', margin: '0 0 4px 0' }}>Universal Quantity Tiers</h3>
            <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
              Set the quantity breakpoints used across all pricing matrices (DTF, Embroidery). Changes here update all matrices at once.
            </p>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(148, 163, 184, 0.05)' }}>
                <th style={{ padding: '12px 20px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Tier</th>
                <th style={{ padding: '12px 20px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Min Qty</th>
                <th style={{ padding: '12px 20px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Max Qty</th>
                <th style={{ padding: '12px 20px', textAlign: 'right', color: '#94a3b8', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {qtyTiers.map((tier, index) => (
                editingTierIdx === index ? (
                  <tr key={index} style={{ borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>
                    <td style={{ padding: '12px 20px', color: '#94a3b8', fontSize: '13px', fontWeight: 600 }}>Tier {index + 1}</td>
                    <td style={{ padding: '12px 20px' }}>
                      <input
                        type="number"
                        value={tier.min}
                        onChange={e => {
                          const updated = [...qtyTiers]
                          updated[index] = { ...updated[index], min: parseInt(e.target.value) || 0 }
                          setQtyTiers(updated)
                        }}
                        style={{ width: '90px', padding: '6px 10px', background: '#111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', color: '#f1f5f9', fontSize: '13px' }}
                      />
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <input
                        type="number"
                        value={tier.max}
                        onChange={e => {
                          const updated = [...qtyTiers]
                          updated[index] = { ...updated[index], max: parseInt(e.target.value) || 0 }
                          setQtyTiers(updated)
                        }}
                        style={{ width: '90px', padding: '6px 10px', background: '#111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', color: '#f1f5f9', fontSize: '13px' }}
                      />
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => {
                            // Reload original tiers from pricing data
                            const source = dtfPricing || embMarkupPricing
                            if (source && source.quantity_breaks) {
                              const sorted = [...source.quantity_breaks].sort((a, b) => a.min - b.min)
                              setQtyTiers(sorted.map(qb => ({ min: qb.min, max: qb.max })))
                            }
                            setEditingTierIdx(null)
                          }}
                          style={{ padding: '6px 12px', background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', color: '#94a3b8', cursor: 'pointer', fontSize: '12px' }}
                        >Cancel</button>
                        <button
                          onClick={async () => {
                            setSavingQtyTiers(true)
                            try {
                              const res = await fetch('/api/settings/qty-tiers', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ tiers: qtyTiers })
                              })
                              if (res.ok) {
                                setEditingTierIdx(null)
                                // Refresh DTF pricing to reflect new ranges
                                const dtfRes = await fetch('/api/settings/dtf-pricing')
                                if (dtfRes.ok) setDtfPricing(await dtfRes.json())
                              } else {
                                alert('Failed to save qty tiers')
                              }
                            } catch {
                              alert('Error saving qty tiers')
                            }
                            setSavingQtyTiers(false)
                          }}
                          disabled={savingQtyTiers}
                          style={{ padding: '6px 12px', background: '#d71cd1', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 500, opacity: savingQtyTiers ? 0.6 : 1 }}
                        >{savingQtyTiers ? 'Saving...' : 'Save All'}</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={index} style={{ borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>
                    <td style={{ padding: '12px 20px', color: '#94a3b8', fontSize: '13px', fontWeight: 600 }}>Tier {index + 1}</td>
                    <td style={{ padding: '12px 20px', color: '#f1f5f9', fontSize: '14px' }}>{tier.min}</td>
                    <td style={{ padding: '12px 20px', color: '#f1f5f9', fontSize: '14px' }}>{tier.max === 99999 ? '∞' : tier.max}</td>
                    <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setEditingTierIdx(index)}
                          style={{ padding: '6px 12px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '6px', color: '#a78bfa', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}
                        >Edit</button>
                        <button
                          onClick={async () => {
                            if (!confirm(`Remove tier ${index + 1} (${tier.min}-${tier.max === 99999 ? '∞' : tier.max})?`)) return
                            const updated = qtyTiers.filter((_, i) => i !== index)
                            setSavingQtyTiers(true)
                            try {
                              const res = await fetch('/api/settings/qty-tiers', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ tiers: updated })
                              })
                              if (res.ok) {
                                setQtyTiers(updated)
                                const dtfRes = await fetch('/api/settings/dtf-pricing')
                                if (dtfRes.ok) setDtfPricing(await dtfRes.json())
                              } else {
                                alert('Failed to remove tier')
                              }
                            } catch {
                              alert('Error removing tier')
                            }
                            setSavingQtyTiers(false)
                          }}
                          style={{ padding: '6px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#ef4444', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}
                        >Remove</button>
                      </div>
                    </td>
                  </tr>
                )
              ))}
              {/* Add Tier Row */}
              {addingTier ? (
                <tr style={{ borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>
                  <td style={{ padding: '12px 20px', color: '#94a3b8', fontSize: '13px', fontWeight: 600 }}>New</td>
                  <td style={{ padding: '12px 20px' }}>
                    <input
                      type="number"
                      value={newTier.min || ''}
                      placeholder="Min"
                      onChange={e => setNewTier({ ...newTier, min: parseInt(e.target.value) || 0 })}
                      style={{ width: '90px', padding: '6px 10px', background: '#111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', color: '#f1f5f9', fontSize: '13px' }}
                    />
                  </td>
                  <td style={{ padding: '12px 20px' }}>
                    <input
                      type="number"
                      value={newTier.max || ''}
                      placeholder="Max"
                      onChange={e => setNewTier({ ...newTier, max: parseInt(e.target.value) || 0 })}
                      style={{ width: '90px', padding: '6px 10px', background: '#111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', color: '#f1f5f9', fontSize: '13px' }}
                    />
                  </td>
                  <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => { setAddingTier(false); setNewTier({ min: 0, max: 0 }) }}
                        style={{ padding: '6px 12px', background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', color: '#94a3b8', cursor: 'pointer', fontSize: '12px' }}
                      >Cancel</button>
                      <button
                        onClick={async () => {
                          if (newTier.min <= 0 || newTier.max <= 0 || newTier.max < newTier.min) {
                            alert('Please enter valid min and max values (max must be >= min)')
                            return
                          }
                          const updated = [...qtyTiers, newTier].sort((a, b) => a.min - b.min)
                          setSavingQtyTiers(true)
                          try {
                            const res = await fetch('/api/settings/qty-tiers', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ tiers: updated })
                            })
                            if (res.ok) {
                              setQtyTiers(updated)
                              setAddingTier(false)
                              setNewTier({ min: 0, max: 0 })
                              const dtfRes = await fetch('/api/settings/dtf-pricing')
                              if (dtfRes.ok) setDtfPricing(await dtfRes.json())
                            } else {
                              alert('Failed to add tier')
                            }
                          } catch {
                            alert('Error adding tier')
                          }
                          setSavingQtyTiers(false)
                        }}
                        disabled={savingQtyTiers}
                        style={{ padding: '6px 12px', background: '#d71cd1', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 500, opacity: savingQtyTiers ? 0.6 : 1 }}
                      >{savingQtyTiers ? 'Saving...' : 'Add & Save'}</button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr style={{ borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>
                  <td colSpan={4} style={{ padding: '12px 20px' }}>
                    <button
                      onClick={() => {
                        // Auto-suggest next tier range
                        const lastTier = qtyTiers[qtyTiers.length - 1]
                        const suggestedMin = lastTier ? lastTier.max + 1 : 1
                        setNewTier({ min: suggestedMin, max: suggestedMin + 99 })
                        setAddingTier(true)
                      }}
                      style={{ padding: '8px 16px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '6px', color: '#a78bfa', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
                    >+ Add Tier</button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(148, 163, 184, 0.1)', background: 'rgba(139,92,246,0.05)' }}>
            <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0, lineHeight: 1.5 }}>
              These quantity ranges are shared across all decoration types (DTF, Embroidery). Editing ranges here updates all pricing matrices. To adjust markup % or decoration fees per tier, use the DTF Pricing or Embroidery Pricing tabs.
            </p>
          </div>
        </div>
      )}

      {/* DTF Pricing Tab */}
      {activeTab === 'dtf-pricing' && dtfPricing && (
        <div style={{ background: '#1d1d1d', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
            <h3 style={{ color: '#f1f5f9', fontSize: '16px', margin: '0 0 4px 0' }}>DTF Apparel Pricing Matrix</h3>
            <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Manage quantity breaks and markup percentages for DTF apparel</p>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(148, 163, 184, 0.05)' }}>
                <th style={{ padding: '12px 20px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Qty Range</th>
                <th style={{ padding: '12px 20px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Markup %</th>
                <th style={{ padding: '12px 20px', textAlign: 'right', color: '#94a3b8', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {dtfPricing.quantity_breaks.map((qtyBreak, index) => (
                editingDtfBreak === index ? (
                  <tr key={index} style={{ borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>
                    <td style={{ padding: '12px 20px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="number"
                          value={qtyBreak.min}
                          onChange={e => {
                            const newBreaks = [...dtfPricing.quantity_breaks]
                            newBreaks[index] = { ...newBreaks[index], min: parseInt(e.target.value) || 0 }
                            setDtfPricing({ ...dtfPricing, quantity_breaks: newBreaks })
                          }}
                          style={{ width: '80px', padding: '6px 10px', background: '#111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', color: '#f1f5f9', fontSize: '13px' }}
                        />
                        <span style={{ color: '#64748b' }}>to</span>
                        <input
                          type="number"
                          value={qtyBreak.max}
                          onChange={e => {
                            const newBreaks = [...dtfPricing.quantity_breaks]
                            newBreaks[index] = { ...newBreaks[index], max: parseInt(e.target.value) || 0 }
                            setDtfPricing({ ...dtfPricing, quantity_breaks: newBreaks })
                          }}
                          style={{ width: '80px', padding: '6px 10px', background: '#111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', color: '#f1f5f9', fontSize: '13px' }}
                        />
                      </div>
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="number"
                          value={qtyBreak.markup_pct}
                          onChange={e => {
                            const newBreaks = [...dtfPricing.quantity_breaks]
                            newBreaks[index] = { ...newBreaks[index], markup_pct: parseInt(e.target.value) || 0 }
                            setDtfPricing({ ...dtfPricing, quantity_breaks: newBreaks })
                          }}
                          style={{ width: '80px', padding: '6px 10px', background: '#111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', color: '#f1f5f9', fontSize: '13px' }}
                        />
                        <span style={{ color: '#64748b' }}>%</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => {
                            // Reload from server to cancel
                            fetch('/api/settings/dtf-pricing').then(r => r.json()).then(d => { if (d?.quantity_breaks) setDtfPricing(d) })
                            setEditingDtfBreak(null)
                          }}
                          style={{ padding: '6px 12px', background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', color: '#94a3b8', cursor: 'pointer', fontSize: '12px' }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={async () => {
                            setSavingDtfPricing(true)
                            try {
                              const res = await fetch('/api/settings/dtf-pricing', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id: dtfPricing.id, quantity_breaks: dtfPricing.quantity_breaks })
                              })
                              if (res.ok) {
                                setEditingDtfBreak(null)
                              } else {
                                alert('Failed to save pricing')
                              }
                            } catch (err) {
                              alert('Error saving pricing')
                            }
                            setSavingDtfPricing(false)
                          }}
                          disabled={savingDtfPricing}
                          style={{ padding: '6px 12px', background: '#d71cd1', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 500, opacity: savingDtfPricing ? 0.6 : 1 }}
                        >
                          {savingDtfPricing ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={index} style={{ borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>
                    <td style={{ padding: '12px 20px', color: '#f1f5f9', fontSize: '14px' }}>
                      {qtyBreak.min} - {qtyBreak.max === 99999 ? '∞' : qtyBreak.max}
                    </td>
                    <td style={{ padding: '12px 20px', color: '#f1f5f9', fontSize: '14px', fontWeight: 600 }}>
                      {qtyBreak.markup_pct}%
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setEditingDtfBreak(index)}
                          style={{ padding: '6px 12px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '6px', color: '#a78bfa', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`Remove tier ${qtyBreak.min}-${qtyBreak.max === 99999 ? '∞' : qtyBreak.max}?`)) return
                            setSavingDtfPricing(true)
                            try {
                              const newBreaks = dtfPricing.quantity_breaks.filter((_, i) => i !== index)
                              const res = await fetch('/api/settings/dtf-pricing', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id: dtfPricing.id, quantity_breaks: newBreaks })
                              })
                              if (res.ok) {
                                setDtfPricing({ ...dtfPricing, quantity_breaks: newBreaks })
                              } else {
                                alert('Failed to remove tier')
                              }
                            } catch {
                              alert('Error removing tier')
                            }
                            setSavingDtfPricing(false)
                          }}
                          style={{ padding: '6px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#ef4444', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              ))}

              {/* Add new row */}
              {addingDtfBreak ? (
                <tr style={{ borderTop: '1px solid rgba(148, 163, 184, 0.1)', background: 'rgba(139,92,246,0.03)' }}>
                  <td style={{ padding: '12px 20px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="number"
                        value={newDtfBreak.min || ''}
                        placeholder="Min"
                        onChange={e => setNewDtfBreak({ ...newDtfBreak, min: parseInt(e.target.value) || 0 })}
                        style={{ width: '80px', padding: '6px 10px', background: '#111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', color: '#f1f5f9', fontSize: '13px' }}
                      />
                      <span style={{ color: '#64748b' }}>to</span>
                      <input
                        type="number"
                        value={newDtfBreak.max || ''}
                        placeholder="Max"
                        onChange={e => setNewDtfBreak({ ...newDtfBreak, max: parseInt(e.target.value) || 0 })}
                        style={{ width: '80px', padding: '6px 10px', background: '#111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', color: '#f1f5f9', fontSize: '13px' }}
                      />
                    </div>
                  </td>
                  <td style={{ padding: '12px 20px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="number"
                        value={newDtfBreak.markup_pct}
                        onChange={e => setNewDtfBreak({ ...newDtfBreak, markup_pct: parseInt(e.target.value) || 0 })}
                        style={{ width: '80px', padding: '6px 10px', background: '#111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', color: '#f1f5f9', fontSize: '13px' }}
                      />
                      <span style={{ color: '#64748b' }}>%</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => { setAddingDtfBreak(false); setNewDtfBreak({ min: 0, max: 0, markup_pct: 200, decoration_prices: { front: 5.00, back: 5.00, left_sleeve: 5.00, right_sleeve: 5.00, extra: 5.00 } }) }}
                        style={{ padding: '6px 12px', background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', color: '#94a3b8', cursor: 'pointer', fontSize: '12px' }}
                      >Cancel</button>
                      <button
                        onClick={async () => {
                          if (newDtfBreak.min <= 0 || newDtfBreak.max <= 0 || newDtfBreak.max < newDtfBreak.min) {
                            alert('Max must be >= Min, and both must be > 0')
                            return
                          }
                          setSavingDtfPricing(true)
                          try {
                            const newBreaks = [...dtfPricing.quantity_breaks, newDtfBreak].sort((a, b) => a.min - b.min)
                            const res = await fetch('/api/settings/dtf-pricing', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ id: dtfPricing.id, quantity_breaks: newBreaks })
                            })
                            if (res.ok) {
                              setDtfPricing({ ...dtfPricing, quantity_breaks: newBreaks })
                              setAddingDtfBreak(false)
                              setNewDtfBreak({ min: 0, max: 0, markup_pct: 200, decoration_prices: { front: 5.00, back: 5.00, left_sleeve: 5.00, right_sleeve: 5.00, extra: 5.00 } })
                            } else {
                              alert('Failed to add tier')
                            }
                          } catch {
                            alert('Error adding tier')
                          }
                          setSavingDtfPricing(false)
                        }}
                        disabled={savingDtfPricing}
                        style={{ padding: '6px 12px', background: '#d71cd1', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 500, opacity: savingDtfPricing ? 0.6 : 1 }}
                      >{savingDtfPricing ? 'Saving...' : 'Add & Save'}</button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr style={{ borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>
                  <td colSpan={3} style={{ padding: '12px 20px' }}>
                    <button
                      onClick={() => {
                        const lastBreak = dtfPricing.quantity_breaks[dtfPricing.quantity_breaks.length - 1]
                        const suggestedMin = lastBreak ? lastBreak.max + 1 : 1
                        setNewDtfBreak({ min: suggestedMin, max: suggestedMin + 99, markup_pct: 200, decoration_prices: { front: 5.00, back: 5.00, left_sleeve: 5.00, right_sleeve: 5.00, extra: 5.00 } })
                        setAddingDtfBreak(true)
                      }}
                      style={{ padding: '8px 16px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '6px', color: '#a78bfa', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
                    >+ Add Row</button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(148, 163, 184, 0.1)', background: 'rgba(139,92,246,0.05)' }}>
            <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0, lineHeight: 1.5 }}>
              These markup percentages are applied to garment wholesale prices. Changes apply to future quotes only — existing approved quotes are not affected.
            </p>
          </div>
        </div>
      )}

      {/* Embroidery Markup Tab */}
      {activeTab === 'embroidery-markup' && embMarkupPricing && (
        <div style={{ background: '#1d1d1d', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
            <h3 style={{ color: '#f1f5f9', fontSize: '16px', margin: '0 0 4px 0' }}>Embroidery Markup Matrix</h3>
            <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Manage quantity breaks and markup percentages for embroidery apparel</p>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(148, 163, 184, 0.05)' }}>
                <th style={{ padding: '12px 20px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Qty Range</th>
                <th style={{ padding: '12px 20px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Markup %</th>
                <th style={{ padding: '12px 20px', textAlign: 'right', color: '#94a3b8', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {embMarkupPricing.quantity_breaks.map((qtyBreak, index) => (
                editingEmbMarkupBreak === index ? (
                  <tr key={index} style={{ borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>
                    <td style={{ padding: '12px 20px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="number"
                          value={qtyBreak.min}
                          onChange={e => {
                            const newBreaks = [...embMarkupPricing.quantity_breaks]
                            newBreaks[index] = { ...newBreaks[index], min: parseInt(e.target.value) || 0 }
                            setEmbMarkupPricing({ ...embMarkupPricing, quantity_breaks: newBreaks })
                          }}
                          style={{ width: '80px', padding: '6px 10px', background: '#111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', color: '#f1f5f9', fontSize: '13px' }}
                        />
                        <span style={{ color: '#64748b' }}>to</span>
                        <input
                          type="number"
                          value={qtyBreak.max}
                          onChange={e => {
                            const newBreaks = [...embMarkupPricing.quantity_breaks]
                            newBreaks[index] = { ...newBreaks[index], max: parseInt(e.target.value) || 0 }
                            setEmbMarkupPricing({ ...embMarkupPricing, quantity_breaks: newBreaks })
                          }}
                          style={{ width: '80px', padding: '6px 10px', background: '#111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', color: '#f1f5f9', fontSize: '13px' }}
                        />
                      </div>
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="number"
                          value={qtyBreak.markup_pct}
                          onChange={e => {
                            const newBreaks = [...embMarkupPricing.quantity_breaks]
                            newBreaks[index] = { ...newBreaks[index], markup_pct: parseInt(e.target.value) || 0 }
                            setEmbMarkupPricing({ ...embMarkupPricing, quantity_breaks: newBreaks })
                          }}
                          style={{ width: '80px', padding: '6px 10px', background: '#111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', color: '#f1f5f9', fontSize: '13px' }}
                        />
                        <span style={{ color: '#64748b' }}>%</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => {
                            fetch('/api/settings/embroidery-markup-pricing').then(r => r.json()).then(d => { if (d?.quantity_breaks) setEmbMarkupPricing(d) })
                            setEditingEmbMarkupBreak(null)
                          }}
                          style={{ padding: '6px 12px', background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', color: '#94a3b8', cursor: 'pointer', fontSize: '12px' }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={async () => {
                            setSavingEmbMarkupPricing(true)
                            try {
                              const res = await fetch('/api/settings/embroidery-markup-pricing', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id: embMarkupPricing.id, quantity_breaks: embMarkupPricing.quantity_breaks })
                              })
                              if (res.ok) {
                                setEditingEmbMarkupBreak(null)
                              } else {
                                alert('Failed to save pricing')
                              }
                            } catch (err) {
                              alert('Error saving pricing')
                            }
                            setSavingEmbMarkupPricing(false)
                          }}
                          disabled={savingEmbMarkupPricing}
                          style={{ padding: '6px 12px', background: '#d71cd1', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 500, opacity: savingEmbMarkupPricing ? 0.6 : 1 }}
                        >
                          {savingEmbMarkupPricing ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={index} style={{ borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>
                    <td style={{ padding: '12px 20px', color: '#f1f5f9', fontSize: '14px' }}>
                      {qtyBreak.min} - {qtyBreak.max === 99999 ? '∞' : qtyBreak.max}
                    </td>
                    <td style={{ padding: '12px 20px', color: '#f1f5f9', fontSize: '14px', fontWeight: 600 }}>
                      {qtyBreak.markup_pct}%
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setEditingEmbMarkupBreak(index)}
                          style={{ padding: '6px 12px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '6px', color: '#a78bfa', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`Remove tier ${qtyBreak.min}-${qtyBreak.max === 99999 ? '∞' : qtyBreak.max}?`)) return
                            setSavingEmbMarkupPricing(true)
                            try {
                              const newBreaks = embMarkupPricing.quantity_breaks.filter((_, i) => i !== index)
                              const res = await fetch('/api/settings/embroidery-markup-pricing', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id: embMarkupPricing.id, quantity_breaks: newBreaks })
                              })
                              if (res.ok) {
                                setEmbMarkupPricing({ ...embMarkupPricing, quantity_breaks: newBreaks })
                              } else {
                                alert('Failed to remove tier')
                              }
                            } catch {
                              alert('Error removing tier')
                            }
                            setSavingEmbMarkupPricing(false)
                          }}
                          style={{ padding: '6px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#ef4444', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              ))}

              {/* Add new row */}
              {addingEmbMarkupBreak ? (
                <tr style={{ borderTop: '1px solid rgba(148, 163, 184, 0.1)', background: 'rgba(139,92,246,0.03)' }}>
                  <td style={{ padding: '12px 20px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="number"
                        value={newEmbMarkupBreak.min || ''}
                        placeholder="Min"
                        onChange={e => setNewEmbMarkupBreak({ ...newEmbMarkupBreak, min: parseInt(e.target.value) || 0 })}
                        style={{ width: '80px', padding: '6px 10px', background: '#111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', color: '#f1f5f9', fontSize: '13px' }}
                      />
                      <span style={{ color: '#64748b' }}>to</span>
                      <input
                        type="number"
                        value={newEmbMarkupBreak.max || ''}
                        placeholder="Max"
                        onChange={e => setNewEmbMarkupBreak({ ...newEmbMarkupBreak, max: parseInt(e.target.value) || 0 })}
                        style={{ width: '80px', padding: '6px 10px', background: '#111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', color: '#f1f5f9', fontSize: '13px' }}
                      />
                    </div>
                  </td>
                  <td style={{ padding: '12px 20px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="number"
                        value={newEmbMarkupBreak.markup_pct}
                        onChange={e => setNewEmbMarkupBreak({ ...newEmbMarkupBreak, markup_pct: parseInt(e.target.value) || 0 })}
                        style={{ width: '80px', padding: '6px 10px', background: '#111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', color: '#f1f5f9', fontSize: '13px' }}
                      />
                      <span style={{ color: '#64748b' }}>%</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => { setAddingEmbMarkupBreak(false); setNewEmbMarkupBreak({ min: 0, max: 0, markup_pct: 200, decoration_prices: {} }) }}
                        style={{ padding: '6px 12px', background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', color: '#94a3b8', cursor: 'pointer', fontSize: '12px' }}
                      >Cancel</button>
                      <button
                        onClick={async () => {
                          if (newEmbMarkupBreak.min <= 0 || newEmbMarkupBreak.max <= 0 || newEmbMarkupBreak.max < newEmbMarkupBreak.min) {
                            alert('Max must be >= Min, and both must be > 0')
                            return
                          }
                          setSavingEmbMarkupPricing(true)
                          try {
                            const newBreaks = [...embMarkupPricing.quantity_breaks, newEmbMarkupBreak].sort((a, b) => a.min - b.min)
                            const res = await fetch('/api/settings/embroidery-markup-pricing', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ id: embMarkupPricing.id, quantity_breaks: newBreaks })
                            })
                            if (res.ok) {
                              setEmbMarkupPricing({ ...embMarkupPricing, quantity_breaks: newBreaks })
                              setAddingEmbMarkupBreak(false)
                              setNewEmbMarkupBreak({ min: 0, max: 0, markup_pct: 200, decoration_prices: {} })
                            } else {
                              alert('Failed to add tier')
                            }
                          } catch {
                            alert('Error adding tier')
                          }
                          setSavingEmbMarkupPricing(false)
                        }}
                        disabled={savingEmbMarkupPricing}
                        style={{ padding: '6px 12px', background: '#d71cd1', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 500, opacity: savingEmbMarkupPricing ? 0.6 : 1 }}
                      >{savingEmbMarkupPricing ? 'Saving...' : 'Add & Save'}</button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr style={{ borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>
                  <td colSpan={3} style={{ padding: '12px 20px' }}>
                    <button
                      onClick={() => {
                        const lastBreak = embMarkupPricing.quantity_breaks[embMarkupPricing.quantity_breaks.length - 1]
                        const suggestedMin = lastBreak ? lastBreak.max + 1 : 1
                        setNewEmbMarkupBreak({ min: suggestedMin, max: suggestedMin + 99, markup_pct: 200, decoration_prices: {} })
                        setAddingEmbMarkupBreak(true)
                      }}
                      style={{ padding: '8px 16px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '6px', color: '#a78bfa', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
                    >+ Add Row</button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(148, 163, 184, 0.1)', background: 'rgba(139,92,246,0.05)' }}>
            <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0, lineHeight: 1.5 }}>
              These markup percentages are applied to embroidery garment wholesale prices. Changes apply to future quotes only — existing approved quotes are not affected.
            </p>
          </div>
        </div>
      )}

      {/* Embroidery Fee Tab */}
      {activeTab === 'embroidery-fee' && embFeePricing && (
        <div style={{ background: '#1d1d1d', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
            <h3 style={{ color: '#f1f5f9', fontSize: '16px', margin: '0 0 4px 0' }}>Embroidery Fee Matrix</h3>
            <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Manage quantity breaks and per-location stitch fees for embroidery</p>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(148, 163, 184, 0.05)' }}>
                <th style={{ padding: '12px 20px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Qty Range</th>
                <th style={{ padding: '12px 20px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Stitch Fee</th>
                <th style={{ padding: '12px 20px', textAlign: 'right', color: '#94a3b8', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {embFeePricing.quantity_breaks.map((qtyBreak, index) => (
                editingEmbFeeBreak === index ? (
                  <tr key={index} style={{ borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>
                    <td style={{ padding: '12px 20px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="number"
                          value={qtyBreak.min}
                          onChange={e => {
                            const newBreaks = [...embFeePricing.quantity_breaks]
                            newBreaks[index] = { ...newBreaks[index], min: parseInt(e.target.value) || 0 }
                            setEmbFeePricing({ ...embFeePricing, quantity_breaks: newBreaks })
                          }}
                          style={{ width: '80px', padding: '6px 10px', background: '#111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', color: '#f1f5f9', fontSize: '13px' }}
                        />
                        <span style={{ color: '#64748b' }}>to</span>
                        <input
                          type="number"
                          value={qtyBreak.max}
                          onChange={e => {
                            const newBreaks = [...embFeePricing.quantity_breaks]
                            newBreaks[index] = { ...newBreaks[index], max: parseInt(e.target.value) || 0 }
                            setEmbFeePricing({ ...embFeePricing, quantity_breaks: newBreaks })
                          }}
                          style={{ width: '80px', padding: '6px 10px', background: '#111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', color: '#f1f5f9', fontSize: '13px' }}
                        />
                      </div>
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ color: '#64748b' }}>$</span>
                        <input
                          type="number"
                          step="0.50"
                          value={qtyBreak.decoration_prices.up_to_10k ?? 0}
                          onChange={e => {
                            const newBreaks = [...embFeePricing.quantity_breaks]
                            newBreaks[index] = { ...newBreaks[index], decoration_prices: { ...newBreaks[index].decoration_prices, up_to_10k: parseFloat(e.target.value) || 0 } }
                            setEmbFeePricing({ ...embFeePricing, quantity_breaks: newBreaks })
                          }}
                          style={{ width: '80px', padding: '6px 10px', background: '#111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', color: '#f1f5f9', fontSize: '13px' }}
                        />
                      </div>
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => {
                            fetch('/api/settings/embroidery-fee-pricing').then(r => r.json()).then(d => { if (d?.quantity_breaks) setEmbFeePricing(d) })
                            setEditingEmbFeeBreak(null)
                          }}
                          style={{ padding: '6px 12px', background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', color: '#94a3b8', cursor: 'pointer', fontSize: '12px' }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={async () => {
                            setSavingEmbFeePricing(true)
                            try {
                              const res = await fetch('/api/settings/embroidery-fee-pricing', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id: embFeePricing.id, quantity_breaks: embFeePricing.quantity_breaks })
                              })
                              if (res.ok) {
                                setEditingEmbFeeBreak(null)
                              } else {
                                alert('Failed to save pricing')
                              }
                            } catch (err) {
                              alert('Error saving pricing')
                            }
                            setSavingEmbFeePricing(false)
                          }}
                          disabled={savingEmbFeePricing}
                          style={{ padding: '6px 12px', background: '#d71cd1', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 500, opacity: savingEmbFeePricing ? 0.6 : 1 }}
                        >
                          {savingEmbFeePricing ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={index} style={{ borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>
                    <td style={{ padding: '12px 20px', color: '#f1f5f9', fontSize: '14px' }}>
                      {qtyBreak.min} - {qtyBreak.max === 99999 ? '∞' : qtyBreak.max}
                    </td>
                    <td style={{ padding: '12px 20px', color: '#f1f5f9', fontSize: '14px', fontWeight: 600 }}>
                      ${(qtyBreak.decoration_prices.up_to_10k ?? 0).toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setEditingEmbFeeBreak(index)}
                          style={{ padding: '6px 12px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '6px', color: '#a78bfa', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`Remove tier ${qtyBreak.min}-${qtyBreak.max === 99999 ? '∞' : qtyBreak.max}?`)) return
                            setSavingEmbFeePricing(true)
                            try {
                              const newBreaks = embFeePricing.quantity_breaks.filter((_, i) => i !== index)
                              const res = await fetch('/api/settings/embroidery-fee-pricing', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id: embFeePricing.id, quantity_breaks: newBreaks })
                              })
                              if (res.ok) {
                                setEmbFeePricing({ ...embFeePricing, quantity_breaks: newBreaks })
                              } else {
                                alert('Failed to remove tier')
                              }
                            } catch {
                              alert('Error removing tier')
                            }
                            setSavingEmbFeePricing(false)
                          }}
                          style={{ padding: '6px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#ef4444', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              ))}

              {/* Add new row */}
              {addingEmbFeeBreak ? (
                <tr style={{ borderTop: '1px solid rgba(148, 163, 184, 0.1)', background: 'rgba(139,92,246,0.03)' }}>
                  <td style={{ padding: '12px 20px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="number"
                        value={newEmbFeeBreak.min || ''}
                        placeholder="Min"
                        onChange={e => setNewEmbFeeBreak({ ...newEmbFeeBreak, min: parseInt(e.target.value) || 0 })}
                        style={{ width: '80px', padding: '6px 10px', background: '#111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', color: '#f1f5f9', fontSize: '13px' }}
                      />
                      <span style={{ color: '#64748b' }}>to</span>
                      <input
                        type="number"
                        value={newEmbFeeBreak.max || ''}
                        placeholder="Max"
                        onChange={e => setNewEmbFeeBreak({ ...newEmbFeeBreak, max: parseInt(e.target.value) || 0 })}
                        style={{ width: '80px', padding: '6px 10px', background: '#111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', color: '#f1f5f9', fontSize: '13px' }}
                      />
                    </div>
                  </td>
                  <td style={{ padding: '12px 20px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ color: '#64748b' }}>$</span>
                      <input
                        type="number"
                        step="0.50"
                        value={newEmbFeeBreak.decoration_prices.up_to_10k ?? 0}
                        onChange={e => setNewEmbFeeBreak({ ...newEmbFeeBreak, decoration_prices: { ...newEmbFeeBreak.decoration_prices, up_to_10k: parseFloat(e.target.value) || 0 } })}
                        style={{ width: '80px', padding: '6px 10px', background: '#111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', color: '#f1f5f9', fontSize: '13px' }}
                      />
                    </div>
                  </td>
                  <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => { setAddingEmbFeeBreak(false); setNewEmbFeeBreak({ min: 0, max: 0, markup_pct: 0, decoration_prices: { up_to_10k: 8.00 } }) }}
                        style={{ padding: '6px 12px', background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', color: '#94a3b8', cursor: 'pointer', fontSize: '12px' }}
                      >Cancel</button>
                      <button
                        onClick={async () => {
                          if (newEmbFeeBreak.min <= 0 || newEmbFeeBreak.max <= 0 || newEmbFeeBreak.max < newEmbFeeBreak.min) {
                            alert('Max must be >= Min, and both must be > 0')
                            return
                          }
                          setSavingEmbFeePricing(true)
                          try {
                            const newBreaks = [...embFeePricing.quantity_breaks, newEmbFeeBreak].sort((a, b) => a.min - b.min)
                            const res = await fetch('/api/settings/embroidery-fee-pricing', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ id: embFeePricing.id, quantity_breaks: newBreaks })
                            })
                            if (res.ok) {
                              setEmbFeePricing({ ...embFeePricing, quantity_breaks: newBreaks })
                              setAddingEmbFeeBreak(false)
                              setNewEmbFeeBreak({ min: 0, max: 0, markup_pct: 0, decoration_prices: { up_to_10k: 8.00 } })
                            } else {
                              alert('Failed to add tier')
                            }
                          } catch {
                            alert('Error adding tier')
                          }
                          setSavingEmbFeePricing(false)
                        }}
                        disabled={savingEmbFeePricing}
                        style={{ padding: '6px 12px', background: '#d71cd1', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 500, opacity: savingEmbFeePricing ? 0.6 : 1 }}
                      >{savingEmbFeePricing ? 'Saving...' : 'Add & Save'}</button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr style={{ borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>
                  <td colSpan={3} style={{ padding: '12px 20px' }}>
                    <button
                      onClick={() => {
                        const lastBreak = embFeePricing.quantity_breaks[embFeePricing.quantity_breaks.length - 1]
                        const suggestedMin = lastBreak ? lastBreak.max + 1 : 1
                        setNewEmbFeeBreak({ min: suggestedMin, max: suggestedMin + 99, markup_pct: 0, decoration_prices: { up_to_10k: 8.00 } })
                        setAddingEmbFeeBreak(true)
                      }}
                      style={{ padding: '8px 16px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '6px', color: '#a78bfa', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
                    >+ Add Row</button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(148, 163, 184, 0.1)', background: 'rgba(139,92,246,0.05)' }}>
            <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0, lineHeight: 1.5 }}>
              Per-location decoration fees based on stitch count. Changes apply to future quotes only — existing approved quotes are not affected.
            </p>
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {notifLoading ? (
            <div style={{ color: '#94a3b8', padding: '40px', textAlign: 'center' }}>Loading notification settings...</div>
          ) : (
            <>
              {/* Sound Alert Section */}
              <div style={{ background: '#1d1d1d', borderRadius: '12px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div>
                    <h3 style={{ color: '#f1f5f9', fontSize: '16px', margin: '0 0 4px 0' }}>Audible Alerts</h3>
                    <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>Play separate sounds for unread messages and emails</p>
                  </div>
                  <button
                    onClick={() => setNotifSettings({ ...notifSettings, sound_enabled: !notifSettings.sound_enabled })}
                    style={{
                      width: '48px', height: '26px', borderRadius: '13px', border: 'none', cursor: 'pointer',
                      background: notifSettings.sound_enabled ? '#22c55e' : '#374151',
                      position: 'relative', transition: 'background 0.2s'
                    }}
                  >
                    <div style={{
                      width: '20px', height: '20px', borderRadius: '50%', background: 'white',
                      position: 'absolute', top: '3px',
                      left: notifSettings.sound_enabled ? '25px' : '3px',
                      transition: 'left 0.2s'
                    }} />
                  </button>
                </div>

                {notifSettings.sound_enabled && (
                  <>
                    {/* Message Alert Sound */}
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', color: '#d71cd1', fontSize: '14px', marginBottom: '10px', fontWeight: 600 }}>Message Alert Sound</label>
                      <p style={{ color: '#94a3b8', fontSize: '12px', margin: '-6px 0 10px 0' }}>Plays when there are unread SMS messages</p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                        {BUILTIN_SOUNDS.map(sound => (
                          <button
                            key={sound.key}
                            onClick={() => {
                              setNotifSettings({ ...notifSettings, message_sound_key: sound.key })
                              playSound(sound.key)
                            }}
                            style={{
                              padding: '10px',
                              background: notifSettings.message_sound_key === sound.key ? 'rgba(215, 28, 209, 0.15)' : '#111111',
                              border: notifSettings.message_sound_key === sound.key ? '2px solid #d71cd1' : '1px solid rgba(148,163,184,0.15)',
                              borderRadius: '10px',
                              cursor: 'pointer',
                              textAlign: 'left'
                            }}
                          >
                            <div style={{ color: '#f1f5f9', fontSize: '13px', fontWeight: 500, marginBottom: '2px' }}>{sound.label}</div>
                            <div style={{ color: '#64748b', fontSize: '11px' }}>{sound.description}</div>
                          </button>
                        ))}
                      </div>
                      {customSounds.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '8px' }}>
                          {customSounds.map(sound => (
                            <button
                              key={sound.id}
                              onClick={() => {
                                setNotifSettings({ ...notifSettings, message_sound_key: `custom:${sound.id}` })
                                playCustomSound(sound.dataUrl)
                              }}
                              style={{
                                padding: '10px',
                                background: notifSettings.message_sound_key === `custom:${sound.id}` ? 'rgba(215, 28, 209, 0.15)' : '#111111',
                                border: notifSettings.message_sound_key === `custom:${sound.id}` ? '2px solid #d71cd1' : '1px solid rgba(148,163,184,0.15)',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                textAlign: 'left'
                              }}
                            >
                              <div style={{ color: '#f1f5f9', fontSize: '13px', fontWeight: 500, marginBottom: '2px' }}>{sound.label}</div>
                              <div style={{ color: '#64748b', fontSize: '11px' }}>Custom upload</div>
                            </button>
                          ))}
                        </div>
                      )}
                      <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ color: '#94a3b8', fontSize: '13px', whiteSpace: 'nowrap' }}>Repeat:</span>
                        <select
                          value={notifSettings.message_repeat_interval}
                          onChange={e => setNotifSettings({ ...notifSettings, message_repeat_interval: parseInt(e.target.value) })}
                          style={{ padding: '8px 12px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '13px' }}
                        >
                          <option value={30}>Every 30 seconds</option>
                          <option value={60}>Every 1 minute</option>
                          <option value={120}>Every 2 minutes</option>
                          <option value={300}>Every 5 minutes</option>
                          <option value={600}>Every 10 minutes</option>
                        </select>
                        <span style={{ color: '#64748b', fontSize: '12px' }}>while messages remain unread</span>
                      </div>
                    </div>

                    {/* Email Alert Sound */}
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', color: '#3b82f6', fontSize: '14px', marginBottom: '10px', fontWeight: 600 }}>Email Alert Sound</label>
                      <p style={{ color: '#94a3b8', fontSize: '12px', margin: '-6px 0 10px 0' }}>Plays when there are unread emails</p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                        {BUILTIN_SOUNDS.map(sound => (
                          <button
                            key={sound.key}
                            onClick={() => {
                              setNotifSettings({ ...notifSettings, email_sound_key: sound.key })
                              playSound(sound.key)
                            }}
                            style={{
                              padding: '10px',
                              background: notifSettings.email_sound_key === sound.key ? 'rgba(59, 130, 246, 0.15)' : '#111111',
                              border: notifSettings.email_sound_key === sound.key ? '2px solid #3b82f6' : '1px solid rgba(148,163,184,0.15)',
                              borderRadius: '10px',
                              cursor: 'pointer',
                              textAlign: 'left'
                            }}
                          >
                            <div style={{ color: '#f1f5f9', fontSize: '13px', fontWeight: 500, marginBottom: '2px' }}>{sound.label}</div>
                            <div style={{ color: '#64748b', fontSize: '11px' }}>{sound.description}</div>
                          </button>
                        ))}
                      </div>
                      {customSounds.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '8px' }}>
                          {customSounds.map(sound => (
                            <button
                              key={sound.id}
                              onClick={() => {
                                setNotifSettings({ ...notifSettings, email_sound_key: `custom:${sound.id}` })
                                playCustomSound(sound.dataUrl)
                              }}
                              style={{
                                padding: '10px',
                                background: notifSettings.email_sound_key === `custom:${sound.id}` ? 'rgba(59, 130, 246, 0.15)' : '#111111',
                                border: notifSettings.email_sound_key === `custom:${sound.id}` ? '2px solid #3b82f6' : '1px solid rgba(148,163,184,0.15)',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                textAlign: 'left'
                              }}
                            >
                              <div style={{ color: '#f1f5f9', fontSize: '13px', fontWeight: 500, marginBottom: '2px' }}>{sound.label}</div>
                              <div style={{ color: '#64748b', fontSize: '11px' }}>Custom upload</div>
                            </button>
                          ))}
                        </div>
                      )}
                      <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ color: '#94a3b8', fontSize: '13px', whiteSpace: 'nowrap' }}>Repeat:</span>
                        <select
                          value={notifSettings.email_repeat_interval}
                          onChange={e => setNotifSettings({ ...notifSettings, email_repeat_interval: parseInt(e.target.value) })}
                          style={{ padding: '8px 12px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '13px' }}
                        >
                          <option value={30}>Every 30 seconds</option>
                          <option value={60}>Every 1 minute</option>
                          <option value={120}>Every 2 minutes</option>
                          <option value={300}>Every 5 minutes</option>
                          <option value={600}>Every 10 minutes</option>
                        </select>
                        <span style={{ color: '#64748b', fontSize: '12px' }}>while emails remain unread</span>
                      </div>
                    </div>

                    {/* Payment Alert Sound */}
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', color: '#22c55e', fontSize: '14px', marginBottom: '10px', fontWeight: 600 }}>Payment Alert Sound</label>
                      <p style={{ color: '#94a3b8', fontSize: '12px', margin: '-6px 0 10px 0' }}>Plays once when a new payment is received (does not repeat)</p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                        {BUILTIN_SOUNDS.map(sound => (
                          <button
                            key={sound.key}
                            onClick={() => {
                              setNotifSettings({ ...notifSettings, payment_sound_key: sound.key })
                              playSound(sound.key)
                            }}
                            style={{
                              padding: '10px',
                              background: notifSettings.payment_sound_key === sound.key ? 'rgba(34, 197, 94, 0.15)' : '#111111',
                              border: notifSettings.payment_sound_key === sound.key ? '2px solid #22c55e' : '1px solid rgba(148,163,184,0.15)',
                              borderRadius: '10px',
                              cursor: 'pointer',
                              textAlign: 'left'
                            }}
                          >
                            <div style={{ color: '#f1f5f9', fontSize: '13px', fontWeight: 500, marginBottom: '2px' }}>{sound.label}</div>
                            <div style={{ color: '#64748b', fontSize: '11px' }}>{sound.description}</div>
                          </button>
                        ))}
                      </div>
                      {customSounds.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '8px' }}>
                          {customSounds.map(sound => (
                            <button
                              key={sound.id}
                              onClick={() => {
                                setNotifSettings({ ...notifSettings, payment_sound_key: `custom:${sound.id}` })
                                playCustomSound(sound.dataUrl)
                              }}
                              style={{
                                padding: '10px',
                                background: notifSettings.payment_sound_key === `custom:${sound.id}` ? 'rgba(34, 197, 94, 0.15)' : '#111111',
                                border: notifSettings.payment_sound_key === `custom:${sound.id}` ? '2px solid #22c55e' : '1px solid rgba(148,163,184,0.15)',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                textAlign: 'left'
                              }}
                            >
                              <div style={{ color: '#f1f5f9', fontSize: '13px', fontWeight: 500, marginBottom: '2px' }}>{sound.label}</div>
                              <div style={{ color: '#64748b', fontSize: '11px' }}>Custom upload</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Custom Sound Upload */}
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '10px', fontWeight: 500 }}>Custom Sounds</label>
                      {customSounds.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                          {customSounds.map(sound => (
                            <div
                              key={sound.id}
                              style={{
                                padding: '8px 12px',
                                background: '#111111',
                                border: '1px solid rgba(148,163,184,0.15)',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}
                            >
                              <span style={{ color: '#f1f5f9', fontSize: '13px' }}>{sound.label}</span>
                              <button
                                onClick={async () => {
                                  if (!confirm(`Delete "${sound.label}"?`)) return
                                  const res = await fetch('/api/settings/notification-sounds', {
                                    method: 'DELETE',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ id: sound.id })
                                  })
                                  if (res.ok) {
                                    setCustomSounds(customSounds.filter(s => s.id !== sound.id))
                                    const customKey = `custom:${sound.id}`
                                    const updates: Partial<NotificationSettings> = {}
                                    if (notifSettings.message_sound_key === customKey) updates.message_sound_key = 'chime'
                                    if (notifSettings.email_sound_key === customKey) updates.email_sound_key = 'bell'
                                    if (notifSettings.payment_sound_key === customKey) updates.payment_sound_key = 'cascade'
                                    if (Object.keys(updates).length > 0) {
                                      setNotifSettings({ ...notifSettings, ...updates })
                                    }
                                  }
                                }}
                                style={{
                                  background: 'none', border: 'none', color: '#64748b', cursor: 'pointer',
                                  fontSize: '16px', padding: '0 2px', lineHeight: 1
                                }}
                                title="Delete sound"
                              >
                                &times;
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Upload Form */}
                      <div style={{ background: '#111111', borderRadius: '10px', padding: '16px', border: '1px dashed rgba(148,163,184,0.2)' }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Sound Name</label>
                            <input
                              type="text"
                              value={uploadLabel}
                              onChange={e => setUploadLabel(e.target.value)}
                              placeholder="e.g. Duck Quack"
                              style={{ width: '100%', padding: '8px 12px', background: '#1d1d1d', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', color: '#f1f5f9', fontSize: '13px' }}
                            />
                          </div>
                          <label style={{
                            padding: '8px 16px',
                            background: uploading ? '#374151' : '#d71cd1',
                            border: 'none',
                            borderRadius: '6px',
                            color: 'white',
                            fontSize: '13px',
                            fontWeight: 500,
                            cursor: uploading ? 'not-allowed' : 'pointer',
                            opacity: uploading ? 0.6 : 1,
                            whiteSpace: 'nowrap'
                          }}>
                            {uploading ? 'Uploading...' : 'Upload Sound'}
                            <input
                              type="file"
                              accept=".mp3,.wav,.ogg,.m4a,.aac,.webm,audio/*"
                              style={{ display: 'none' }}
                              disabled={uploading}
                              onChange={async (e) => {
                                const file = e.target.files?.[0]
                                if (!file) return
                                setUploading(true)
                                const fd = new FormData()
                                fd.append('file', file)
                                fd.append('label', uploadLabel || file.name.replace(/\.[^.]+$/, ''))
                                try {
                                  const res = await fetch('/api/settings/notification-sounds', {
                                    method: 'POST',
                                    body: fd,
                                  })
                                  const data = await res.json()
                                  if (res.ok && data.sound) {
                                    setCustomSounds([...customSounds, data.sound])
                                    setUploadLabel('')
                                    playCustomSound(data.sound.dataUrl)
                                  } else {
                                    alert(data.error || 'Upload failed')
                                  }
                                } catch {
                                  alert('Upload failed')
                                }
                                setUploading(false)
                                e.target.value = ''
                              }}
                            />
                          </label>
                        </div>
                        <p style={{ color: '#64748b', fontSize: '11px', margin: '8px 0 0 0' }}>Supported formats: MP3, WAV, OGG, M4A, AAC (max 500KB). Short clips (1-5 seconds) work best.</p>
                      </div>
                    </div>

                    {/* Active Hours */}
                    <div>
                      <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '10px', fontWeight: 500 }}>Active Hours</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <select
                          value={notifSettings.start_hour}
                          onChange={e => setNotifSettings({ ...notifSettings, start_hour: parseInt(e.target.value) })}
                          style={{ padding: '10px 14px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }}
                        >
                          {Array.from({ length: 24 }, (_, i) => (
                            <option key={i} value={i}>{i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`}</option>
                          ))}
                        </select>
                        <span style={{ color: '#94a3b8', fontSize: '14px' }}>to</span>
                        <select
                          value={notifSettings.end_hour}
                          onChange={e => setNotifSettings({ ...notifSettings, end_hour: parseInt(e.target.value) })}
                          style={{ padding: '10px 14px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }}
                        >
                          {Array.from({ length: 24 }, (_, i) => (
                            <option key={i} value={i}>{i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`}</option>
                          ))}
                        </select>
                      </div>
                      <p style={{ color: '#64748b', fontSize: '12px', margin: '8px 0 0 0' }}>All sound alerts only play during these hours (your local time)</p>
                    </div>
                  </>
                )}
              </div>

              {/* Email Alerts Section */}
              <div style={{ background: '#1d1d1d', borderRadius: '12px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ color: '#f1f5f9', fontSize: '16px', margin: '0 0 4px 0' }}>Email Alerts</h3>
                    <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>Receive email notifications for incoming SMS messages</p>
                  </div>
                  <button
                    onClick={() => setNotifSettings({ ...notifSettings, email_alerts_enabled: !notifSettings.email_alerts_enabled })}
                    style={{
                      width: '48px', height: '26px', borderRadius: '13px', border: 'none', cursor: 'pointer',
                      background: notifSettings.email_alerts_enabled ? '#22c55e' : '#374151',
                      position: 'relative', transition: 'background 0.2s'
                    }}
                  >
                    <div style={{
                      width: '20px', height: '20px', borderRadius: '50%', background: 'white',
                      position: 'absolute', top: '3px',
                      left: notifSettings.email_alerts_enabled ? '25px' : '3px',
                      transition: 'left 0.2s'
                    }} />
                  </button>
                </div>

                {notifSettings.email_alerts_enabled && (
                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px', fontWeight: 500 }}>Alert Email Address</label>
                    <input
                      type="email"
                      value={notifSettings.email_alert_address}
                      onChange={e => setNotifSettings({ ...notifSettings, email_alert_address: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }}
                    />
                    <p style={{ color: '#64748b', fontSize: '12px', margin: '8px 0 0 0' }}>An email will be sent to this address for every incoming text message</p>
                  </div>
                )}
              </div>

              {/* Save Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center' }}>
                {notifSaved && (
                  <span style={{ color: '#22c55e', fontSize: '14px' }}>Settings saved!</span>
                )}
                <button
                  onClick={saveNotifSettings}
                  disabled={notifSaving}
                  style={{
                    padding: '12px 24px',
                    background: '#d71cd1',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    opacity: notifSaving ? 0.6 : 1
                  }}
                >
                  {notifSaving ? 'Saving...' : 'Save Notification Settings'}
                </button>
              </div>
            </>
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

      {/* Create Template Modal */}
      {creatingTemplate && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setCreatingTemplate(null)}>
          <div style={{ background: '#1d1d1d', borderRadius: '16px', width: '500px', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px', borderBottom: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ color: '#f1f5f9', fontSize: '18px', margin: 0 }}>Create {creatingTemplate === 'production' ? 'Production' : 'Customer Workflow'} Template</h3>
              <button onClick={() => setCreatingTemplate(null)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '24px' }}>&times;</button>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Template Key</label>
                <input type="text" value={newTemplate.template_key}
                  onChange={e => setNewTemplate({ ...newTemplate, template_key: e.target.value })}
                  placeholder="e.g. PRINTED_WRAP_WORKFLOW"
                  style={{ width: '100%', padding: '10px 14px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px', fontFamily: 'monospace' }}
                />
                <p style={{ color: '#64748b', fontSize: '12px', margin: '4px 0 0 0' }}>Unique identifier (auto-converted to UPPERCASE)</p>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Label</label>
                <input type="text" value={newTemplate.label}
                  onChange={e => setNewTemplate({ ...newTemplate, label: e.target.value })}
                  placeholder="e.g. Printed Wrap Workflow"
                  style={{ width: '100%', padding: '10px 14px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Description</label>
                <input type="text" value={newTemplate.description}
                  onChange={e => setNewTemplate({ ...newTemplate, description: e.target.value })}
                  placeholder="Optional description"
                  style={{ width: '100%', padding: '10px 14px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Link to Category (optional)</label>
                <select value={newTemplate.category_key}
                  onChange={e => setNewTemplate({ ...newTemplate, category_key: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }}
                >
                  <option value="">None - link later</option>
                  {categories.map(c => (
                    <option key={c.category_key} value={c.category_key}>{c.label} ({c.category_key})</option>
                  ))}
                </select>
                <p style={{ color: '#64748b', fontSize: '12px', margin: '4px 0 0 0' }}>You can also link categories after creating</p>
              </div>
            </div>
            <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => { setCreatingTemplate(null); setNewTemplate({ template_key: '', label: '', description: '', category_key: '' }) }}
                style={{ padding: '10px 20px', background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
              <button onClick={() => createTemplate(creatingTemplate)}
                style={{ padding: '10px 20px', background: '#d71cd1', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
                Create Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Template Modal */}
      {editingTemplate && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setEditingTemplate(null)}>
          <div style={{ background: '#1d1d1d', borderRadius: '16px', width: '500px', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px', borderBottom: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ color: '#f1f5f9', fontSize: '18px', margin: 0 }}>Rename Template</h3>
              <button onClick={() => setEditingTemplate(null)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '24px' }}>&times;</button>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Label</label>
                <input type="text" value={editingTemplate.label}
                  onChange={e => setEditingTemplate({ ...editingTemplate, label: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Description</label>
                <input type="text" value={editingTemplate.description}
                  onChange={e => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                  placeholder="Optional description"
                  style={{ width: '100%', padding: '10px 14px', background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }}
                />
              </div>
            </div>
            <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setEditingTemplate(null)}
                style={{ padding: '10px 20px', background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
              <button onClick={renameTemplate}
                style={{ padding: '10px 20px', background: '#d71cd1', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}