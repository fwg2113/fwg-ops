'use client'

import { useState, useMemo } from 'react'
import ModalBackdrop from '../../components/ModalBackdrop'

interface Blade {
  id: string
  cutter: string
  color: string
  label: string | null
  media_material_ids: string[]
  laminate_material_ids: string[]
  primary_media_id: string | null
  primary_laminate_id: string | null
  condition_number: number | null
  condition_number_on_ink: number | null
  total_thickness_mil: number | null
  cut_type: string | null
  cond_kisscut_no_ink: number | null
  cond_kisscut_on_ink: number | null
  cond_diecut_no_ink: number | null
  cond_diecut_on_ink: number | null
  use_cases: string[]
  notes: string | null
  sort_order: number
  active: boolean
  created_at: string
  updated_at: string
}

interface Material {
  id: string
  name: string
  tab_category: string
  material_subtype: string | null
  finish: string | null
  thickness_mil: number | null
  printer_compatibility: string[]
  use_case_categories: string[]
  laminate_pairing_ids: string[]
}

interface Printer {
  id: string
  name: string
  model: string
  ink_method: string
  notes: string | null
}

const CUTTER_TABS = [
  { key: 'graphtec', label: 'Graphtec FC9000-160' },
  { key: 'ucjv', label: 'UCJV Print & Cut' },
] as const

type CutterTab = typeof CUTTER_TABS[number]['key']

const BLADE_COLORS = [
  { value: 'red', hex: '#ef4444', label: 'Red' },
  { value: 'blue', hex: '#3b82f6', label: 'Blue' },
  { value: 'green', hex: '#22c55e', label: 'Green' },
  { value: 'yellow', hex: '#eab308', label: 'Yellow' },
  { value: 'orange', hex: '#f97316', label: 'Orange' },
  { value: 'purple', hex: '#a855f7', label: 'Purple' },
  { value: 'pink', hex: '#ec4899', label: 'Pink' },
  { value: 'white', hex: '#e2e8f0', label: 'White' },
  { value: 'black', hex: '#374151', label: 'Black' },
  { value: 'cyan', hex: '#22d3ee', label: 'Cyan' },
  { value: 'holographic', hex: 'holographic', label: 'Holographic' },
  { value: 'blank', hex: '#1a1a1a', label: 'Blank Blade' },
]

const CUT_TYPES = [
  { value: 'kisscut', label: 'Kiss Cut' },
  { value: 'diecut', label: 'Die Cut' },
  { value: 'both', label: 'Both' },
]

const cardBg = '#1d1d1d'
const borderColor = 'rgba(148, 163, 184, 0.1)'
const textPrimary = '#f1f5f9'
const textSecondary = '#94a3b8'
const textMuted = '#64748b'
const accentGradient = 'linear-gradient(90deg, #22d3ee, #a855f7, #ec4899)'

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.3px' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', background: '#111111', border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }

function getColorHex(c: string): string { if (c === 'holographic') return '#a855f7'; if (c === 'blank') return '#1a1a1a'; return BLADE_COLORS.find((x) => x.value === c)?.hex || c }
function getColorLabel(c: string): string { return BLADE_COLORS.find((x) => x.value === c)?.label || c }
function isHolo(c: string) { return c === 'holographic' }
function isBlank(c: string) { return c === 'blank' }

const EMPTY_BLADE: Partial<Blade> = {
  cutter: 'graphtec', color: 'red', label: '', media_material_ids: [], laminate_material_ids: [],
  primary_media_id: null, primary_laminate_id: null, condition_number: null, condition_number_on_ink: null,
  total_thickness_mil: null, cut_type: 'both', cond_kisscut_no_ink: null, cond_kisscut_on_ink: null,
  cond_diecut_no_ink: null, cond_diecut_on_ink: null, use_cases: [], notes: '', sort_order: 0, active: true,
}

