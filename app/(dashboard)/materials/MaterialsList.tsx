'use client'

import { useState, useMemo } from 'react'

interface Material {
  id: string
  name: string
  material_key: string | null
  brand: string | null
  sku: string | null
  tab_category: string
  material_subtype: string | null
  finish: string | null
  width_inches: number | null
  length_yards: number | null
  thickness_mil: number | null
  full_roll_thickness: number | null
  cost_per_roll: number | null
  relevancy: string
  use_case_categories: string[]
  use_case_line_types: string[]
  printer_compatibility: string[]
  laminate_pairing_ids: string[]
  notes: string | null
  active: boolean
  created_at: string
  updated_at: string
}

interface Category {
  category_key: string
  label: string
}

interface LineItemType {
  type_key: string
  label: string
  category_key: string
}

interface Vendor {
  id: string
  name: string
  brand_color: string
  ordering_email: string | null
}

interface MaterialVendor {
  id: string
  material_id: string
  vendor_id: string
  vendor_sku: string | null
  vendor_product_url: string | null
  is_preferred: boolean
  notes: string | null
  vendors: Vendor
}

const MATERIAL_TABS = [
  { key: 'media', label: 'Media' },
  { key: 'laminate', label: 'Laminate' },
  { key: 'transfer_tape', label: 'Transfer Tape' },
  { key: 'ppf', label: 'PPF' },
] as const

type MaterialTabKey = typeof MATERIAL_TABS[number]['key']

const PAGE_TABS = [
  { key: 'materials', label: 'Materials' },
  { key: 'use_cases', label: 'Use Cases' },
] as const

type PageTabKey = typeof PAGE_TABS[number]['key']

const RELEVANCY_OPTIONS = ['everyday', 'common', 'rare'] as const

function calcCostPerSqFt(cost: number | null, widthIn: number | null, lengthYd: number | null): number | null {
  if (!cost || !widthIn || !lengthYd) return null
  const widthFt = widthIn / 12
  const lengthFt = lengthYd * 3
  const sqft = widthFt * lengthFt
  return sqft > 0 ? cost / sqft : null
}

function calcCostPerLinFt(cost: number | null, lengthYd: number | null): number | null {
  if (!cost || !lengthYd) return null
  const lengthFt = lengthYd * 3
  return lengthFt > 0 ? cost / lengthFt : null
}

function fmt(val: number | null, decimals = 2): string {
  if (val === null || val === undefined) return '—'
  return `$${val.toFixed(decimals)}`
}

const EMPTY_MATERIAL: Partial<Material> = {
  name: '',
  material_key: '',
  brand: '',
  sku: '',
  tab_category: 'media',
  material_subtype: '',
  finish: '',
  width_inches: null,
  length_yards: null,
  thickness_mil: null,
  full_roll_thickness: null,
  cost_per_roll: null,
  relevancy: 'common',
  use_case_categories: [],
  use_case_line_types: [],
  printer_compatibility: [],
  laminate_pairing_ids: [],
  notes: '',
  active: true,
}

// Style constants
const cardBg = '#1d1d1d'
const borderColor = 'rgba(148, 163, 184, 0.1)'
const textPrimary = '#f1f5f9'
const textSecondary = '#94a3b8'
const textMuted = '#64748b'
const accentGradient = 'linear-gradient(90deg, #22d3ee, #a855f7, #ec4899)'

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: '#94a3b8',
  marginBottom: '4px',
  textTransform: 'uppercase',
  letterSpacing: '0.3px',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  background: '#111111',
  border: '1px solid rgba(148, 163, 184, 0.15)',
  borderRadius: '8px',
  color: '#f1f5f9',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
}

