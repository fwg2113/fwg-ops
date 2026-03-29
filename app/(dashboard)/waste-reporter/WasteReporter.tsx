'use client'

import { useState, useMemo } from 'react'
import ModalBackdrop from '../../components/ModalBackdrop'

interface WasteMaterial {
  id: string
  name: string
  tab_category: string
  material_subtype: string | null
  cost_per_roll: number | null
  width_inches: number | null
  length_yards: number | null
  waste_unit: string | null
}

interface WasteReport {
  id: string
  category: string
  description: string | null
  team_members: string[]
  material_id: string | null
  correct_material_id: string | null
  is_still_usable: boolean
  estimated_linft: number | null
  estimated_cost: number | null
  cost_difference: number | null
  document_reference: string | null
  laminate_id: string | null
  laminate_linft: number | null
  transfer_tape_id: string | null
  transfer_tape_linft: number | null
  substrate_id: string | null
  substrate_waste_qty: number | null
  substrate_waste_width: number | null
  substrate_waste_height: number | null
  substrate_cost: number | null
  lesson_learned: string | null
  created_at: string
}

interface TeamMember {
  id: string
  name: string
}

const CATEGORIES = [
  { value: 'reprint_install', label: 'Reprint Needed (Install Error)', icon: '🔄', color: '#ef4444' },
  { value: 'wrong_material_unusable', label: 'Wrong Material Used (Scrapped)', icon: '❌', color: '#dc2626' },
  { value: 'wrong_material_usable', label: 'Wrong Material Used (Still Usable)', icon: '⚠️', color: '#f97316' },
  { value: 'cutter_error', label: 'Cutter / Plotter Error', icon: '✂️', color: '#a855f7' },
  { value: 'print_defect', label: 'Print Defect (Banding/Color)', icon: '🖨️', color: '#3b82f6' },
  { value: 'material_damaged', label: 'Material Damaged (Tear/Crease)', icon: '💔', color: '#ec4899' },
  { value: 'other', label: 'Other', icon: '📝', color: '#6b7280' },
]

const QUOTES = [
  { text: 'I have not failed. I\'ve just found 10,000 ways that won\'t work.', author: 'Thomas Edison' },
  { text: 'Failure is simply the opportunity to begin again, this time more intelligently.', author: 'Henry Ford' },
  { text: 'Only those who dare to fail greatly can ever achieve greatly.', author: 'Robert F. Kennedy' },
  { text: 'Anyone who has never made a mistake has never tried anything new.', author: 'Albert Einstein' },
  { text: 'You build on failure. You use it as a stepping stone.', author: 'Johnny Cash' },
  { text: 'Our greatest weakness lies in giving up.', author: 'Thomas Edison' },
  { text: 'The only real mistake is the one from which we learn nothing.', author: 'Henry Ford' },
  { text: 'Failure is success in progress.', author: 'Albert Einstein' },
  { text: 'It\'s fine to celebrate success, but it is more important to heed the lessons of failure.', author: 'Bill Gates' },
  { text: 'I can accept failure, everyone fails at something. But I can\'t accept not trying.', author: 'Michael Jordan' },
  { text: 'I failed my way to success.', author: 'Thomas Edison' },
  { text: 'You have to be able to accept failure to get better.', author: 'LeBron James' },
  { text: 'Don\'t worry about failure; you only have to be right once.', author: 'Drew Houston' },
]

const cardBg = '#1d1d1d'
const borderColor = 'rgba(148, 163, 184, 0.1)'
const textPrimary = '#f1f5f9'
const textSecondary = '#94a3b8'
const textMuted = '#64748b'
const accentGradient = 'linear-gradient(90deg, #22d3ee, #a855f7, #ec4899)'

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.3px' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', background: '#111111', border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }

function calcCostPerLinFt(mat: WasteMaterial): number | null {
  if (!mat.cost_per_roll || !mat.length_yards) return null
  const lengthFt = mat.length_yards * 3
  return lengthFt > 0 ? mat.cost_per_roll / lengthFt : null
}

function getRandomQuote() {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)]
}