export default function BladeGuide({ initialBlades, materials, printers }: { initialBlades: Blade[]; materials: Material[]; printers: Printer[] }) {
  const [blades, setBlades] = useState<Blade[]>(initialBlades)
  const [cutterTab, setCutterTab] = useState<CutterTab>('graphtec')
  const [editingBlade, setEditingBlade] = useState<Partial<Blade> | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showHelper, setShowHelper] = useState(false)

  // Helper state
  const [helperMedia, setHelperMedia] = useState('')
  const [helperLaminate, setHelperLaminate] = useState('')
  const [helperCutType, setHelperCutType] = useState('')
  const [helperPrinter, setHelperPrinter] = useState('')
  const [helperOnInk, setHelperOnInk] = useState('')

  const media = useMemo(() => materials.filter((m) => m.tab_category === 'media' || m.tab_category === 'ppf'), [materials])
  const laminates = useMemo(() => materials.filter((m) => m.tab_category === 'laminate'), [materials])
  const currentBlades = useMemo(() => blades.filter((b) => b.cutter === cutterTab && b.active), [blades, cutterTab])

  const getMaterialThickness = (id: string) => materials.find((m) => m.id === id)?.thickness_mil || 0

  // Helper: calculate searched thickness
  const helperTotalThickness = useMemo(() => {
    if (!helperMedia) return 0
    return (materials.find((m) => m.id === helperMedia)?.thickness_mil || 0) +
      (helperLaminate ? materials.find((m) => m.id === helperLaminate)?.thickness_mil || 0 : 0)
  }, [helperMedia, helperLaminate, materials])

  // Helper: determine if cutting on UCJV ink
  const helperIsOnInk = helperPrinter === 'ucjv' && helperOnInk === 'yes'

  // Helper: find best matching blade (within 1mil of searched thickness)
  const helperResult = useMemo(() => {
    if (!helperMedia) return null
    const candidates = blades
      .filter((b) => b.cutter === cutterTab && b.active && !isBlank(b.color) && b.total_thickness_mil != null)
      .filter((b) => {
        if (helperCutType && b.cut_type !== helperCutType && b.cut_type !== 'both') return false
        return true
      })
      .map((b) => ({ blade: b, diff: Math.abs((b.total_thickness_mil || 0) - helperTotalThickness) }))
      .sort((a, b) => a.diff - b.diff)

    const best = candidates[0]
    if (best && best.diff <= 1) return best.blade
    return null
  }, [helperMedia, helperTotalThickness, helperCutType, blades, cutterTab])

  // Helper: get the right condition number based on search context
  const getHelperCondNumber = (blade: Blade): { label: string; value: number | null } => {
    if (blade.cutter === 'ucjv') {
      if (helperCutType === 'diecut') return { label: 'Die Cut', value: blade.cond_diecut_no_ink }
      return { label: 'Kiss Cut', value: blade.cond_kisscut_no_ink }
    }
    // Graphtec
    const isKiss = helperCutType === 'kisscut' || (!helperCutType && (blade.cut_type === 'kisscut' || blade.cut_type === 'both'))
    if (isKiss) {
      if (helperIsOnInk) return { label: 'Kiss Cut (On UV Ink)', value: blade.condition_number_on_ink }
      return { label: 'Kiss Cut', value: blade.condition_number }
    }
    if (helperIsOnInk) return { label: 'Die Cut (On UV Ink)', value: blade.cond_diecut_on_ink }
    return { label: 'Die Cut', value: blade.cond_diecut_no_ink }
  }

  const blankBlade = useMemo(() => blades.find((b) => b.cutter === cutterTab && b.color === 'blank' && b.active), [blades, cutterTab])

  const handleSave = async () => {
    if (!editingBlade?.color) return
    setSaving(true)
    setError(null)
    try {
      const pmt = editingBlade.primary_media_id ? getMaterialThickness(editingBlade.primary_media_id) : 0
      const plt = editingBlade.primary_laminate_id ? getMaterialThickness(editingBlade.primary_laminate_id) : 0
      const autoT = pmt + plt
      const payload = { ...editingBlade, total_thickness_mil: autoT || editingBlade.total_thickness_mil }

      const method = isCreating ? 'POST' : 'PUT'
      const res = await fetch('/api/blades', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      if (isCreating) setBlades((p) => [...p, data])
      else setBlades((p) => p.map((b) => (b.id === data.id ? data : b)))
      setEditingBlade(null)
      setIsCreating(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this blade? This cannot be undone.')) return
    try {
      const res = await fetch(`/api/blades?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setBlades((p) => p.filter((b) => b.id !== id))
      setEditingBlade(null)
      setIsCreating(false)
    } catch { setError('Failed to delete blade') }
  }

  const openCreate = () => { setEditingBlade({ ...EMPTY_BLADE, cutter: cutterTab }); setIsCreating(true) }
  const openEdit = (blade: Blade) => { setEditingBlade({ ...blade }); setIsCreating(false) }
  const updateField = (f: string, v: unknown) => { setEditingBlade((p) => p ? { ...p, [f]: v } : p) }
  const toggleArray = (f: string, v: string) => {
    setEditingBlade((p) => {
      if (!p) return p
      const a = ((p as Record<string, unknown>)[f] as string[]) || []
      return { ...p, [f]: a.includes(v) ? a.filter((x) => x !== v) : [...a, v] }
    })
  }
  const resetHelper = () => { setHelperMedia(''); setHelperLaminate(''); setHelperCutType(''); setHelperPrinter(''); setHelperOnInk('') }

  return (
    <div style={{ padding: '24px', maxWidth: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: textPrimary, margin: 0 }}>
          Blade <span style={{ background: accentGradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Guide</span>
        </h1>
        <p style={{ color: textSecondary, margin: '4px 0 0', fontSize: '14px' }}>Blade and condition number reference — color-coded blades, material pairings, and cut settings</p>
      </div>

      {/* Cutter tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#111111', borderRadius: '10px', padding: '4px', border: `1px solid ${borderColor}`, maxWidth: '500px' }}>
        {CUTTER_TABS.map((tab) => {
          const count = blades.filter((b) => b.cutter === tab.key && b.active).length
          const isActive = cutterTab === tab.key
          return (
            <button key={tab.key} onClick={() => { setCutterTab(tab.key); setShowHelper(false); resetHelper() }}
              style={{ flex: 1, padding: '10px 16px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, transition: 'all 0.15s', background: isActive ? cardBg : 'transparent', color: isActive ? textPrimary : textMuted, boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.3)' : 'none' }}>
              {tab.label} <span style={{ fontSize: '12px', opacity: 0.6 }}>({count})</span>
            </button>
          )
        })}
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#ef4444', fontSize: '13px', marginBottom: '16px' }}>
          {error}<button onClick={() => setError(null)} style={{ float: 'right', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>×</button>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <button onClick={openCreate} style={{ padding: '10px 20px', background: accentGradient, border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>+ Add Blade</button>
        <button onClick={() => { setShowHelper(!showHelper); resetHelper() }}
          style={{ padding: '10px 20px', background: showHelper ? 'rgba(234,179,8,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${showHelper ? 'rgba(234,179,8,0.3)' : borderColor}`, borderRadius: '8px', color: showHelper ? '#eab308' : textSecondary, fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
          {showHelper ? 'Close Helper' : 'Not sure what blade?'}
        </button>
      </div>

      {/* ==================== NOT SURE HELPER ==================== */}
      {showHelper && (
        <div style={{ background: cardBg, borderRadius: '12px', border: '1px solid rgba(234,179,8,0.2)', padding: '24px' }}>
          <h3 style={{ color: '#eab308', fontSize: '16px', fontWeight: 600, margin: '0 0 16px' }}>
            Blade Finder — {cutterTab === 'graphtec' ? 'Graphtec FC9000-160' : 'UCJV Print & Cut'}
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <div>
              <label style={labelStyle}>What media?</label>
              <select style={inputStyle} value={helperMedia} onChange={(e) => { setHelperMedia(e.target.value); setHelperLaminate('') }}>
                <option value="">Select media...</option>
                {media.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.thickness_mil} mil)</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>What laminate?</label>
              <select style={inputStyle} value={helperLaminate} onChange={(e) => setHelperLaminate(e.target.value)}>
                <option value="">None / Select...</option>
                {laminates.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.thickness_mil} mil)</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Cut style?</label>
              <select style={inputStyle} value={helperCutType} onChange={(e) => setHelperCutType(e.target.value)}>
                <option value="">Any</option>
                <option value="kisscut">Kiss Cut</option>
                <option value="diecut">Die Cut</option>
              </select>
            </div>
            {cutterTab === 'graphtec' && (
              <div>
                <label style={labelStyle}>What printer?</label>
                <select style={inputStyle} value={helperPrinter} onChange={(e) => { setHelperPrinter(e.target.value); setHelperOnInk('') }}>
                  <option value="">Select...</option>
                  {printers.map((p) => <option key={p.id} value={p.model.toLowerCase().includes('ucjv') ? 'ucjv' : 'jv330'}>{p.name}</option>)}
                </select>
              </div>
            )}
            {cutterTab === 'graphtec' && helperPrinter === 'ucjv' && (
              <div>
                <label style={labelStyle}>Cutting on ink?</label>
                <select style={inputStyle} value={helperOnInk} onChange={(e) => setHelperOnInk(e.target.value)}>
                  <option value="">Select...</option>
                  <option value="no">No — cutting on bare media</option>
                  <option value="yes">Yes — cutting through UV ink</option>
                </select>
              </div>
            )}
          </div>

          {/* Prominent thickness display */}
          {helperMedia && (
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ padding: '12px 20px', background: 'rgba(168,85,247,0.12)', borderRadius: '10px', border: '1px solid rgba(168,85,247,0.3)' }}>
                <div style={{ fontSize: '10px', color: textMuted, textTransform: 'uppercase', fontWeight: 600, marginBottom: '2px' }}>Dial For This Thickness</div>
                <div style={{ fontSize: '28px', fontWeight: 800, color: '#a855f7' }}>{helperTotalThickness.toFixed(1)} mil</div>
              </div>
              <div style={{ fontSize: '13px', color: textSecondary }}>
                Media: {materials.find((m) => m.id === helperMedia)?.thickness_mil || 0} mil
                {helperLaminate && (<> + Laminate: {materials.find((m) => m.id === helperLaminate)?.thickness_mil || 0} mil</>)}
              </div>
            </div>
          )}

          {/* Result */}
          {helperMedia && helperResult && (
            <div>
              <h4 style={{ color: '#22c55e', fontSize: '14px', margin: '0 0 12px' }}>Recommended Blade</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '12px' }}>
                <BladeCard blade={helperResult} materials={materials} onEdit={() => openEdit(helperResult)} />
              </div>
              {/* Show the relevant condition number for the search context */}
              {(() => {
                const cond = getHelperCondNumber(helperResult)
                return cond.value != null ? (
                  <div style={{ marginTop: '12px', padding: '12px 18px', background: helperIsOnInk ? 'rgba(249,115,22,0.1)' : 'rgba(34,211,238,0.1)', borderRadius: '10px', border: `1px solid ${helperIsOnInk ? 'rgba(249,115,22,0.25)' : 'rgba(34,211,238,0.25)'}`, display: 'inline-flex', alignItems: 'center', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: textMuted, textTransform: 'uppercase', fontWeight: 600 }}>Use Condition # ({cond.label})</div>
                      <div style={{ fontSize: '24px', fontWeight: 800, color: helperIsOnInk ? '#f97316' : '#22d3ee' }}>{cond.value}</div>
                    </div>
                  </div>
                ) : null
              })()}
            </div>
          )}

          {helperMedia && !helperResult && (
            <div>
              <h4 style={{ color: '#eab308', fontSize: '14px', margin: '0 0 6px' }}>No dialed blade within range</h4>
              <p style={{ color: textSecondary, fontSize: '13px', margin: '0 0 12px' }}>
                No blade is dialed within 1 mil of <strong style={{ color: '#a855f7' }}>{helperTotalThickness.toFixed(1)} mil</strong>.
                {blankBlade ? ' Use the blank blade and dial it to this thickness for this job.' : ' Add a blank blade to use as a catch-all.'}
              </p>
              {blankBlade && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '12px' }}>
                  <BladeCard blade={blankBlade} materials={materials} onEdit={() => openEdit(blankBlade)} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================== BLADE CARDS (hidden when helper is open) ==================== */}
      {!showHelper && (
        <>
          {currentBlades.length === 0 ? (
            <div style={{ padding: '40px', background: cardBg, borderRadius: '12px', border: `1px solid ${borderColor}`, textAlign: 'center' }}>
              <p style={{ color: textMuted, fontSize: '14px', margin: 0 }}>
                No blades configured for {cutterTab === 'graphtec' ? 'Graphtec FC9000-160' : 'UCJV Print & Cut'} yet. Click &quot;+ Add Blade&quot; to get started.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '16px' }}>
              {currentBlades.map((blade) => (
                <BladeCard key={blade.id} blade={blade} materials={materials} onEdit={() => openEdit(blade)} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ==================== EDIT/CREATE MODAL ==================== */}
      {editingBlade && (
        <ModalBackdrop onClose={() => { setEditingBlade(null); setIsCreating(false) }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: '#1a1a1a', borderRadius: '16px', border: `1px solid ${borderColor}`, width: '650px', maxHeight: '85vh', overflow: 'auto', padding: '28px' }}>
            <h2 style={{ color: textPrimary, fontSize: '20px', fontWeight: 700, margin: '0 0 20px' }}>
              {isCreating ? 'Add Blade' : 'Edit Blade'}
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Cutter</label>
                <select style={inputStyle} value={editingBlade.cutter || 'graphtec'} onChange={(e) => updateField('cutter', e.target.value)}>
                  <option value="graphtec">Graphtec FC9000-160</option>
                  <option value="ucjv">UCJV Print & Cut</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Blade Color</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {BLADE_COLORS.map((c) => (
                    <button key={c.value} onClick={() => updateField('color', c.value)} title={c.label}
                      style={{ width: '30px', height: '30px', borderRadius: '6px',
                        background: c.value === 'holographic' ? 'linear-gradient(135deg, #22d3ee, #a855f7, #ec4899, #eab308)' : c.value === 'blank' ? '#1a1a1a' : c.hex,
                        border: editingBlade.color === c.value ? '2px solid #fff' : c.value === 'blank' ? '2px solid #374151' : '2px solid transparent', cursor: 'pointer' }} />
                  ))}
                </div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Label / Description</label>
                <input style={inputStyle} value={editingBlade.label || ''} onChange={(e) => updateField('label', e.target.value)} placeholder='e.g., "General purpose vinyl"' />
              </div>

              {/* === GRAPHTEC FIELDS === */}
              {(editingBlade.cutter || 'graphtec') === 'graphtec' && (
                <>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Cut Type</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {CUT_TYPES.map((ct) => {
                        const a = editingBlade.cut_type === ct.value
                        return <button key={ct.value} onClick={() => updateField('cut_type', ct.value)}
                          style={{ flex: 1, padding: '10px 16px', borderRadius: '8px', border: `1px solid ${a ? 'rgba(34,211,238,0.4)' : borderColor}`, background: a ? 'rgba(34,211,238,0.1)' : 'transparent', color: a ? '#22d3ee' : textMuted, fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>{ct.label}</button>
                      })}
                    </div>
                  </div>
                  {(editingBlade.cut_type === 'kisscut' || editingBlade.cut_type === 'both') && (<div><label style={labelStyle}>Cond # — Kiss Cut (Standard)</label><input style={inputStyle} type="number" value={editingBlade.condition_number ?? ''} onChange={(e) => updateField('condition_number', e.target.value ? Number(e.target.value) : null)} placeholder="JV330 / UCJV bare" /></div>)}
                  {(editingBlade.cut_type === 'kisscut' || editingBlade.cut_type === 'both') && (<div><label style={labelStyle}>Cond # — Kiss Cut (On UV Ink)</label><input style={inputStyle} type="number" value={editingBlade.condition_number_on_ink ?? ''} onChange={(e) => updateField('condition_number_on_ink', e.target.value ? Number(e.target.value) : null)} placeholder="Cutting on UV ink" /></div>)}
                  {(editingBlade.cut_type === 'diecut' || editingBlade.cut_type === 'both') && (<div><label style={labelStyle}>Cond # — Die Cut (Standard)</label><input style={inputStyle} type="number" value={editingBlade.cond_diecut_no_ink ?? ''} onChange={(e) => updateField('cond_diecut_no_ink', e.target.value ? Number(e.target.value) : null)} placeholder="JV330 / UCJV bare" /></div>)}
                  {(editingBlade.cut_type === 'diecut' || editingBlade.cut_type === 'both') && (<div><label style={labelStyle}>Cond # — Die Cut (On UV Ink)</label><input style={inputStyle} type="number" value={editingBlade.cond_diecut_on_ink ?? ''} onChange={(e) => updateField('cond_diecut_on_ink', e.target.value ? Number(e.target.value) : null)} placeholder="Cutting on UV ink" /></div>)}
                </>
              )}

              {/* === UCJV FIELDS === */}
              {editingBlade.cutter === 'ucjv' && (
                <>
                  <div><label style={labelStyle}>Condition # (Kiss Cut)</label><input style={inputStyle} type="number" value={editingBlade.cond_kisscut_no_ink ?? ''} onChange={(e) => updateField('cond_kisscut_no_ink', e.target.value ? Number(e.target.value) : null)} /></div>
                  <div><label style={labelStyle}>Condition # (Die Cut)</label><input style={inputStyle} type="number" value={editingBlade.cond_diecut_no_ink ?? ''} onChange={(e) => updateField('cond_diecut_no_ink', e.target.value ? Number(e.target.value) : null)} /></div>
                </>
              )}

              <div><label style={labelStyle}>Total Thickness (mil) — auto from ★</label><input style={inputStyle} type="number" step="0.1" value={editingBlade.total_thickness_mil ?? ''} onChange={(e) => updateField('total_thickness_mil', e.target.value ? Number(e.target.value) : null)} placeholder="Auto from primary" /></div>
              <div><label style={labelStyle}>Sort Order</label><input style={inputStyle} type="number" value={editingBlade.sort_order ?? 0} onChange={(e) => updateField('sort_order', Number(e.target.value) || 0)} /></div>

              {/* Media */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Media — <span style={{ color: '#eab308' }}>★</span> = dialed for (sets thickness)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '140px', overflow: 'auto' }}>
                  {media.map((m) => {
                    const sel = (editingBlade.media_material_ids || []).includes(m.id)
                    const pri = editingBlade.primary_media_id === m.id
                    return (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <button onClick={() => { toggleArray('media_material_ids', m.id); if (pri) updateField('primary_media_id', null) }}
                          style={{ padding: '4px 10px', borderRadius: sel ? '6px 0 0 6px' : '6px', border: `1px solid ${sel ? 'rgba(34,211,238,0.4)' : borderColor}`, borderRight: sel ? 'none' : undefined, background: sel ? 'rgba(34,211,238,0.1)' : 'transparent', color: sel ? '#22d3ee' : textMuted, fontSize: '12px', cursor: 'pointer' }}>
                          {m.name} <span style={{ color: textMuted, fontSize: '11px' }}>({m.thickness_mil}mil)</span>
                        </button>
                        {sel && <button onClick={() => updateField('primary_media_id', pri ? null : m.id)} title={pri ? 'Remove primary' : 'Set as primary'}
                          style={{ padding: '4px 8px', borderRadius: '0 6px 6px 0', border: `1px solid ${pri ? 'rgba(234,179,8,0.5)' : 'rgba(34,211,238,0.4)'}`, background: pri ? 'rgba(234,179,8,0.15)' : 'rgba(34,211,238,0.05)', color: pri ? '#eab308' : '#64748b', cursor: 'pointer', fontSize: '14px', lineHeight: 1 }}>{pri ? '★' : '☆'}</button>}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Laminate */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Laminate — <span style={{ color: '#eab308' }}>★</span> = dialed for (sets thickness)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '120px', overflow: 'auto' }}>
                  {laminates.map((l) => {
                    const sel = (editingBlade.laminate_material_ids || []).includes(l.id)
                    const pri = editingBlade.primary_laminate_id === l.id
                    return (
                      <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <button onClick={() => { toggleArray('laminate_material_ids', l.id); if (pri) updateField('primary_laminate_id', null) }}
                          style={{ padding: '4px 10px', borderRadius: sel ? '6px 0 0 6px' : '6px', border: `1px solid ${sel ? 'rgba(236,72,153,0.4)' : borderColor}`, borderRight: sel ? 'none' : undefined, background: sel ? 'rgba(236,72,153,0.1)' : 'transparent', color: sel ? '#ec4899' : textMuted, fontSize: '12px', cursor: 'pointer' }}>
                          {l.name} <span style={{ color: textMuted, fontSize: '11px' }}>({l.thickness_mil}mil)</span>
                        </button>
                        {sel && <button onClick={() => updateField('primary_laminate_id', pri ? null : l.id)} title={pri ? 'Remove primary' : 'Set as primary'}
                          style={{ padding: '4px 8px', borderRadius: '0 6px 6px 0', border: `1px solid ${pri ? 'rgba(234,179,8,0.5)' : 'rgba(236,72,153,0.4)'}`, background: pri ? 'rgba(234,179,8,0.15)' : 'rgba(236,72,153,0.05)', color: pri ? '#eab308' : '#64748b', cursor: 'pointer', fontSize: '14px', lineHeight: 1 }}>{pri ? '★' : '☆'}</button>}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Notes</label><textarea style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} value={editingBlade.notes || ''} onChange={(e) => updateField('notes', e.target.value)} /></div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'space-between' }}>
              <div>
                {!isCreating && (
                  <button onClick={() => { if (editingBlade.id) handleDelete(editingBlade.id) }}
                    style={{ padding: '10px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#ef4444', cursor: 'pointer', fontSize: '13px' }}>Delete Blade</button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => { setEditingBlade(null); setIsCreating(false) }} style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${borderColor}`, borderRadius: '8px', color: textSecondary, cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
                <button onClick={handleSave} disabled={saving} style={{ padding: '10px 24px', background: saving ? textMuted : accentGradient, border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontSize: '14px' }}>{saving ? 'Saving...' : isCreating ? 'Create' : 'Save Changes'}</button>
              </div>
            </div>
          </div>
        </ModalBackdrop>
      )}
    </div>
  )
}

/* ==================== SVG COMPONENTS ==================== */

function BladeHolderSvg({ color, bladeColor, size = 170 }: { color: string; bladeColor: string; size?: number }) {
  const holo = isHolo(bladeColor); const blank = isBlank(bladeColor)
  const bandFill = blank ? '#0f0a0f' : holo ? 'url(#holoGrad)' : color
  const glow = blank ? 'none' : holo ? 'drop-shadow(0 0 14px rgba(168,85,247,0.4))' : `drop-shadow(0 0 12px ${color}30)`
  return (
    <svg viewBox="0 0 106.9 345.68" style={{ width: size * (106.9 / 345.68), height: size, filter: glow }}>
      {holo && (<defs><linearGradient id="holoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#22d3ee"><animate attributeName="stop-color" values="#22d3ee;#a855f7;#ec4899;#eab308;#22d3ee" dur="3s" repeatCount="indefinite" /></stop>
        <stop offset="33%" stopColor="#a855f7"><animate attributeName="stop-color" values="#a855f7;#ec4899;#eab308;#22d3ee;#a855f7" dur="3s" repeatCount="indefinite" /></stop>
        <stop offset="66%" stopColor="#ec4899"><animate attributeName="stop-color" values="#ec4899;#eab308;#22d3ee;#a855f7;#ec4899" dur="3s" repeatCount="indefinite" /></stop>
        <stop offset="100%" stopColor="#eab308"><animate attributeName="stop-color" values="#eab308;#22d3ee;#a855f7;#ec4899;#eab308" dur="3s" repeatCount="indefinite" /></stop>
      </linearGradient></defs>)}
      <path fill="#231f20" d="M103.05,126.35H3.85c-2.13,0-3.85,1.72-3.85,3.85v5.45c0,2.13,1.72,3.85,3.85,3.85h99.2c2.13,0,3.85-1.72,3.85-3.85v-5.45c0-2.13-1.72-3.85-3.85-3.85Z"/>
      <path fill="#0f0a0f" d="M72.02,73.76h13.72V8.43c0-4.66-3.77-8.43-8.43-8.43h-5.29v1.52h-13.15V0h-29.29c-4.66,0-8.43,3.77-8.43,8.43v65.33h50.87Z"/>
      <path fill="#0f0a0f" d="M98.1,85.35h0v-7.41c0-2.31-1.87-4.17-4.17-4.17H12.98c-2.31,0-4.17,1.87-4.17,4.17v7.41c29.76.89,59.54.89,89.29,0Z"/>
      <path fill="#0f0a0f" d="M72.02,126.35h26.07v-8.53h0c-29.76.89-59.54.89-89.29,0v8.53h63.22Z"/>
      <path fill="#bcbec0" d="M50.95,345.68l5-6.35v-2.59c-1.67.02-3.33.02-5,0v8.93Z"/>
      <path fill="#2a2e81" d="M14.49,318.26v9.99c0,.88.28,1.73.8,2.43,1.37,1.84,3.38,3.1,5.64,3.47,9.95,1.63,19.98,2.49,30.01,2.6,1.67.02,3.33.02,5,0,9.65-.13,19.29-.96,28.87-2.5,1.53-.25,2.96-.9,4.17-1.87,2.16-1.74,3.42-4.37,3.42-7.14v-7.05l-.8.12c-25.56,3.9-51.56,3.88-77.11-.04Z"/>
      <path fill="#2f3192" d="M91.6,245.71c-9.72,1.48-19.5,2.4-29.29,2.75-.09,0-.19,0-.28.01-1.16.04-2.32.06-3.48.09-.49.01-.98.03-1.47.04-1.09.02-2.19.02-3.28.02-.56,0-1.11.01-1.67,0-1,0-2-.03-3-.04-.65-.01-1.3-.01-1.95-.03-1.04-.02-2.08-.07-3.13-.1-.61-.02-1.21-.03-1.82-.06-1.52-.07-3.04-.15-4.56-.24-.13,0-.25-.01-.38-.02-8.23-.51-16.45-1.43-24.62-2.74-1.75-.28-3.33,1.07-3.33,2.84v65.84c0,1.94,1.41,3.6,3.33,3.91h0c.6.1,1.21.18,1.81.27,25.55,3.92,51.55,3.94,77.11.04l.8-.12,1.7-.26c1.97-.26,3.45-1.94,3.45-3.93v-65.83c0-1.74-1.53-3.08-3.25-2.86l-.2.03h0s-2.5.38-2.5.38Z"/>
      <path fill="#0f0a0f" d="M9.35,240.83c0,2.08,1.34,3.92,3.32,4.56,0,0,0,0,0,0,0,0,0,0,0,0,8.17,1.31,16.38,2.23,24.61,2.74.13,0,.25.01.38.02,1.52.09,3.04.17,4.56.24.61.03,1.21.04,1.82.06,1.04.04,2.08.08,3.13.1.65.02,1.3.02,1.95.03,1,.02,2,.04,3,.04.55,0,1.11,0,1.67,0,1.09,0,2.19,0,3.28-.02.49,0,.98-.03,1.47-.04,1.16-.02,2.32-.05,3.48-.09.09,0,.19,0,.28-.01,9.8-.35,19.58-1.27,29.29-2.75l2.5-.38h0c2.04-.6,3.45-2.47,3.45-4.6v-101.23H9.35v101.33Z"/>
      <path fill={bandFill} d="M98.1,117.82h0v-32.47h0c-29.76.89-59.54.89-89.29,0v32.47c29.76.89,59.54.89,89.29,0Z"/>
    </svg>
  )
}

function UcjvBladeHolderSvg({ color, bladeColor, size = 170 }: { color: string; bladeColor: string; size?: number }) {
  const holo = isHolo(bladeColor); const blank = isBlank(bladeColor)
  const bandFill = blank ? '#0f0a0f' : holo ? 'url(#holoGradU)' : color
  const glow = blank ? 'none' : holo ? 'drop-shadow(0 0 14px rgba(168,85,247,0.4))' : `drop-shadow(0 0 12px ${color}30)`
  return (
    <svg viewBox="0 0 96.53 343.39" style={{ width: size * (96.53 / 343.39), height: size, filter: glow }}>
      {holo && (<defs><linearGradient id="holoGradU" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#22d3ee"><animate attributeName="stop-color" values="#22d3ee;#a855f7;#ec4899;#eab308;#22d3ee" dur="3s" repeatCount="indefinite" /></stop>
        <stop offset="33%" stopColor="#a855f7"><animate attributeName="stop-color" values="#a855f7;#ec4899;#eab308;#22d3ee;#a855f7" dur="3s" repeatCount="indefinite" /></stop>
        <stop offset="66%" stopColor="#ec4899"><animate attributeName="stop-color" values="#ec4899;#eab308;#22d3ee;#a855f7;#ec4899" dur="3s" repeatCount="indefinite" /></stop>
        <stop offset="100%" stopColor="#eab308"><animate attributeName="stop-color" values="#eab308;#22d3ee;#a855f7;#ec4899;#eab308" dur="3s" repeatCount="indefinite" /></stop>
      </linearGradient></defs>)}
      <g><path fill="#0f0a0f" d="M78.67,105.84c-3.85.75-7.72,1.35-11.61,1.81-12.49,1.48-25.1,1.48-37.59,0-3.88-.46-7.76-1.06-11.61-1.81-2.17-.42-4.19,1.24-4.19,3.45v15.54c23.05.69,46.12.69,69.18,0v-15.54c0-2.21-2.02-3.87-4.19-3.45Z"/><path fill="#0f0a0f" d="M13.68,149.99v10.39h69.18v-10.39c-23.05.69-46.12.69-69.18,0Z"/><path fill="#0f0a0f" d="M13.68,256.36c0,.68.43,1.29,1.08,1.51l.57.2.76.27c20.84,7.26,43.52,7.26,64.36,0l.76-.27.57-.2c.64-.22,1.08-.83,1.08-1.51v-85.04H13.68v85.04Z"/></g>
      <g><path fill="#616264" d="M29.47,107.65c12.49,1.48,25.1,1.48,37.59,0v-17.62H29.47v17.62Z"/><rect fill="#616264" x="29.47" y="65.14" width="37.59" height="8.47"/><rect fill="#616264" x="32.18" y="40.26" width="32.18" height="8.47"/><rect fill="#616264" x="32.18" y="15.38" width="32.18" height="8.47"/></g>
      <g><path fill="#bcbec0" opacity="0.7" d="M75.74,73.61H20.79c-2.37,0-4.29,1.92-4.29,4.29v7.83c0,2.37,1.92,4.29,4.29,4.29h54.95c2.37,0,4.29-1.92,4.29-4.29v-7.83c0-2.37-1.92-4.29-4.29-4.29Z"/><path fill="#bcbec0" opacity="0.7" d="M75.74,48.73H20.79c-2.37,0-4.29,1.92-4.29,4.29v7.83c0,2.37,1.92,4.29,4.29,4.29h54.95c2.37,0,4.29-1.92,4.29-4.29v-7.83c0-2.37-1.92-4.29-4.29-4.29Z"/><path fill="#bcbec0" opacity="0.7" d="M75.74,23.85H20.79c-2.37,0-4.29,1.92-4.29,4.29v7.83c0,2.37,1.92,4.29,4.29,4.29h54.95c2.37,0,4.29-1.92,4.29-4.29v-7.83c0-2.37-1.92-4.29-4.29-4.29Z"/><path fill="#bcbec0" opacity="0.7" d="M78.85,2.21C58.57-.74,37.96-.74,17.68,2.21c-.68.1-1.18.68-1.18,1.36v10.04c0,.98.79,1.77,1.77,1.77h59.99c.98,0,1.77-.79,1.77-1.77V3.57c0-.68-.5-1.26-1.18-1.36Z"/></g>
      <path fill="#bcbec0" d="M45.77,334.77v8.62l5-6.35v-2.31c-1.67.11-3.33.13-5,.04Z"/>
      <g><path fill="#110c11" d="M16.09,258.34l-.76-.27v58.75c0,2.73,1.28,5.29,3.43,6.84l4.15,3c6.91,4.99,14.84,7.69,22.86,8.11,1.67.09,3.33.07,5-.04,7.3-.49,14.52-2.88,20.96-7.19l5.83-3.91c2.28-1.53,3.65-4.17,3.65-7v-58.56l-.76.27c-20.84,7.26-43.52,7.26-64.36,0Z"/><path fill="#110c11" d="M91.06,160.37H5.47c-3.02,0-5.47,2.45-5.47,5.47s2.45,5.47,5.47,5.47h85.59c3.02,0,5.47-2.45,5.47-5.47s-2.45-5.47-5.47-5.47Z"/></g>
      <path fill={bandFill} d="M82.85,149.99v-25.16c-23.05.69-46.12.69-69.18,0v25.16c23.05.69,46.12.69,69.18,0Z"/>
    </svg>
  )
}

/* ==================== BLADE CARD ==================== */

function BladeCard({ blade, materials, onEdit }: { blade: Blade; materials: Material[]; onEdit: () => void }) {
  const colorHex = getColorHex(blade.color)
  const primaryMediaId = blade.primary_media_id
  const primaryLamId = blade.primary_laminate_id
  const primaryMedia = primaryMediaId ? materials.find((m) => m.id === primaryMediaId) : null
  const primaryLam = primaryLamId ? materials.find((m) => m.id === primaryLamId) : null
  const otherMedia = (blade.media_material_ids || []).filter((id) => id !== primaryMediaId).map((id) => materials.find((m) => m.id === id)?.name).filter(Boolean)
  const otherLam = (blade.laminate_material_ids || []).filter((id) => id !== primaryLamId).map((id) => materials.find((m) => m.id === id)?.name).filter(Boolean)

  return (
    <div onDoubleClick={onEdit}
      style={{ background: '#1d1d1d', borderRadius: '12px', border: '1px solid rgba(148, 163, 184, 0.1)', overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.15s', position: 'relative' }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${colorHex}40` }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.1)' }}>
      <div style={{ display: 'flex', padding: '20px' }}>
        {/* Left: SVG */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingRight: '20px', borderRight: '1px solid rgba(148,163,184,0.08)', marginRight: '20px' }}>
          {blade.cutter === 'ucjv'
            ? <UcjvBladeHolderSvg color={colorHex} bladeColor={blade.color} size={170} />
            : <BladeHolderSvg color={colorHex} bladeColor={blade.color} size={170} />}
        </div>

        {/* Right: Details */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title */}
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#f1f5f9' }}>
              {isHolo(blade.color) ? (<><span style={{ background: 'linear-gradient(90deg, #22d3ee, #a855f7, #ec4899, #eab308)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Holographic</span> Blade</>)
                : isBlank(blade.color) ? (<span style={{ color: '#64748b' }}>Blank Blade</span>)
                : (<><span style={{ color: colorHex }}>{getColorLabel(blade.color)}</span> Blade</>)}
            </div>
            {blade.label && <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '2px' }}>{blade.label}</div>}
          </div>

          {/* Stats — Graphtec */}
          {blade.cutter === 'graphtec' && (
            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
              {(blade.cut_type === 'kisscut' || blade.cut_type === 'both') && blade.condition_number !== null && (
                <div style={{ padding: '6px 14px', background: 'rgba(34,211,238,0.1)', borderRadius: '8px', border: '1px solid rgba(34,211,238,0.2)' }}>
                  <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Kiss Cut</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#22d3ee' }}>{blade.condition_number}</div>
                </div>)}
              {(blade.cut_type === 'kisscut' || blade.cut_type === 'both') && blade.condition_number_on_ink !== null && (
                <div style={{ padding: '6px 14px', background: 'rgba(249,115,22,0.1)', borderRadius: '8px', border: '1px solid rgba(249,115,22,0.2)' }}>
                  <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Kiss Cut (UV Ink)</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#f97316' }}>{blade.condition_number_on_ink}</div>
                </div>)}
              {(blade.cut_type === 'diecut' || blade.cut_type === 'both') && blade.cond_diecut_no_ink !== null && (
                <div style={{ padding: '6px 14px', background: 'rgba(34,211,238,0.1)', borderRadius: '8px', border: '1px solid rgba(34,211,238,0.2)' }}>
                  <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Die Cut</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#22d3ee' }}>{blade.cond_diecut_no_ink}</div>
                </div>)}
              {(blade.cut_type === 'diecut' || blade.cut_type === 'both') && blade.cond_diecut_on_ink !== null && (
                <div style={{ padding: '6px 14px', background: 'rgba(249,115,22,0.1)', borderRadius: '8px', border: '1px solid rgba(249,115,22,0.2)' }}>
                  <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Die Cut (UV Ink)</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#f97316' }}>{blade.cond_diecut_on_ink}</div>
                </div>)}
              <div style={{ padding: '6px 14px', background: 'rgba(168,85,247,0.1)', borderRadius: '8px', border: '1px solid rgba(168,85,247,0.2)' }}>
                <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Thickness</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#a855f7' }}>{blade.total_thickness_mil != null ? `${blade.total_thickness_mil} mil` : '???'}</div>
              </div>
            </div>)}

          {/* Stats — UCJV */}
          {blade.cutter === 'ucjv' && (
            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
              {blade.cond_kisscut_no_ink != null && (
                <div style={{ padding: '6px 14px', background: 'rgba(34,211,238,0.1)', borderRadius: '8px', border: '1px solid rgba(34,211,238,0.2)' }}>
                  <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Kiss Cut</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#22d3ee' }}>{blade.cond_kisscut_no_ink}</div>
                </div>)}
              {blade.cond_diecut_no_ink != null && (
                <div style={{ padding: '6px 14px', background: 'rgba(236,72,153,0.1)', borderRadius: '8px', border: '1px solid rgba(236,72,153,0.2)' }}>
                  <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Die Cut</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#ec4899' }}>{blade.cond_diecut_no_ink}</div>
                </div>)}
              <div style={{ padding: '6px 14px', background: 'rgba(168,85,247,0.1)', borderRadius: '8px', border: '1px solid rgba(168,85,247,0.2)' }}>
                <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Thickness</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#a855f7' }}>{blade.total_thickness_mil != null ? `${blade.total_thickness_mil} mil` : '???'}</div>
              </div>
            </div>)}

          {/* Dialed For (primary) */}
          {(primaryMedia || primaryLam) && (
            <div style={{ marginBottom: '10px', padding: '8px 12px', background: 'rgba(234,179,8,0.06)', borderRadius: '8px', border: '1px solid rgba(234,179,8,0.15)' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#eab308', textTransform: 'uppercase', marginBottom: '4px' }}>★ Dialed For</div>
              <div style={{ fontSize: '14px', color: textPrimary, fontWeight: 500 }}>
                {primaryMedia && <span>{primaryMedia.name}</span>}
                {primaryMedia && primaryLam && <span style={{ color: textMuted }}> + </span>}
                {primaryLam && <span>{primaryLam.name}</span>}
              </div>
            </div>
          )}

          {/* Also Works With */}
          {(otherMedia.length > 0 || otherLam.length > 0) && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Also Works With</div>
              <div style={{ display: 'flex', gap: '16px' }}>
                {otherMedia.length > 0 && (
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#22d3ee', textTransform: 'uppercase', marginBottom: '3px' }}>Media</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>{otherMedia.join(', ')}</div>
                  </div>
                )}
                {otherMedia.length > 0 && otherLam.length > 0 && (
                  <div style={{ width: '1px', background: 'rgba(148,163,184,0.1)', flexShrink: 0 }} />
                )}
                {otherLam.length > 0 && (
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#ec4899', textTransform: 'uppercase', marginBottom: '3px' }}>Laminate</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>{otherLam.join(', ')}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {blade.notes && (
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px', fontStyle: 'italic', borderTop: '1px solid rgba(148,163,184,0.1)', paddingTop: '8px' }}>{blade.notes}</div>
          )}
        </div>
      </div>
    </div>
  )
}