export default function MaterialsList({
  initialMaterials,
  categories,
  lineItemTypes,
  vendors,
  initialMaterialVendors,
}: {
  initialMaterials: Material[]
  categories: Category[]
  lineItemTypes: LineItemType[]
  vendors: Vendor[]
  initialMaterialVendors: MaterialVendor[]
}) {
  const [materials, setMaterials] = useState<Material[]>(initialMaterials)
  const [materialVendors, setMaterialVendors] = useState<MaterialVendor[]>(initialMaterialVendors)
  const [pageTab, setPageTab] = useState<PageTabKey>('materials')
  const [activeTab, setActiveTab] = useState<MaterialTabKey>('media')
  const [searchTerm, setSearchTerm] = useState('')
  const [editingMaterial, setEditingMaterial] = useState<Partial<Material> | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Vendor linking state for edit modal
  const [editMaterialVendors, setEditMaterialVendors] = useState<MaterialVendor[]>([])
  const [addingVendor, setAddingVendor] = useState(false)
  const [newVendorLink, setNewVendorLink] = useState({ vendor_id: '', vendor_sku: '', vendor_product_url: '' })

  // Use Cases tab state
  const [selectedUseCase, setSelectedUseCase] = useState<string>('')
  const [useCaseSaving, setUseCaseSaving] = useState(false)

  const laminates = useMemo(
    () => materials.filter((m) => m.tab_category === 'laminate'),
    [materials]
  )

  const filtered = useMemo(() => {
    let list = materials.filter((m) => m.tab_category === activeTab)
    if (searchTerm) {
      const lower = searchTerm.toLowerCase()
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(lower) ||
          m.brand?.toLowerCase().includes(lower) ||
          m.material_key?.toLowerCase().includes(lower)
      )
    }
    return list
  }, [materials, activeTab, searchTerm])

  const getVendorsForMaterial = (materialId: string) => {
    return materialVendors.filter((mv) => mv.material_id === materialId)
  }

  const handleSave = async () => {
    if (!editingMaterial?.name) return
    setSaving(true)
    setError(null)
    try {
      const payload = { ...editingMaterial }
      if (!payload.use_case_categories?.length) payload.use_case_categories = []
      if (!payload.use_case_line_types?.length) payload.use_case_line_types = []
      if (!payload.printer_compatibility?.length) payload.printer_compatibility = []
      if (!payload.laminate_pairing_ids?.length) payload.laminate_pairing_ids = []

      const method = isCreating ? 'POST' : 'PUT'
      const res = await fetch('/api/materials-v2', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      if (isCreating) {
        setMaterials((prev) => [...prev, data])
      } else {
        setMaterials((prev) => prev.map((m) => (m.id === data.id ? data : m)))
      }
      setEditingMaterial(null)
      setIsCreating(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this material? This cannot be undone.')) return
    try {
      const res = await fetch(`/api/materials-v2?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setMaterials((prev) => prev.filter((m) => m.id !== id))
      setMaterialVendors((prev) => prev.filter((mv) => mv.material_id !== id))
    } catch {
      setError('Failed to delete material')
    }
  }

  const openCreate = () => {
    setEditingMaterial({ ...EMPTY_MATERIAL, tab_category: activeTab })
    setEditMaterialVendors([])
    setIsCreating(true)
  }

  const openEdit = (mat: Material) => {
    setEditingMaterial({ ...mat })
    setEditMaterialVendors(getVendorsForMaterial(mat.id))
    setIsCreating(false)
  }

  const updateField = (field: string, value: unknown) => {
    setEditingMaterial((prev) => (prev ? { ...prev, [field]: value } : prev))
  }

  const toggleArrayValue = (field: string, value: string) => {
    setEditingMaterial((prev) => {
      if (!prev) return prev
      const arr = ((prev as Record<string, unknown>)[field] as string[]) || []
      const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
      return { ...prev, [field]: next }
    })
  }

  // Vendor linking handlers
  const handleAddVendorLink = async () => {
    if (!newVendorLink.vendor_id || !editingMaterial?.id) return
    try {
      const res = await fetch('/api/material-vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          material_id: editingMaterial.id,
          vendor_id: newVendorLink.vendor_id,
          vendor_sku: newVendorLink.vendor_sku || null,
          vendor_product_url: newVendorLink.vendor_product_url || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setEditMaterialVendors((prev) => [...prev, data])
      setMaterialVendors((prev) => [...prev, data])
      setAddingVendor(false)
      setNewVendorLink({ vendor_id: '', vendor_sku: '', vendor_product_url: '' })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add vendor')
    }
  }

  const handleRemoveVendorLink = async (mvId: string) => {
    try {
      const res = await fetch(`/api/material-vendors?id=${mvId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to remove')
      setEditMaterialVendors((prev) => prev.filter((mv) => mv.id !== mvId))
      setMaterialVendors((prev) => prev.filter((mv) => mv.id !== mvId))
    } catch {
      setError('Failed to remove vendor link')
    }
  }

  // Use Cases reverse assignment
  const handleUseCaseToggle = async (materialId: string, field: 'use_case_categories' | 'use_case_line_types', value: string) => {
    const mat = materials.find((m) => m.id === materialId)
    if (!mat) return
    const arr = mat[field] || []
    const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]

    setUseCaseSaving(true)
    try {
      const res = await fetch('/api/materials-v2', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: materialId, [field]: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMaterials((prev) => prev.map((m) => (m.id === data.id ? data : m)))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setUseCaseSaving(false)
    }
  }

  return (
    <div style={{ padding: '24px', maxWidth: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: textPrimary, margin: 0 }}>
          Materials{' '}
          <span style={{ background: accentGradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            List
          </span>
        </h1>
        <p style={{ color: textSecondary, margin: '4px 0 0', fontSize: '14px' }}>
          Source of truth for all materials — {materials.length} total
        </p>
      </div>

      {/* Page-level tabs: Materials | Use Cases */}
      <div style={{
        display: 'flex',
        gap: '4px',
        marginBottom: '20px',
        background: '#111111',
        borderRadius: '10px',
        padding: '4px',
        border: `1px solid ${borderColor}`,
        maxWidth: '320px',
      }}>
        {PAGE_TABS.map((tab) => {
          const isActive = pageTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setPageTab(tab.key)}
              style={{
                flex: 1,
                padding: '10px 16px',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                transition: 'all 0.15s',
                background: isActive ? cardBg : 'transparent',
                color: isActive ? textPrimary : textMuted,
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {error && (
        <div style={{
          padding: '10px 14px',
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '8px',
          color: '#ef4444',
          fontSize: '13px',
          marginBottom: '16px',
        }}>
          {error}
          <button onClick={() => setError(null)} style={{ float: 'right', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>×</button>
        </div>
      )}

      {/* ==================== MATERIALS TAB ==================== */}
      {pageTab === 'materials' && (
        <>
          {/* Category tabs */}
          <div style={{
            display: 'flex',
            gap: '4px',
            marginBottom: '20px',
            background: '#111111',
            borderRadius: '10px',
            padding: '4px',
            border: `1px solid ${borderColor}`,
          }}>
            {MATERIAL_TABS.map((tab) => {
              const count = materials.filter((m) => m.tab_category === tab.key).length
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 600,
                    transition: 'all 0.15s',
                    background: isActive ? cardBg : 'transparent',
                    color: isActive ? textPrimary : textMuted,
                    boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
                  }}
                >
                  {tab.label} <span style={{ fontSize: '12px', opacity: 0.6 }}>({count})</span>
                </button>
              )
            })}
          </div>

          {/* Search + Add */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search materials..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ flex: 1, padding: '10px 14px', background: cardBg, border: `1px solid ${borderColor}`, borderRadius: '8px', color: textPrimary, fontSize: '14px', outline: 'none' }}
            />
            <button onClick={openCreate} style={{ padding: '10px 20px', background: accentGradient, border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 600, fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              + Add Material
            </button>
          </div>

          {/* Table */}
          <div style={{ background: cardBg, borderRadius: '12px', border: `1px solid ${borderColor}`, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1200px' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                  {['Name', 'Subtype', 'Finish', 'Width (in)', 'Length (yd)', 'Thickness', 'Cost/Roll', 'Cost/SqFt', 'Sell/SqFt', 'Vendors', 'Relevancy', activeTab === 'media' ? 'Lam Pairings' : null, 'Active', '']
                    .filter(Boolean)
                    .map((h) => (
                      <th key={h} style={{ padding: '12px 10px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={14} style={{ padding: '40px', textAlign: 'center', color: textMuted, fontSize: '14px' }}>
                      No materials in this tab{searchTerm ? ' matching your search' : ''}
                    </td>
                  </tr>
                ) : (
                  filtered.map((mat) => {
                    const costSqFt = calcCostPerSqFt(mat.cost_per_roll, mat.width_inches, mat.length_yards)
                    const sellSqFt = costSqFt !== null ? costSqFt * 5 : null
                    const matVendors = getVendorsForMaterial(mat.id)
                    const lamNames = activeTab === 'media'
                      ? (mat.laminate_pairing_ids || []).map((id) => laminates.find((l) => l.id === id)?.name).filter(Boolean).join(', ')
                      : null

                    return (
                      <tr
                        key={mat.id}
                        onClick={() => openEdit(mat)}
                        style={{ borderBottom: `1px solid ${borderColor}`, cursor: 'pointer', transition: 'background 0.1s' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <td style={{ padding: '10px', color: textPrimary, fontSize: '13px', fontWeight: 500 }}>{mat.name}</td>
                        <td style={{ padding: '10px', color: textSecondary, fontSize: '13px' }}>{mat.material_subtype || '—'}</td>
                        <td style={{ padding: '10px', color: textSecondary, fontSize: '13px' }}>{mat.finish || '—'}</td>
                        <td style={{ padding: '10px', color: textSecondary, fontSize: '13px' }}>{mat.width_inches ?? '—'}</td>
                        <td style={{ padding: '10px', color: textSecondary, fontSize: '13px' }}>{mat.length_yards ?? '—'}</td>
                        <td style={{ padding: '10px', color: textSecondary, fontSize: '13px' }}>{mat.thickness_mil ? `${mat.thickness_mil} mil` : '—'}</td>
                        <td style={{ padding: '10px', color: textPrimary, fontSize: '13px', fontWeight: 500 }}>{mat.cost_per_roll ? fmt(mat.cost_per_roll) : '—'}</td>
                        <td style={{ padding: '10px', color: '#22d3ee', fontSize: '13px' }}>{fmt(costSqFt)}</td>
                        <td style={{ padding: '10px', color: '#a855f7', fontSize: '13px', fontWeight: 600 }}>{fmt(sellSqFt)}</td>
                        <td style={{ padding: '10px' }}>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {matVendors.length > 0 ? matVendors.map((mv) => (
                              <span key={mv.id} style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                background: `${mv.vendors.brand_color}20`,
                                color: mv.vendors.brand_color,
                                border: `1px solid ${mv.vendors.brand_color}40`,
                              }}>
                                {mv.vendors.name}
                              </span>
                            )) : <span style={{ color: textMuted, fontSize: '12px' }}>—</span>}
                          </div>
                        </td>
                        <td style={{ padding: '10px' }}>
                          <span style={{
                            padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                            background: mat.relevancy === 'everyday' ? 'rgba(34,197,94,0.1)' : mat.relevancy === 'rare' ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.1)',
                            color: mat.relevancy === 'everyday' ? '#22c55e' : mat.relevancy === 'rare' ? '#ef4444' : '#eab308',
                          }}>
                            {mat.relevancy}
                          </span>
                        </td>
                        {activeTab === 'media' && (
                          <td style={{ padding: '10px', color: textSecondary, fontSize: '12px', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={lamNames || undefined}>
                            {lamNames || '—'}
                          </td>
                        )}
                        <td style={{ padding: '10px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: mat.active ? '#22c55e' : '#ef4444', display: 'inline-block' }} />
                        </td>
                        <td style={{ padding: '10px' }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(mat.id) }}
                            style={{ background: 'none', border: 'none', color: textMuted, cursor: 'pointer', fontSize: '16px', padding: '4px' }}
                            title="Delete"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ==================== USE CASES TAB ==================== */}
      {pageTab === 'use_cases' && (
        <>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center' }}>
            <select
              value={selectedUseCase}
              onChange={(e) => setSelectedUseCase(e.target.value)}
              style={{ ...inputStyle, flex: 1, maxWidth: '400px' }}
            >
              <option value="">Select a use case category...</option>
              <optgroup label="Quote Categories">
                {categories.map((cat) => (
                  <option key={cat.category_key} value={`cat:${cat.category_key}`}>
                    {cat.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Line Item Types">
                {lineItemTypes.map((lt) => (
                  <option key={lt.type_key} value={`type:${lt.type_key}`}>
                    {lt.label}
                  </option>
                ))}
              </optgroup>
            </select>
            {useCaseSaving && <span style={{ color: textMuted, fontSize: '13px' }}>Saving...</span>}
          </div>

          {!selectedUseCase ? (
            <div style={{
              padding: '40px',
              background: cardBg,
              borderRadius: '12px',
              border: `1px solid ${borderColor}`,
              textAlign: 'center',
            }}>
              <p style={{ color: textMuted, fontSize: '14px', margin: 0 }}>
                Select a use case above to assign materials to it.
              </p>
            </div>
          ) : (
            <div style={{ background: cardBg, borderRadius: '12px', border: `1px solid ${borderColor}`, overflow: 'auto' }}>
              {(() => {
                const isCategory = selectedUseCase.startsWith('cat:')
                const key = selectedUseCase.split(':')[1]
                const field = isCategory ? 'use_case_categories' : 'use_case_line_types'
                const label = isCategory
                  ? categories.find((c) => c.category_key === key)?.label
                  : lineItemTypes.find((t) => t.type_key === key)?.label

                return (
                  <>
                    <div style={{ padding: '16px 20px', borderBottom: `1px solid ${borderColor}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ color: textPrimary, fontSize: '16px', margin: 0 }}>
                        {label}
                      </h3>
                      <span style={{ color: textMuted, fontSize: '13px' }}>
                        {materials.filter((m) => (m[field] || []).includes(key)).length} materials assigned
                      </span>
                    </div>

                    {/* Group by tab_category */}
                    {MATERIAL_TABS.map((tab) => {
                      const tabMaterials = materials.filter((m) => m.tab_category === tab.key)
                      if (tabMaterials.length === 0) return null
                      return (
                        <div key={tab.key}>
                          <div style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.02)', borderBottom: `1px solid ${borderColor}` }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              {tab.label}
                            </span>
                          </div>
                          {tabMaterials.map((mat) => {
                            const isAssigned = (mat[field] || []).includes(key)
                            return (
                              <div
                                key={mat.id}
                                onClick={() => handleUseCaseToggle(mat.id, field, key)}
                                style={{
                                  padding: '10px 20px',
                                  borderBottom: `1px solid ${borderColor}`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '12px',
                                  cursor: 'pointer',
                                  transition: 'background 0.1s',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                              >
                                <div style={{
                                  width: '20px',
                                  height: '20px',
                                  borderRadius: '4px',
                                  border: isAssigned ? '2px solid #22d3ee' : `2px solid ${textMuted}`,
                                  background: isAssigned ? 'rgba(34,211,238,0.15)' : 'transparent',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}>
                                  {isAssigned && <span style={{ color: '#22d3ee', fontSize: '14px', fontWeight: 700 }}>✓</span>}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <span style={{ color: textPrimary, fontSize: '14px' }}>{mat.name}</span>
                                  {mat.material_subtype && (
                                    <span style={{ color: textMuted, fontSize: '12px', marginLeft: '8px' }}>{mat.material_subtype}</span>
                                  )}
                                </div>
                                <span style={{
                                  padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                                  background: mat.relevancy === 'everyday' ? 'rgba(34,197,94,0.1)' : mat.relevancy === 'rare' ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.1)',
                                  color: mat.relevancy === 'everyday' ? '#22c55e' : mat.relevancy === 'rare' ? '#ef4444' : '#eab308',
                                }}>
                                  {mat.relevancy}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </>
                )
              })()}
            </div>
          )}
        </>
      )}

      {/* ==================== EDIT/CREATE MODAL ==================== */}
      {editingMaterial && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
          onClick={() => { setEditingMaterial(null); setIsCreating(false) }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#1a1a1a', borderRadius: '16px', border: `1px solid ${borderColor}`, width: '700px', maxHeight: '85vh', overflow: 'auto', padding: '28px' }}
          >
            <h2 style={{ color: textPrimary, fontSize: '20px', fontWeight: 700, margin: '0 0 20px' }}>
              {isCreating ? 'Add Material' : 'Edit Material'}
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              {/* Name */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Name *</label>
                <input style={inputStyle} value={editingMaterial.name || ''} onChange={(e) => updateField('name', e.target.value)} placeholder='e.g., Avery MPI 1105 54"' />
              </div>

              <div>
                <label style={labelStyle}>Material Key</label>
                <input style={inputStyle} value={editingMaterial.material_key || ''} onChange={(e) => updateField('material_key', e.target.value)} placeholder="AVERY_1105_54" />
              </div>
              <div>
                <label style={labelStyle}>Category</label>
                <select style={inputStyle} value={editingMaterial.tab_category || 'media'} onChange={(e) => updateField('tab_category', e.target.value)}>
                  {MATERIAL_TABS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Brand</label>
                <input style={inputStyle} value={editingMaterial.brand || ''} onChange={(e) => updateField('brand', e.target.value)} placeholder="Avery, 3M, Oracal..." />
              </div>
              <div>
                <label style={labelStyle}>SKU</label>
                <input style={inputStyle} value={editingMaterial.sku || ''} onChange={(e) => updateField('sku', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Subtype</label>
                <input style={inputStyle} value={editingMaterial.material_subtype || ''} onChange={(e) => updateField('material_subtype', e.target.value)} placeholder="CAST, CALENDARED..." />
              </div>
              <div>
                <label style={labelStyle}>Finish</label>
                <input style={inputStyle} value={editingMaterial.finish || ''} onChange={(e) => updateField('finish', e.target.value)} placeholder="Gloss, Matte, Satin..." />
              </div>
              <div>
                <label style={labelStyle}>Width (inches)</label>
                <input style={inputStyle} type="number" value={editingMaterial.width_inches ?? ''} onChange={(e) => updateField('width_inches', e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div>
                <label style={labelStyle}>Length (yards)</label>
                <input style={inputStyle} type="number" value={editingMaterial.length_yards ?? ''} onChange={(e) => updateField('length_yards', e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div>
                <label style={labelStyle}>Thickness (mil)</label>
                <input style={inputStyle} type="number" step="0.1" value={editingMaterial.thickness_mil ?? ''} onChange={(e) => updateField('thickness_mil', e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div>
                <label style={labelStyle}>Full Roll Thickness (caliper)</label>
                <input style={inputStyle} type="number" step="0.001" value={editingMaterial.full_roll_thickness ?? ''} onChange={(e) => updateField('full_roll_thickness', e.target.value ? Number(e.target.value) : null)} placeholder="For inventory calculation" />
              </div>
              <div>
                <label style={labelStyle}>Cost Per Roll ($)</label>
                <input style={inputStyle} type="number" step="0.01" value={editingMaterial.cost_per_roll ?? ''} onChange={(e) => updateField('cost_per_roll', e.target.value ? Number(e.target.value) : null)} />
              </div>

              {/* Relevancy */}
              <div>
                <label style={labelStyle}>Relevancy</label>
                <select style={inputStyle} value={editingMaterial.relevancy || 'common'} onChange={(e) => updateField('relevancy', e.target.value)}>
                  {RELEVANCY_OPTIONS.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>

              {/* Calculated prices */}
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '16px', padding: '12px', background: 'rgba(34,211,238,0.05)', borderRadius: '8px', border: '1px solid rgba(34,211,238,0.1)' }}>
                {(() => {
                  const cs = calcCostPerSqFt(editingMaterial.cost_per_roll ?? null, editingMaterial.width_inches ?? null, editingMaterial.length_yards ?? null)
                  const cl = calcCostPerLinFt(editingMaterial.cost_per_roll ?? null, editingMaterial.length_yards ?? null)
                  const ss = cs !== null ? cs * 5 : null
                  return (
                    <>
                      <div>
                        <div style={{ fontSize: '11px', color: textMuted }}>Cost/SqFt</div>
                        <div style={{ fontSize: '15px', color: '#22d3ee', fontWeight: 600 }}>{fmt(cs)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: textMuted }}>Cost/Lin Ft</div>
                        <div style={{ fontSize: '15px', color: '#22d3ee', fontWeight: 600 }}>{fmt(cl)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: textMuted }}>Sell/SqFt (5×)</div>
                        <div style={{ fontSize: '15px', color: '#a855f7', fontWeight: 600 }}>{fmt(ss)}</div>
                      </div>
                    </>
                  )
                })()}
              </div>

              {/* ---- VENDORS SECTION ---- */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Vendors</label>
                {editMaterialVendors.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                    {editMaterialVendors.map((mv) => (
                      <div key={mv.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '8px 12px',
                        background: '#111111',
                        borderRadius: '8px',
                        border: `1px solid ${mv.vendors.brand_color}30`,
                      }}>
                        <div style={{
                          width: '8px', height: '8px', borderRadius: '50%', background: mv.vendors.brand_color, flexShrink: 0,
                        }} />
                        <span style={{ color: textPrimary, fontSize: '13px', fontWeight: 500 }}>{mv.vendors.name}</span>
                        {mv.vendor_sku && <span style={{ color: textMuted, fontSize: '12px' }}>SKU: {mv.vendor_sku}</span>}
                        {mv.vendor_product_url && (
                          <a
                            href={mv.vendor_product_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{ color: '#22d3ee', fontSize: '12px', textDecoration: 'none' }}
                          >
                            Link ↗
                          </a>
                        )}
                        <div style={{ flex: 1 }} />
                        <button
                          onClick={() => handleRemoveVendorLink(mv.id)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px', padding: '2px 6px' }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: textMuted, fontSize: '13px', margin: '0 0 8px' }}>No vendors linked yet.</p>
                )}

                {!isCreating && !addingVendor && (
                  <button
                    onClick={() => setAddingVendor(true)}
                    style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${borderColor}`, borderRadius: '6px', color: textSecondary, cursor: 'pointer', fontSize: '13px' }}
                  >
                    + Add Vendor
                  </button>
                )}
                {isCreating && (
                  <p style={{ color: textMuted, fontSize: '12px', margin: 0, fontStyle: 'italic' }}>
                    Save the material first, then add vendors.
                  </p>
                )}

                {addingVendor && (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div>
                      <label style={{ ...labelStyle, fontSize: '11px' }}>Vendor</label>
                      <select
                        style={{ ...inputStyle, width: '160px' }}
                        value={newVendorLink.vendor_id}
                        onChange={(e) => setNewVendorLink((p) => ({ ...p, vendor_id: e.target.value }))}
                      >
                        <option value="">Select...</option>
                        {vendors
                          .filter((v) => !editMaterialVendors.some((mv) => mv.vendor_id === v.id))
                          .map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ ...labelStyle, fontSize: '11px' }}>Vendor SKU</label>
                      <input
                        style={{ ...inputStyle, width: '160px' }}
                        value={newVendorLink.vendor_sku}
                        onChange={(e) => setNewVendorLink((p) => ({ ...p, vendor_sku: e.target.value }))}
                        placeholder="e.g., AMPI1105RS-54"
                      />
                    </div>
                    <div>
                      <label style={{ ...labelStyle, fontSize: '11px' }}>Product URL</label>
                      <input
                        style={{ ...inputStyle, width: '200px' }}
                        value={newVendorLink.vendor_product_url}
                        onChange={(e) => setNewVendorLink((p) => ({ ...p, vendor_product_url: e.target.value }))}
                        placeholder="https://..."
                      />
                    </div>
                    <button
                      onClick={handleAddVendorLink}
                      disabled={!newVendorLink.vendor_id}
                      style={{ padding: '9px 16px', background: newVendorLink.vendor_id ? accentGradient : textMuted, border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: newVendorLink.vendor_id ? 'pointer' : 'not-allowed', fontSize: '13px' }}
                    >
                      Add
                    </button>
                    <button
                      onClick={() => { setAddingVendor(false); setNewVendorLink({ vendor_id: '', vendor_sku: '', vendor_product_url: '' }) }}
                      style={{ padding: '9px 12px', background: 'none', border: `1px solid ${borderColor}`, borderRadius: '8px', color: textMuted, cursor: 'pointer', fontSize: '13px' }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Active */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" checked={editingMaterial.active ?? true} onChange={(e) => updateField('active', e.target.checked)} style={{ width: '16px', height: '16px' }} />
                <label style={{ color: textSecondary, fontSize: '13px' }}>Active</label>
              </div>

              {/* Printer Compatibility */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Printer Compatibility</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {['ucjv300', 'jv330'].map((p) => (
                    <label key={p} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: textSecondary, fontSize: '13px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={(editingMaterial.printer_compatibility || []).includes(p)} onChange={() => toggleArrayValue('printer_compatibility', p)} />
                      {p === 'ucjv300' ? 'UCJV300-160' : 'JV330-160'}
                    </label>
                  ))}
                </div>
              </div>

              {/* Use Case Categories */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Use Case Categories</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {categories.map((cat) => {
                    const selected = (editingMaterial.use_case_categories || []).includes(cat.category_key)
                    return (
                      <button key={cat.category_key} onClick={() => toggleArrayValue('use_case_categories', cat.category_key)} style={{
                        padding: '4px 10px', borderRadius: '6px', border: `1px solid ${selected ? 'rgba(34,211,238,0.4)' : borderColor}`,
                        background: selected ? 'rgba(34,211,238,0.1)' : 'transparent', color: selected ? '#22d3ee' : textMuted, fontSize: '12px', cursor: 'pointer',
                      }}>
                        {cat.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Use Case Line Item Types */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Use Case Line Item Types</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '120px', overflow: 'auto' }}>
                  {lineItemTypes.map((lt) => {
                    const selected = (editingMaterial.use_case_line_types || []).includes(lt.type_key)
                    return (
                      <button key={lt.type_key} onClick={() => toggleArrayValue('use_case_line_types', lt.type_key)} style={{
                        padding: '4px 10px', borderRadius: '6px', border: `1px solid ${selected ? 'rgba(168,85,247,0.4)' : borderColor}`,
                        background: selected ? 'rgba(168,85,247,0.1)' : 'transparent', color: selected ? '#a855f7' : textMuted, fontSize: '12px', cursor: 'pointer',
                      }}>
                        {lt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Laminate Pairings */}
              {editingMaterial.tab_category === 'media' && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Laminate Pairings</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {laminates.map((lam) => {
                      const selected = (editingMaterial.laminate_pairing_ids || []).includes(lam.id)
                      return (
                        <button key={lam.id} onClick={() => toggleArrayValue('laminate_pairing_ids', lam.id)} style={{
                          padding: '4px 10px', borderRadius: '6px', border: `1px solid ${selected ? 'rgba(236,72,153,0.4)' : borderColor}`,
                          background: selected ? 'rgba(236,72,153,0.1)' : 'transparent', color: selected ? '#ec4899' : textMuted, fontSize: '12px', cursor: 'pointer',
                        }}>
                          {lam.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Notes</label>
                <textarea style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }} value={editingMaterial.notes || ''} onChange={(e) => updateField('notes', e.target.value)} />
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setEditingMaterial(null); setIsCreating(false) }}
                style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${borderColor}`, borderRadius: '8px', color: textSecondary, cursor: 'pointer', fontSize: '14px' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editingMaterial.name}
                style={{ padding: '10px 24px', background: saving ? textMuted : accentGradient, border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontSize: '14px' }}
              >
                {saving ? 'Saving...' : isCreating ? 'Create' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