export default function WasteReporter({
  materials,
  initialReports,
  teamMembers,
}: {
  materials: WasteMaterial[]
  initialReports: WasteReport[]
  teamMembers: TeamMember[]
}) {
  const [reports, setReports] = useState<WasteReport[]>(initialReports)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [successQuote, setSuccessQuote] = useState(QUOTES[0])

  // Form state
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [materialId, setMaterialId] = useState('')
  const [correctMaterialId, setCorrectMaterialId] = useState('')
  const [isStillUsable, setIsStillUsable] = useState(false)
  const [estimatedLinft, setEstimatedLinft] = useState('')
  const [documentRef, setDocumentRef] = useState('')
  const [lessonLearned, setLessonLearned] = useState('')
  // Laminate/transfer tape/substrate state
  const [laminateId, setLaminateId] = useState('')
  const [laminateLinft, setLaminateLinft] = useState('')
  const [transferTapeId, setTransferTapeId] = useState('')
  const [transferTapeLinft, setTransferTapeLinft] = useState('')
  const [substrateId, setSubstrateId] = useState('')
  const [substrateQty, setSubstrateQty] = useState('')
  const [substrateWidth, setSubstrateWidth] = useState('')
  const [substrateHeight, setSubstrateHeight] = useState('')

  const isWrongMaterial = category === 'wrong_material_unusable' || category === 'wrong_material_usable'

  const mediaMats = useMemo(() => materials.filter((m) => m.tab_category === 'media'), [materials])
  const lamMats = useMemo(() => materials.filter((m) => m.tab_category === 'laminate'), [materials])
  const tapeMats = useMemo(() => materials.filter((m) => m.tab_category === 'transfer_tape'), [materials])
  const substrateMats = useMemo(() => materials.filter((m) => m.tab_category === 'substrate'), [materials])

  const selectedSubstrate = useMemo(() => substrateId ? materials.find((m) => m.id === substrateId) : null, [substrateId, materials])
  const substrateWasteUnit = selectedSubstrate?.waste_unit || 'qty'

  // Cost calculations
  const estimatedCost = useMemo(() => {
    if (!materialId || !estimatedLinft) return null
    const mat = materials.find((m) => m.id === materialId)
    if (!mat) return null
    const cplf = calcCostPerLinFt(mat)
    return cplf ? cplf * Number(estimatedLinft) : null
  }, [materialId, estimatedLinft, materials])

  const costDifference = useMemo(() => {
    if (!isWrongMaterial || !materialId || !correctMaterialId || !estimatedLinft) return null
    const usedMat = materials.find((m) => m.id === materialId)
    const correctMat = materials.find((m) => m.id === correctMaterialId)
    if (!usedMat || !correctMat) return null
    const usedCost = calcCostPerLinFt(usedMat)
    const correctCost = calcCostPerLinFt(correctMat)
    if (!usedCost || !correctCost) return null
    return (usedCost - correctCost) * Number(estimatedLinft)
  }, [isWrongMaterial, materialId, correctMaterialId, estimatedLinft, materials])

  const substrateCost = useMemo(() => {
    if (!substrateId) return null
    const mat = materials.find((m) => m.id === substrateId)
    if (!mat || !mat.cost_per_roll) return null
    if (substrateWasteUnit === 'qty' && substrateQty) return mat.cost_per_roll * Number(substrateQty)
    if (substrateWasteUnit === 'linear_ft' && substrateQty) {
      const cplf = calcCostPerLinFt(mat)
      return cplf ? cplf * Number(substrateQty) : null
    }
    if (substrateWasteUnit === 'width_height' && substrateWidth && substrateHeight) {
      const sheetSqft = (mat.width_inches || 48) / 12 * 8 // assume 8ft length for sheets
      const wastedSqft = (Number(substrateWidth) / 12) * (Number(substrateHeight) / 12)
      const ratio = sheetSqft > 0 ? wastedSqft / sheetSqft : 0
      return mat.cost_per_roll * ratio
    }
    return null
  }, [substrateId, substrateQty, substrateWidth, substrateHeight, substrateWasteUnit, materials])

  // Stats
  const totalWasteCost = useMemo(() => {
    return reports.reduce((sum, r) => sum + (r.estimated_cost || 0), 0)
  }, [reports])

  const thisMonthReports = useMemo(() => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    return reports.filter((r) => new Date(r.created_at) >= monthStart)
  }, [reports])

  const resetForm = () => {
    setCategory('')
    setDescription('')
    setSelectedMembers([])
    setMaterialId('')
    setCorrectMaterialId('')
    setIsStillUsable(false)
    setEstimatedLinft('')
    setLaminateId('')
    setLaminateLinft('')
    setTransferTapeId('')
    setTransferTapeLinft('')
    setSubstrateId('')
    setSubstrateQty('')
    setSubstrateWidth('')
    setSubstrateHeight('')
    setLessonLearned('')
    setDocumentRef('')
  }

  const handleSubmit = async () => {
    if (!category) return
    setSaving(true)
    setError(null)
    try {
      const totalCost = (estimatedCost || 0) + (substrateCost || 0)
      const payload = {
        category,
        description: description || null,
        team_members: selectedMembers,
        material_id: materialId || null,
        correct_material_id: correctMaterialId || null,
        is_still_usable: isStillUsable,
        estimated_linft: estimatedLinft ? Number(estimatedLinft) : null,
        estimated_cost: totalCost || null,
        cost_difference: costDifference,
        document_reference: documentRef || null,
        laminate_id: laminateId || null,
        laminate_linft: laminateLinft ? Number(laminateLinft) : null,
        transfer_tape_id: transferTapeId || null,
        transfer_tape_linft: transferTapeLinft ? Number(transferTapeLinft) : null,
        substrate_id: substrateId || null,
        substrate_waste_qty: substrateQty ? Number(substrateQty) : null,
        substrate_waste_width: substrateWidth ? Number(substrateWidth) : null,
        substrate_waste_height: substrateHeight ? Number(substrateHeight) : null,
        substrate_cost: substrateCost,
        lesson_learned: lessonLearned || null,
      }
      const res = await fetch('/api/waste-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setReports((prev) => [data, ...prev])
      resetForm()
      setShowForm(false)
      setSuccessQuote(getRandomQuote())
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 6000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit')
    } finally {
      setSaving(false)
    }
  }

  const toggleMember = (name: string) => {
    setSelectedMembers((prev) => prev.includes(name) ? prev.filter((m) => m !== name) : [...prev, name])
  }

  const getCategoryInfo = (val: string) => CATEGORIES.find((c) => c.value === val)
  const getMaterialName = (id: string) => materials.find((m) => m.id === id)?.name || 'Unknown'

  return (
    <div style={{ padding: '24px', maxWidth: '900px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: textPrimary, margin: 0 }}>
          Waste{' '}
          <span style={{ background: accentGradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Reporter</span>
        </h1>
        <p style={{ color: textSecondary, margin: '4px 0 0', fontSize: '14px' }}>
          Track and learn from mistakes — every report helps the team improve
        </p>
      </div>

      {/* Success toast */}
      {showSuccess && (
        <div style={{
          padding: '16px 20px',
          background: 'rgba(34,197,94,0.1)',
          border: '1px solid rgba(34,197,94,0.25)',
          borderRadius: '12px',
          marginBottom: '20px',
          animation: 'fadeIn 0.3s ease',
        }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#22c55e', marginBottom: '8px' }}>
            Report submitted. Thank you for being honest — that takes courage.
          </div>
          <div style={{ fontSize: '13px', color: textSecondary, fontStyle: 'italic' }}>
            &ldquo;{successQuote.text}&rdquo;
          </div>
          <div style={{ fontSize: '12px', color: textMuted, marginTop: '4px' }}>— {successQuote.author}</div>
        </div>
      )}

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ padding: '12px 20px', background: cardBg, borderRadius: '10px', border: `1px solid ${borderColor}` }}>
          <div style={{ fontSize: '10px', color: textMuted, textTransform: 'uppercase', fontWeight: 600 }}>This Month</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: textPrimary }}>{thisMonthReports.length}</div>
        </div>
        <div style={{ padding: '12px 20px', background: cardBg, borderRadius: '10px', border: `1px solid ${borderColor}` }}>
          <div style={{ fontSize: '10px', color: textMuted, textTransform: 'uppercase', fontWeight: 600 }}>Est. Cost (All Time)</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#ef4444' }}>${totalWasteCost.toFixed(2)}</div>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={() => { setShowForm(true); resetForm() }} style={{ padding: '12px 24px', background: accentGradient, border: 'none', borderRadius: '10px', color: '#fff', fontWeight: 600, fontSize: '15px', cursor: 'pointer', alignSelf: 'center' }}>
          + Report Waste
        </button>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#ef4444', fontSize: '13px', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {/* Report Form Modal */}
      {showForm && (
        <ModalBackdrop onClose={() => setShowForm(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#1a1a1a', borderRadius: '16px', border: `1px solid ${borderColor}`, width: '600px', maxHeight: '85vh', overflow: 'auto', padding: '28px' }}>
            {/* Encouragement header */}
            <div style={{ padding: '14px 18px', background: 'rgba(34,211,238,0.05)', borderRadius: '10px', border: '1px solid rgba(34,211,238,0.1)', marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', color: textSecondary }}>
                We&apos;re all human — mistakes happen. Reporting them honestly helps the whole team learn and get better. No judgment here.
              </div>
            </div>

            <h2 style={{ color: textPrimary, fontSize: '20px', fontWeight: 700, margin: '0 0 20px' }}>Report Waste</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Category */}
              <div>
                <label style={labelStyle}>What happened?</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {CATEGORIES.map((cat) => (
                    <button key={cat.value} onClick={() => { setCategory(cat.value); setIsStillUsable(cat.value === 'wrong_material_usable') }}
                      style={{
                        padding: '12px 14px', borderRadius: '10px', border: `1px solid ${category === cat.value ? `${cat.color}60` : borderColor}`,
                        background: category === cat.value ? `${cat.color}15` : 'transparent',
                        color: category === cat.value ? cat.color : textSecondary,
                        fontSize: '13px', fontWeight: 600, cursor: 'pointer', textAlign: 'left',
                        display: 'flex', alignItems: 'center', gap: '8px',
                      }}>
                      <span style={{ fontSize: '18px' }}>{cat.icon}</span>
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Team Members */}
              {category && (
                <div>
                  <label style={labelStyle}>Who was involved?</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {teamMembers.map((tm) => {
                      const selected = selectedMembers.includes(tm.name)
                      return (
                        <button key={tm.id} onClick={() => toggleMember(tm.name)}
                          style={{
                            padding: '6px 14px', borderRadius: '20px',
                            border: `1px solid ${selected ? 'rgba(34,211,238,0.4)' : borderColor}`,
                            background: selected ? 'rgba(34,211,238,0.1)' : 'transparent',
                            color: selected ? '#22d3ee' : textMuted, fontSize: '13px', cursor: 'pointer', fontWeight: selected ? 600 : 400,
                          }}>
                          {tm.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Material used */}
              {category && (
                <div>
                  <label style={labelStyle}>What material was {isWrongMaterial ? 'used (wrong one)' : 'wasted'}?</label>
                  <select style={inputStyle} value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
                    <option value="">Select material...</option>
                    {materials.filter((m) => m.tab_category === 'media').map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              )}

              {/* Correct material (wrong material only) */}
              {isWrongMaterial && (
                <div>
                  <label style={labelStyle}>What should have been used?</label>
                  <select style={inputStyle} value={correctMaterialId} onChange={(e) => setCorrectMaterialId(e.target.value)}>
                    <option value="">Select correct material...</option>
                    {materials.filter((m) => m.tab_category === 'media').map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              )}

              {/* Estimated sqft */}
              {category && materialId && (
                <div>
                  <label style={labelStyle}>Estimated linear ft wasted</label>
                  <input style={inputStyle} type="number" step="0.1" value={estimatedLinft} onChange={(e) => setEstimatedLinft(e.target.value)} placeholder="e.g., 8" />
                </div>
              )}

              {/* Cost display */}
              {estimatedCost !== null && (
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ padding: '10px 16px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <div style={{ fontSize: '10px', color: textMuted, textTransform: 'uppercase', fontWeight: 600 }}>Est. Material Cost</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#ef4444' }}>${estimatedCost.toFixed(2)}</div>
                  </div>
                  {costDifference !== null && (
                    <div style={{ padding: '10px 16px', background: 'rgba(249,115,22,0.1)', borderRadius: '8px', border: '1px solid rgba(249,115,22,0.2)' }}>
                      <div style={{ fontSize: '10px', color: textMuted, textTransform: 'uppercase', fontWeight: 600 }}>Cost Difference (Wrong vs Correct)</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: '#f97316' }}>{costDifference >= 0 ? '+' : ''}${costDifference.toFixed(2)}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Laminate */}
              {category && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={labelStyle}>Laminate wasted? (optional)</label>
                    <select style={inputStyle} value={laminateId} onChange={(e) => setLaminateId(e.target.value)}>
                      <option value="">None</option>
                      {lamMats.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  {laminateId && (
                    <div>
                      <label style={labelStyle}>Laminate linear ft</label>
                      <input style={inputStyle} type="number" step="0.1" value={laminateLinft} onChange={(e) => setLaminateLinft(e.target.value)} placeholder="e.g., 6" />
                    </div>
                  )}
                </div>
              )}

              {/* Transfer Tape */}
              {category && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={labelStyle}>Transfer tape wasted? (optional)</label>
                    <select style={inputStyle} value={transferTapeId} onChange={(e) => setTransferTapeId(e.target.value)}>
                      <option value="">None</option>
                      {tapeMats.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  {transferTapeId && (
                    <div>
                      <label style={labelStyle}>Transfer tape linear ft</label>
                      <input style={inputStyle} type="number" step="0.1" value={transferTapeLinft} onChange={(e) => setTransferTapeLinft(e.target.value)} placeholder="e.g., 6" />
                    </div>
                  )}
                </div>
              )}

              {/* Substrate */}
              {category && (
                <div>
                  <label style={labelStyle}>Substrate wasted? (optional)</label>
                  <select style={inputStyle} value={substrateId} onChange={(e) => { setSubstrateId(e.target.value); setSubstrateQty(''); setSubstrateWidth(''); setSubstrateHeight('') }}>
                    <option value="">None</option>
                    {substrateMats.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  {substrateId && (
                    <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                      {substrateWasteUnit === 'qty' && (
                        <div style={{ flex: 1 }}>
                          <label style={labelStyle}>Qty wasted</label>
                          <input style={inputStyle} type="number" value={substrateQty} onChange={(e) => setSubstrateQty(e.target.value)} placeholder="e.g., 2" />
                        </div>
                      )}
                      {substrateWasteUnit === 'linear_ft' && (
                        <div style={{ flex: 1 }}>
                          <label style={labelStyle}>Linear ft wasted</label>
                          <input style={inputStyle} type="number" step="0.1" value={substrateQty} onChange={(e) => setSubstrateQty(e.target.value)} placeholder="e.g., 4" />
                        </div>
                      )}
                      {substrateWasteUnit === 'width_height' && (
                        <>
                          <div style={{ flex: 1 }}>
                            <label style={labelStyle}>Width (inches)</label>
                            <input style={inputStyle} type="number" value={substrateWidth} onChange={(e) => setSubstrateWidth(e.target.value)} placeholder="e.g., 24" />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={labelStyle}>Height (inches)</label>
                            <input style={inputStyle} type="number" value={substrateHeight} onChange={(e) => setSubstrateHeight(e.target.value)} placeholder="e.g., 36" />
                          </div>
                        </>
                      )}
                      {substrateCost != null && (
                        <div style={{ padding: '8px 14px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)', alignSelf: 'flex-end' }}>
                          <div style={{ fontSize: '10px', color: textMuted, textTransform: 'uppercase', fontWeight: 600 }}>Substrate Cost</div>
                          <div style={{ fontSize: '16px', fontWeight: 700, color: '#ef4444' }}>${substrateCost.toFixed(2)}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Document reference */}
              {category && (
                <div>
                  <label style={labelStyle}>Job / Document Reference (optional)</label>
                  <input style={inputStyle} value={documentRef} onChange={(e) => setDocumentRef(e.target.value)} placeholder="e.g., Quote #1234 or customer name" />
                </div>
              )}

              {/* Description */}
              {category && (
                <div>
                  <label style={labelStyle}>What happened? (optional)</label>
                  <textarea style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of what went wrong..." />
                </div>
              )}

              {/* Lesson learned */}
              {category && (
                <div>
                  <label style={labelStyle}>Do we know how to prevent this going forward?</label>
                  <textarea style={{ ...inputStyle, minHeight: '60px', resize: 'vertical', borderColor: 'rgba(34,197,94,0.2)' }} value={lessonLearned} onChange={(e) => setLessonLearned(e.target.value)} placeholder="What did we learn? How do we avoid this next time?" />
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${borderColor}`, borderRadius: '8px', color: textSecondary, cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
              <button onClick={handleSubmit} disabled={saving || !category}
                style={{ padding: '10px 24px', background: saving || !category ? textMuted : accentGradient, border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: saving || !category ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
                {saving ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}

      {/* Report History */}
      <div>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: textPrimary, margin: '0 0 14px' }}>Recent Reports</h2>
        {reports.length === 0 ? (
          <div style={{ padding: '40px', background: cardBg, borderRadius: '12px', border: `1px solid ${borderColor}`, textAlign: 'center' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>🎉</div>
            <p style={{ color: textMuted, fontSize: '14px', margin: 0 }}>No waste reports yet — keep up the great work!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {reports.map((report) => {
              const catInfo = getCategoryInfo(report.category)
              return (
                <div key={report.id} style={{ padding: '14px 18px', background: cardBg, borderRadius: '10px', border: `1px solid ${borderColor}`, borderLeft: `3px solid ${catInfo?.color || textMuted}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '16px' }}>{catInfo?.icon}</span>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: textPrimary }}>{catInfo?.label}</span>
                    </div>
                    <span style={{ fontSize: '12px', color: textMuted }}>
                      {new Date(report.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '13px', color: textSecondary }}>
                    {report.team_members.length > 0 && (
                      <span>{report.team_members.join(', ')}</span>
                    )}
                    {report.material_id && (
                      <span>Material: {getMaterialName(report.material_id)}</span>
                    )}
                    {report.correct_material_id && (
                      <span>Should have been: {getMaterialName(report.correct_material_id)}</span>
                    )}
                    {report.estimated_cost != null && (
                      <span style={{ color: '#ef4444', fontWeight: 600 }}>${report.estimated_cost.toFixed(2)}</span>
                    )}
                    {report.cost_difference != null && (
                      <span style={{ color: '#f97316' }}>Diff: {report.cost_difference >= 0 ? '+' : ''}${report.cost_difference.toFixed(2)}</span>
                    )}
                    {report.is_still_usable && (
                      <span style={{ color: '#22c55e' }}>Still usable</span>
                    )}
                  </div>
                  {report.description && (
                    <div style={{ fontSize: '12px', color: textMuted, marginTop: '6px', fontStyle: 'italic' }}>{report.description}</div>
                  )}
                  {report.document_reference && (
                    <div style={{ fontSize: '12px', color: textMuted, marginTop: '4px' }}>Ref: {report.document_reference}</div>
                  )}
                  {report.lesson_learned && (
                    <div style={{ fontSize: '12px', color: '#22c55e', marginTop: '6px', padding: '6px 10px', background: 'rgba(34,197,94,0.06)', borderRadius: '6px', border: '1px solid rgba(34,197,94,0.12)' }}>
                      <span style={{ fontWeight: 600 }}>Lesson:</span> {report.lesson_learned}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
