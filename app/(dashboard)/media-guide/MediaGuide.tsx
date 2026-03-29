'use client'

import { useState, useMemo } from 'react'

interface Material {
  id: string
  name: string
  material_key: string | null
  brand: string | null
  tab_category: string
  material_subtype: string | null
  finish: string | null
  width_inches: number | null
  length_yards: number | null
  thickness_mil: number | null
  cost_per_roll: number | null
  relevancy: string
  use_case_categories: string[]
  use_case_line_types: string[]
  printer_compatibility: string[]
  laminate_pairing_ids: string[]
  notes: string | null
  active: boolean
  adhesive_color: string | null
  backing_type: string | null
  backing_brand_text: string | null
  finish_description: string | null
  media_face_color: string | null
  id_notes: string | null
  is_colored_vinyl: boolean
}

interface Category {
  category_key: string
  label: string
}

interface Printer {
  id: string
  name: string
  brand: string
  model: string
  ink_method: string
  notes: string | null
}

// Style constants
const cardBg = '#1d1d1d'
const borderColor = 'rgba(148, 163, 184, 0.1)'
const textPrimary = '#f1f5f9'
const textSecondary = '#94a3b8'
const textMuted = '#64748b'
const accentGradient = 'linear-gradient(90deg, #22d3ee, #a855f7, #ec4899)'

const PAGE_TABS = [
  { key: 'guide', label: 'Guided Selector' },
  { key: 'common', label: 'Most Common' },
  { key: 'identify', label: 'Identify' },
] as const

type PageTabKey = typeof PAGE_TABS[number]['key']

function fmt(val: number | null, decimals = 2): string {
  if (val === null || val === undefined) return '—'
  return `$${val.toFixed(decimals)}`
}

function calcCostPerSqFt(cost: number | null, widthIn: number | null, lengthYd: number | null): number | null {
  if (!cost || !widthIn || !lengthYd) return null
  const widthFt = widthIn / 12
  const lengthFt = lengthYd * 3
  const sqft = widthFt * lengthFt
  return sqft > 0 ? cost / sqft : null
}

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
  notes: string | null
  sort_order: number
  active: boolean
}

export default function MediaGuide({
  materials,
  categories,
  printers,
  blades,
}: {
  materials: Material[]
  categories: Category[]
  printers: Printer[]
  blades: Blade[]
}) {
  const [pageTab, setPageTab] = useState<PageTabKey>('guide')

  // Guided selector state
  const [guideStep, setGuideStep] = useState(1)
  const [guideUseCase, setGuideUseCase] = useState('')
  const [guideFinish, setGuideFinish] = useState('')
  const [guideCutStyle, setGuideCutStyle] = useState('')

  // Derived data
  const media = useMemo(() => materials.filter((m) => m.tab_category === 'media'), [materials])
  const laminates = useMemo(() => materials.filter((m) => m.tab_category === 'laminate'), [materials])
  const transferTapes = useMemo(() => materials.filter((m) => m.tab_category === 'transfer_tape'), [materials])

  // Filter categories to only those that have at least one media assigned
  const activeCategories = useMemo(() => {
    return categories.filter((cat) =>
      media.some((m) => (m.use_case_categories || []).includes(cat.category_key))
    )
  }, [categories, media])

  // Guide recommendation engine
  const guideResult = useMemo(() => {
    if (!guideUseCase) return null

    // 1. Find best media: matches use case, prefer 'everyday' relevancy
    const candidates = media
      .filter((m) => (m.use_case_categories || []).includes(guideUseCase))
      .sort((a, b) => {
        const order = { everyday: 0, common: 1, rare: 2 } as Record<string, number>
        return (order[a.relevancy] ?? 1) - (order[b.relevancy] ?? 1)
      })
    const recMedia = candidates[0] || null
    if (!recMedia) return null

    // 2. Find laminate: from media's pairings, filtered by finish if selected
    const pairingIds = recMedia.laminate_pairing_ids || []
    let recLaminates = pairingIds.length > 0
      ? laminates.filter((l) => pairingIds.includes(l.id))
      : laminates.filter((l) => (l.use_case_categories || []).includes(guideUseCase))
    if (guideFinish) {
      const finishFiltered = recLaminates.filter((l) => l.finish?.toUpperCase() === guideFinish.toUpperCase())
      if (finishFiltered.length > 0) recLaminates = finishFiltered
    }
    const recLaminate = recLaminates[0] || null

    // 3. Printer: from media compatibility
    const compat = recMedia.printer_compatibility || []
    const recPrinter = compat.length > 0
      ? printers.find((p) => compat.some((c) => p.model.toLowerCase().includes(c.toLowerCase()))) || printers[0]
      : printers[0]

    // 4. Transfer tape: match subtype
    const subtype = recMedia.material_subtype?.toUpperCase()
    const recTapes = subtype === 'CAST'
      ? transferTapes.filter((t) => t.material_subtype?.toUpperCase() === 'CAST')
      : subtype === 'CALENDARED'
      ? transferTapes.filter((t) => t.material_subtype?.toUpperCase() === 'CALENDARED')
      : transferTapes

    // 5. Blade: find closest match by thickness
    const totalThickness = (recMedia.thickness_mil || 0) + (recLaminate?.thickness_mil || 0)
    const cutType = guideCutStyle || 'kisscut'
    const matchingBlades = blades
      .filter((b) => !b.color || b.color !== 'blank')
      .filter((b) => !guideCutStyle || b.cut_type === guideCutStyle || b.cut_type === 'both')
      .map((b) => ({ blade: b, diff: Math.abs((b.total_thickness_mil || 0) - totalThickness) }))
      .sort((a, b) => a.diff - b.diff)
    const recBlade = matchingBlades[0]?.diff <= 1 ? matchingBlades[0].blade : null
    const blankBlade = blades.find((b) => b.color === 'blank')

    // Get the right condition number
    const isUcjvPrinter = recPrinter?.model.toLowerCase().includes('ucjv')
    let condNumber: number | null = null
    let condLabel = ''
    const blade = recBlade || blankBlade
    if (blade) {
      if (cutType === 'diecut') {
        condNumber = isUcjvPrinter ? (blade.cond_diecut_on_ink ?? blade.cond_diecut_no_ink) : blade.cond_diecut_no_ink
        condLabel = isUcjvPrinter ? 'Die Cut (On UV Ink)' : 'Die Cut'
      } else {
        condNumber = isUcjvPrinter ? (blade.condition_number_on_ink ?? blade.condition_number) : blade.condition_number
        condLabel = isUcjvPrinter ? 'Kiss Cut (On UV Ink)' : 'Kiss Cut'
      }
    }

    // Available finishes for this media's laminates
    const availFinishes = new Set<string>()
    const allLams = pairingIds.length > 0
      ? laminates.filter((l) => pairingIds.includes(l.id))
      : laminates.filter((l) => (l.use_case_categories || []).includes(guideUseCase))
    allLams.forEach((l) => { if (l.finish) availFinishes.add(l.finish) })

    return {
      media: recMedia,
      laminate: recLaminate,
      printer: recPrinter || null,
      transferTapes: recTapes,
      blade: recBlade,
      blankBlade: !recBlade ? blankBlade : null,
      totalThickness,
      condNumber,
      condLabel,
      availableFinishes: Array.from(availFinishes),
      allMedia: candidates,
    }
  }, [guideUseCase, guideFinish, guideCutStyle, media, laminates, transferTapes, printers, blades])

  const resetGuide = () => {
    setGuideStep(1)
    setGuideUseCase('')
    setGuideFinish('')
    setGuideCutStyle('')
  }

  // Most Common setups: materials marked 'everyday' with use cases
  const everydaySetups = useMemo(() => {
    const setups: { media: Material; laminates: Material[]; transferTapes: Material[]; useCases: string[] }[] = []
    const everydayMedia = media.filter((m) => m.relevancy === 'everyday' && (m.use_case_categories || []).length > 0)

    everydayMedia.forEach((m) => {
      const pairingIds = m.laminate_pairing_ids || []
      const pairedLams = pairingIds.length > 0 ? laminates.filter((l) => pairingIds.includes(l.id)) : []
      const subtype = m.material_subtype?.toUpperCase()
      const matchedTapes = subtype === 'CAST'
        ? transferTapes.filter((t) => t.material_subtype?.toUpperCase() === 'CAST')
        : subtype === 'CALENDARED'
        ? transferTapes.filter((t) => t.material_subtype?.toUpperCase() === 'CALENDARED')
        : []

      setups.push({
        media: m,
        laminates: pairedLams,
        transferTapes: matchedTapes,
        useCases: m.use_case_categories || [],
      })
    })
    return setups
  }, [media, laminates, transferTapes])

  const getCategoryLabel = (key: string) => categories.find((c) => c.category_key === key)?.label || key

  return (
    <div style={{ padding: '24px', maxWidth: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: textPrimary, margin: 0 }}>
          Media{' '}
          <span style={{ background: accentGradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Guide
          </span>
        </h1>
        <p style={{ color: textSecondary, margin: '4px 0 0', fontSize: '14px' }}>
          Find the right media, laminate, transfer tape, and printer for the job
        </p>
      </div>

      {/* Page tabs */}
      <div style={{
        display: 'flex',
        gap: '4px',
        marginBottom: '24px',
        background: '#111111',
        borderRadius: '10px',
        padding: '4px',
        border: `1px solid ${borderColor}`,
        maxWidth: '360px',
      }}>
        {PAGE_TABS.map((tab) => {
          const isActive = pageTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => { setPageTab(tab.key); resetGuide() }}
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

      {/* ==================== JOB SETUP GUIDE ==================== */}
      {pageTab === 'guide' && (
        <div style={{ maxWidth: '700px' }}>
          {/* Question: Job Type */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '15px', fontWeight: 700, color: textPrimary, marginBottom: '8px' }}>1. What type of job is this?</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px' }}>
              {activeCategories.map((cat) => (
                <button key={cat.category_key} onClick={() => { setGuideUseCase(cat.category_key); setGuideFinish(''); setGuideCutStyle('') }}
                  style={{ padding: '12px 16px', borderRadius: '10px', border: `1px solid ${guideUseCase === cat.category_key ? 'rgba(34,211,238,0.5)' : borderColor}`, background: guideUseCase === cat.category_key ? 'rgba(34,211,238,0.12)' : cardBg, color: guideUseCase === cat.category_key ? '#22d3ee' : textSecondary, fontSize: '14px', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Question: Finish */}
          {guideUseCase && guideResult && guideResult.availableFinishes.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '15px', fontWeight: 700, color: textPrimary, marginBottom: '8px' }}>2. What finish?</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button onClick={() => setGuideFinish('')}
                  style={{ padding: '10px 20px', borderRadius: '10px', border: `1px solid ${!guideFinish ? 'rgba(236,72,153,0.5)' : borderColor}`, background: !guideFinish ? 'rgba(236,72,153,0.12)' : cardBg, color: !guideFinish ? '#ec4899' : textSecondary, fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                  Any
                </button>
                {guideResult.availableFinishes.map((f) => (
                  <button key={f} onClick={() => setGuideFinish(f)}
                    style={{ padding: '10px 20px', borderRadius: '10px', border: `1px solid ${guideFinish === f ? 'rgba(236,72,153,0.5)' : borderColor}`, background: guideFinish === f ? 'rgba(236,72,153,0.12)' : cardBg, color: guideFinish === f ? '#ec4899' : textSecondary, fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Question: Cut Style */}
          {guideUseCase && (
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '15px', fontWeight: 700, color: textPrimary, marginBottom: '8px' }}>
                {guideResult && guideResult.availableFinishes.length > 0 ? '3' : '2'}. Will this be cut?
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[{ value: '', label: 'No / Not sure' }, { value: 'kisscut', label: 'Kiss Cut' }, { value: 'diecut', label: 'Die Cut' }].map((opt) => (
                  <button key={opt.value} onClick={() => setGuideCutStyle(opt.value)}
                    style={{ padding: '10px 20px', borderRadius: '10px', border: `1px solid ${guideCutStyle === opt.value ? 'rgba(168,85,247,0.5)' : borderColor}`, background: guideCutStyle === opt.value ? 'rgba(168,85,247,0.12)' : cardBg, color: guideCutStyle === opt.value ? '#a855f7' : textSecondary, fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ==================== RECOMMENDATION ==================== */}
          {guideUseCase && guideResult && guideResult.media && (
            <div style={{ borderTop: `1px solid ${borderColor}`, paddingTop: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: textPrimary, margin: 0 }}>Your Setup</h2>
                <button onClick={resetGuide} style={{ padding: '5px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', color: '#ef4444', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}>Start Over</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                {/* Media */}
                <div style={{ padding: '16px', background: cardBg, borderRadius: '12px', border: `1px solid ${borderColor}`, borderTop: '3px solid #22d3ee' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#22d3ee', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Print On</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: textPrimary }}>{guideResult.media.name}</div>
                  <div style={{ fontSize: '12px', color: textMuted, marginTop: '2px' }}>{guideResult.media.material_subtype} • {guideResult.media.thickness_mil} mil</div>
                </div>

                {/* Laminate */}
                <div style={{ padding: '16px', background: cardBg, borderRadius: '12px', border: `1px solid ${borderColor}`, borderTop: '3px solid #ec4899' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#ec4899', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Laminate With</div>
                  {guideResult.laminate ? (
                    <>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: textPrimary }}>{guideResult.laminate.name}</div>
                      <div style={{ fontSize: '12px', color: textMuted, marginTop: '2px' }}>{guideResult.laminate.finish} • {guideResult.laminate.thickness_mil} mil</div>
                    </>
                  ) : (
                    <div style={{ fontSize: '14px', color: textMuted }}>No laminate needed</div>
                  )}
                </div>

                {/* Printer */}
                <div style={{ padding: '16px', background: cardBg, borderRadius: '12px', border: `1px solid ${borderColor}`, borderTop: '3px solid #a855f7' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#a855f7', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Print With</div>
                  {guideResult.printer ? (
                    <>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: textPrimary }}>{guideResult.printer.brand} {guideResult.printer.name}</div>
                      <div style={{ fontSize: '12px', color: textMuted, marginTop: '2px' }}>{guideResult.printer.ink_method === 'on_top' ? 'UV cure — ink on top' : 'Eco-sol — ink embeds'}</div>
                    </>
                  ) : (
                    <div style={{ fontSize: '14px', color: textMuted }}>Any available printer</div>
                  )}
                </div>

                {/* Transfer Tape */}
                <div style={{ padding: '16px', background: cardBg, borderRadius: '12px', border: `1px solid ${borderColor}`, borderTop: '3px solid #eab308' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#eab308', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Transfer Tape</div>
                  {guideResult.transferTapes.length > 0 ? (
                    guideResult.transferTapes.map((t) => (
                      <div key={t.id} style={{ fontSize: '14px', color: textPrimary, marginBottom: '2px' }}>{t.name}</div>
                    ))
                  ) : (
                    <div style={{ fontSize: '14px', color: textMuted }}>No transfer tape needed</div>
                  )}
                </div>

                {/* Blade + Condition */}
                {guideCutStyle && (
                  <div style={{ gridColumn: '1 / -1', padding: '16px', background: cardBg, borderRadius: '12px', border: `1px solid ${borderColor}`, borderTop: '3px solid #22c55e' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Cutting</div>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {/* Thickness */}
                      <div style={{ padding: '8px 16px', background: 'rgba(168,85,247,0.1)', borderRadius: '8px', border: '1px solid rgba(168,85,247,0.2)' }}>
                        <div style={{ fontSize: '10px', color: textMuted, textTransform: 'uppercase', fontWeight: 600 }}>Dial For</div>
                        <div style={{ fontSize: '22px', fontWeight: 800, color: '#a855f7' }}>{guideResult.totalThickness.toFixed(1)} mil</div>
                      </div>

                      {/* Blade */}
                      {guideResult.blade ? (
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: textPrimary }}>
                            <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: guideResult.blade.color === 'holographic' ? 'linear-gradient(135deg, #22d3ee, #a855f7, #ec4899)' : BLADE_COLORS_MAP[guideResult.blade.color] || '#888', marginRight: '6px', verticalAlign: 'middle' }} />
                            {guideResult.blade.color.charAt(0).toUpperCase() + guideResult.blade.color.slice(1)} Blade
                          </div>
                          {guideResult.blade.label && <div style={{ fontSize: '12px', color: textMuted }}>{guideResult.blade.label}</div>}
                        </div>
                      ) : guideResult.blankBlade ? (
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: textMuted }}>Blank Blade</div>
                          <div style={{ fontSize: '12px', color: textMuted }}>Dial to {guideResult.totalThickness.toFixed(1)} mil for this job</div>
                        </div>
                      ) : (
                        <div style={{ fontSize: '14px', color: textMuted }}>No blade configured</div>
                      )}

                      {/* Condition # */}
                      {guideResult.condNumber != null && (
                        <div style={{ padding: '8px 16px', background: 'rgba(34,211,238,0.1)', borderRadius: '8px', border: '1px solid rgba(34,211,238,0.2)' }}>
                          <div style={{ fontSize: '10px', color: textMuted, textTransform: 'uppercase', fontWeight: 600 }}>{guideResult.condLabel}</div>
                          <div style={{ fontSize: '22px', fontWeight: 800, color: '#22d3ee' }}>{guideResult.condNumber}</div>
                        </div>
                      )}

                      {/* Cut Style */}
                      <div style={{ padding: '8px 16px', background: 'rgba(236,72,153,0.1)', borderRadius: '8px', border: '1px solid rgba(236,72,153,0.2)' }}>
                        <div style={{ fontSize: '10px', color: textMuted, textTransform: 'uppercase', fontWeight: 600 }}>Cut Style</div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#ec4899' }}>{guideCutStyle === 'kisscut' ? 'Kiss Cut' : 'Die Cut'}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {guideUseCase && guideResult && !guideResult.media && (
            <div style={{ padding: '30px', background: cardBg, borderRadius: '12px', border: `1px solid ${borderColor}`, textAlign: 'center' }}>
              <p style={{ color: textMuted, fontSize: '14px', margin: 0 }}>No materials are configured for this use case yet. Assign materials on the Materials List → Use Cases tab.</p>
            </div>
          )}

        </div>
      )}

      {/* ==================== MOST COMMON ==================== */}
      {pageTab === 'common' && (
        <div>
          <h2 style={{ color: textPrimary, fontSize: '18px', fontWeight: 600, margin: '0 0 16px' }}>
            Most Common Setups
          </h2>
          <p style={{ color: textMuted, fontSize: '13px', margin: '0 0 20px' }}>
            Quick reference for everyday materials and their recommended pairings
          </p>

          {everydaySetups.length === 0 ? (
            <div style={{ padding: '40px', background: cardBg, borderRadius: '12px', border: `1px solid ${borderColor}`, textAlign: 'center' }}>
              <p style={{ color: textMuted, fontSize: '14px', margin: 0 }}>
                No materials are marked as &quot;Everyday&quot; relevancy with use cases assigned yet.
                Update materials on the Materials List to see them here.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '16px' }}>
              {everydaySetups.map((setup) => {
                const costSqFt = calcCostPerSqFt(setup.media.cost_per_roll, setup.media.width_inches, setup.media.length_yards)
                return (
                  <div
                    key={setup.media.id}
                    style={{
                      background: cardBg,
                      borderRadius: '12px',
                      border: `1px solid ${borderColor}`,
                      overflow: 'hidden',
                    }}
                  >
                    {/* Header */}
                    <div style={{
                      padding: '16px 18px',
                      borderBottom: `1px solid ${borderColor}`,
                      background: 'rgba(34,211,238,0.03)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '16px', fontWeight: 600, color: textPrimary }}>{setup.media.name}</div>
                        <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                          Everyday
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                        {setup.useCases.map((uc) => (
                          <span key={uc} style={{ fontSize: '11px', color: '#22d3ee', background: 'rgba(34,211,238,0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                            {getCategoryLabel(uc)}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div style={{ padding: '14px 18px' }}>
                      {/* Media details */}
                      <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: textSecondary, marginBottom: '12px' }}>
                        <span>{setup.media.material_subtype}</span>
                        <span>{setup.media.thickness_mil} mil</span>
                        {setup.media.width_inches && <span>{setup.media.width_inches}&quot;</span>}
                        {costSqFt !== null && <span style={{ color: '#a855f7' }}>Sell: {fmt(costSqFt !== null ? costSqFt * 5 : null)}/sqft</span>}
                      </div>

                      {/* Paired Laminates */}
                      {setup.laminates.length > 0 && (
                        <div style={{ marginBottom: '10px' }}>
                          <div style={{ fontSize: '11px', fontWeight: 600, color: '#ec4899', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                            Laminate
                          </div>
                          {setup.laminates.map((l) => (
                            <div key={l.id} style={{ fontSize: '13px', color: textPrimary, marginBottom: '2px' }}>
                              {l.name} <span style={{ color: textMuted, fontSize: '12px' }}>{l.finish} • {l.thickness_mil} mil</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Transfer Tape */}
                      {setup.transferTapes.length > 0 && (
                        <div style={{ marginBottom: '10px' }}>
                          <div style={{ fontSize: '11px', fontWeight: 600, color: '#eab308', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                            Transfer Tape
                          </div>
                          {setup.transferTapes.map((t) => (
                            <div key={t.id} style={{ fontSize: '13px', color: textPrimary, marginBottom: '2px' }}>
                              {t.name} <span style={{ color: textMuted, fontSize: '12px' }}>{t.material_subtype}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Printer */}
                      {(setup.media.printer_compatibility || []).length > 0 && (
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: 600, color: '#a855f7', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                            Printer
                          </div>
                          <div style={{ fontSize: '13px', color: textPrimary }}>
                            {(setup.media.printer_compatibility || []).map((p) => p === 'ucjv300' ? 'UCJV300-160' : p === 'jv330' ? 'JV330-160' : p).join(', ')}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
      {/* ==================== IDENTIFY TAB ==================== */}
      {pageTab === 'identify' && (
        <IdentifyTab media={media} categories={categories} />
      )}
    </div>
  )
}

function IdentifyTab({ media, categories }: { media: Material[]; categories: Category[] }) {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredMedia = useMemo(() => {
    if (!searchTerm) return media
    const lower = searchTerm.toLowerCase()
    return media.filter((m) => m.name.toLowerCase().includes(lower) || m.brand?.toLowerCase().includes(lower))
  }, [media, searchTerm])

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const adhColors: Record<string, string> = { white: '#f5f5f5', clear: '#e8e8e8', light_gray: '#b0b0b0', medium_gray: '#808080', dark_gray: '#414042' }
    const adhLabels: Record<string, string> = { white: 'White', clear: 'Clear', light_gray: 'Light Gray', medium_gray: 'Medium Gray', dark_gray: 'Dark Gray' }
    const rollsHtml = filteredMedia.map((mat) => {
      const faceColor = mat.media_face_color || '#ffffff'
      const adhesive = mat.adhesive_color || ''
      const adhesiveHex = adhColors[adhesive] || '#c7c8ca'
      const adhesiveLabel = adhLabels[adhesive] || adhesive || '—'
      const backingType = mat.backing_type || 'blank'
      const brandText = mat.backing_brand_text || ''
      const finishDesc = mat.finish_description || ''
      const idNotes = mat.id_notes || ''

      return `
        <div style="break-inside: avoid; padding: 16px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 12px;">
          <div style="display: flex; gap: 16px; align-items: center;">
            <svg viewBox="0 0 414.46 400.23" style="width: 160px; height: auto; flex-shrink: 0;">
              <path fill="${faceColor}" d="M54.28,199.9v-20.18h0s0,0,0,0l312.68-34.59,47.5-5.25V0H27.14c14.98,0,27.12,89.48,27.14,199.9Z"/>
              <path fill="${faceColor}" d="M54.28,179.72h.02s-.01,0-.02,0t0,0Z"/>
              <path fill="#c7c8ca" d="M27.14,0C12.15,0,0,89.6,0,200.12s12.15,200.12,27.14,200.12c14.99,0,27.14-89.6,27.14-200.12v-.21C54.26,89.48,42.12,0,27.14,0ZM31.38,321.65c-1.46,0-2.88-1.42-4.24-4.06-7.05-13.78-12.25-61.15-12.25-117.47s5.2-103.69,12.25-117.47c1.35-2.64,2.77-4.06,4.24-4.06,9.1,0,16.48,54.41,16.48,121.53s-7.38,121.53-16.48,121.53Z"/>
              <path fill="#7c552e" d="M31.38,78.59c-1.46,0-2.88,1.42-4.24,4.06-7.05,13.78-12.25,61.15-12.25,117.47s5.2,103.69,12.25,117.47c1.35,2.64,2.77,4.06,4.24,4.06,9.1,0,16.48-54.41,16.48-121.53s-7.38-121.53-16.48-121.53Z"/>
              <path fill="#ededee" d="M54.3,179.72h-.02s0,0,0,0c0,0,0,0,0,0h0v20.4c0,3.58-.01,7.13-.04,10.66-.03,4.46-.08,8.88-.16,13.26-.05,3.27-.12,6.51-.19,9.73-.05,2.24-.11,4.47-.17,6.68-.12,4.22-.25,8.39-.41,12.5-.03.9-.07,1.8-.1,2.7-.15,3.85-.32,7.66-.5,11.41-.08,1.74-.17,3.47-.26,5.19-.81,15.52-1.88,30.11-3.17,43.48,0,.07-.01.15-.02.22-.62,6.46-1.3,12.64-2.02,18.51,0,.07-.02.13-.02.2-.43,3.46-.87,6.8-1.33,10.02-.01.09-.03.19-.04.28-.26,1.86-.54,3.67-.81,5.45-.05.34-.1.68-.16,1.01-.3,1.92-.61,3.78-.92,5.6-.03.17-.06.35-.09.52-.11.62-.22,1.23-.32,1.83-.07.36-.13.73-.19,1.09-.07.39-.14.76-.21,1.14-.1.57-.21,1.14-.32,1.69-.17.92-.35,1.82-.53,2.71,0,.01,0,.02,0,.03-.08.39-.16.77-.24,1.15-.29,1.39-.57,2.75-.87,4.06-.03.16-.07.3-.1.46-.34,1.51-.68,2.97-1.03,4.36-.01.05-.03.1-.04.15-3.45,13.77-7.35,22.19-11.5,23.74-.04.02-.08.02-.13.04-.19.06-.38.12-.57.16-.08.02-.17.01-.26.02-.15.02-.3.04-.45.04h0c14.99,0,27.14-40.9,27.14-151.41,0-1.99.77-3.05,2.15-3.36h0s358.03-56.88,358.03-56.88v-48.71L74.21,228.19s-6.73-50.45-19.91-48.47Z"/>
              <path fill="${adhesiveHex}" d="M56.43,245.47c13.19-2.88,82.74,64,82.74,64l275.29-120.88L56.43,245.46h0Z"/>
              <path fill="${faceColor}" opacity="0.85" d="M139.17,309.47s-69.55-66.88-82.74-64c-1.38.3-2.15,1.37-2.15,3.36,0,110.51-12.15,151.41-27.14,151.41h387.32v-211.65l-275.29,120.88Z"/>
              <path fill="#c4c5c7" d="M54.28,179.72s.01,0,.02,0c13.18-1.98,19.91,48.47,19.91,48.47l340.25-88.31-47.5,5.25L54.28,179.72Z"/>
              ${backingType === 'branded' ? `<text x="250" y="192" font-family="Arial,sans-serif" font-size="22" font-weight="700" fill="#222" transform="rotate(-8, 68, 222)" text-anchor="start">${brandText}</text>` : ''}
            </svg>
            <div>
              <div style="font-size: 18px; font-weight: 700; margin-bottom: 4px;">${mat.name}</div>
              ${finishDesc ? `<div style="font-size: 13px; color: #666; margin-bottom: 2px;">Finish: ${finishDesc}</div>` : ''}
              <div style="font-size: 13px; color: #666; margin-bottom: 2px;">Adhesive: <span style="display:inline-block;width:12px;height:12px;background:${adhesiveHex};border:1px solid #ccc;border-radius:2px;vertical-align:middle;"></span> ${adhesiveLabel}</div>
              <div style="font-size: 13px; color: #666; margin-bottom: 2px;">Backing: ${backingType === 'branded' ? `Branded (${brandText})` : 'Blank'}</div>
              ${idNotes ? `<div style="font-size: 12px; color: #888; font-style: italic; margin-top: 4px;">${idNotes}</div>` : ''}
            </div>
          </div>
        </div>`
    }).join('')

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Material Roll Identifier — FWG</title><style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; color: #111; }
      h1 { font-size: 24px; margin-bottom: 4px; }
      p { color: #666; font-size: 14px; margin-bottom: 20px; }
      .grid { columns: 2; column-gap: 16px; }
      @media print { body { padding: 12px; } .grid { columns: 2; } }
    </style></head><body>
      <h1>Material Roll Identifier</h1>
      <p>Frederick Wraps & Graphics — Visual Reference Guide</p>
      <div class="grid">${rollsHtml}</div>
    </body></html>`)
    printWindow.document.close()
    setTimeout(() => printWindow.print(), 500)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search materials..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: 1, padding: '10px 14px', background: cardBg, border: `1px solid ${borderColor}`, borderRadius: '8px', color: textPrimary, fontSize: '14px', outline: 'none' }}
        />
        <button onClick={handlePrint} style={{ padding: '10px 20px', background: accentGradient, border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 600, fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          Print Reference
        </button>
      </div>

      {filteredMedia.length === 0 ? (
        <div style={{ padding: '40px', background: cardBg, borderRadius: '12px', border: `1px solid ${borderColor}`, textAlign: 'center' }}>
          <p style={{ color: textMuted, fontSize: '14px', margin: 0 }}>No media materials found{searchTerm ? ' matching your search' : ''}.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {([
            { key: 'everyday', label: 'Everyday', color: '#22c55e', desc: 'Most frequently used — your go-to rolls' },
            { key: 'common', label: 'Common', color: '#eab308', desc: 'Used regularly but not daily' },
            { key: 'rare', label: 'Rare', color: '#ef4444', desc: 'Specialty or infrequent use' },
          ] as const).map((section) => {
            const sectionMedia = filteredMedia.filter((m) => m.relevancy === section.key)
            if (sectionMedia.length === 0) return null
            return (
              <div key={section.key}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: section.color, flexShrink: 0 }} />
                  <h3 style={{ color: textPrimary, fontSize: '16px', fontWeight: 700, margin: 0 }}>{section.label}</h3>
                  <span style={{ fontSize: '12px', color: textMuted }}>({sectionMedia.length})</span>
                  <span style={{ fontSize: '12px', color: textMuted, fontStyle: 'italic' }}>— {section.desc}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
          {sectionMedia.map((mat) => {
            const faceColor = mat.media_face_color || '#ffffff'
            const adhesive = mat.adhesive_color || ''
            const backingType = mat.backing_type || 'blank'
            const brandText = mat.backing_brand_text || ''
            const finishDesc = mat.finish_description || ''
            const idNotes = mat.id_notes || ''
            const hasIdData = adhesive || finishDesc || backingType === 'branded' || faceColor !== '#ffffff' || mat.is_colored_vinyl

            return (
              <div key={mat.id} style={{ background: cardBg, borderRadius: '12px', border: `1px solid ${borderColor}`, overflow: 'hidden', padding: '20px' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  {/* Roll SVG */}
                  <div style={{ flexShrink: 0 }}>
                    <RollIdentifierSvg
                      mediaFaceColor={faceColor}
                      adhesiveColor={adhesive || ''}
                      backingType={backingType}
                      backingBrandText={brandText}
                      isColoredVinyl={mat.is_colored_vinyl}
                      size={160}
                    />
                  </div>

                  {/* Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: textPrimary, marginBottom: '8px' }}>{mat.name}</div>

                    {!hasIdData ? (
                      <div style={{ fontSize: '13px', color: textMuted, fontStyle: 'italic' }}>
                        No identification data set yet. Edit this material on the Materials List to add visual identifiers.
                      </div>
                    ) : (
                      <>
                        {finishDesc && (
                          <div style={{ fontSize: '13px', color: textSecondary, marginBottom: '4px' }}>
                            <span style={{ color: textMuted }}>Finish:</span> {finishDesc}
                          </div>
                        )}
                        {adhesive && (
                          <div style={{ fontSize: '13px', color: textSecondary, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: textMuted }}>Adhesive:</span>
                            <span style={{ width: '14px', height: '14px', borderRadius: '3px', background: adhesive === 'holographic' ? 'linear-gradient(135deg, #22d3ee, #a855f7, #ec4899, #eab308)' : getAdhesiveHex(adhesive), border: '1px solid rgba(255,255,255,0.15)', display: 'inline-block', flexShrink: 0 }} />
                            <span>{getAdhesiveLabel(adhesive)}</span>
                          </div>
                        )}
                        <div style={{ fontSize: '13px', color: textSecondary, marginBottom: '4px' }}>
                          <span style={{ color: textMuted }}>Backing:</span> {backingType === 'branded' ? `Branded — ${brandText}` : 'Blank (no logos)'}
                        </div>
                        {idNotes && (
                          <div style={{ fontSize: '12px', color: textMuted, fontStyle: 'italic', marginTop: '6px', borderTop: `1px solid ${borderColor}`, paddingTop: '6px' }}>
                            {idNotes}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {/* Use Cases */}
                {(mat.use_case_categories || []).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${borderColor}` }}>
                    {(mat.use_case_categories || []).map((uc) => {
                      const label = categories.find((c) => c.category_key === uc)?.label || uc
                      return (
                        <span key={uc} style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '4px', background: 'rgba(34,211,238,0.08)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.15)' }}>
                          {label}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const BLADE_COLORS_MAP: Record<string, string> = {
  red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308',
  orange: '#f97316', purple: '#a855f7', pink: '#ec4899', white: '#e2e8f0',
  black: '#374151', cyan: '#22d3ee', holographic: '#a855f7', blank: '#1a1a1a',
}

function darkenColor(hex: string, amount: number): string {
  if (!hex || hex === 'holographic' || !hex.startsWith('#')) return '#999'
  const num = parseInt(hex.slice(1), 16)
  const r = Math.max(0, Math.round(((num >> 16) & 0xff) * (1 - amount)))
  const g = Math.max(0, Math.round(((num >> 8) & 0xff) * (1 - amount)))
  const b = Math.max(0, Math.round((num & 0xff) * (1 - amount)))
  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`
}

const ADHESIVE_COLORS: Record<string, { hex: string; label: string }> = {
  white: { hex: '#f5f5f5', label: 'White' },
  clear: { hex: '#e8e8e8', label: 'Clear' },
  light_gray: { hex: '#b0b0b0', label: 'Light Gray' },
  medium_gray: { hex: '#808080', label: 'Medium Gray' },
  dark_gray: { hex: '#414042', label: 'Dark Gray' },
  holographic: { hex: 'holographic', label: 'Holographic' },
  colored: { hex: 'colored', label: 'Colored (matches media)' },
}

function getAdhesiveHex(name: string): string {
  return ADHESIVE_COLORS[name]?.hex || '#c7c8ca'
}

function getAdhesiveLabel(name: string): string {
  return ADHESIVE_COLORS[name]?.label || name || '—'
}

function RollIdentifierSvg({ mediaFaceColor, adhesiveColor, backingType, backingBrandText, isColoredVinyl, size = 160 }: {
  mediaFaceColor: string; adhesiveColor: string; backingType: string; backingBrandText: string; isColoredVinyl?: boolean; size?: number
}) {
  const isHoloAdhesive = adhesiveColor === 'holographic'
  const isHoloFace = mediaFaceColor === 'holographic'
  const isColoredAdhesive = adhesiveColor === 'colored'
  const adhesiveHex = isHoloAdhesive ? 'url(#holoAdhesive)' : isColoredAdhesive ? darkenColor(mediaFaceColor, 0.2) : getAdhesiveHex(adhesiveColor)
  const needsHoloDefs = isHoloAdhesive || isHoloFace

  const holoDefs = needsHoloDefs ? (
    <defs>
      {isHoloFace && (
        <linearGradient id="holoFace" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22d3ee"><animate attributeName="stop-color" values="#22d3ee;#a855f7;#ec4899;#eab308;#22d3ee" dur="3s" repeatCount="indefinite" /></stop>
          <stop offset="33%" stopColor="#a855f7"><animate attributeName="stop-color" values="#a855f7;#ec4899;#eab308;#22d3ee;#a855f7" dur="3s" repeatCount="indefinite" /></stop>
          <stop offset="66%" stopColor="#ec4899"><animate attributeName="stop-color" values="#ec4899;#eab308;#22d3ee;#a855f7;#ec4899" dur="3s" repeatCount="indefinite" /></stop>
          <stop offset="100%" stopColor="#eab308"><animate attributeName="stop-color" values="#eab308;#22d3ee;#a855f7;#ec4899;#eab308" dur="3s" repeatCount="indefinite" /></stop>
        </linearGradient>
      )}
      {isHoloAdhesive && (
        <linearGradient id="holoAdhesive" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22d3ee"><animate attributeName="stop-color" values="#22d3ee;#a855f7;#ec4899;#eab308;#22d3ee" dur="3s" repeatCount="indefinite" /></stop>
          <stop offset="33%" stopColor="#a855f7"><animate attributeName="stop-color" values="#a855f7;#ec4899;#eab308;#22d3ee;#a855f7" dur="3s" repeatCount="indefinite" /></stop>
          <stop offset="66%" stopColor="#ec4899"><animate attributeName="stop-color" values="#ec4899;#eab308;#22d3ee;#a855f7;#ec4899" dur="3s" repeatCount="indefinite" /></stop>
          <stop offset="100%" stopColor="#eab308"><animate attributeName="stop-color" values="#eab308;#22d3ee;#a855f7;#ec4899;#eab308" dur="3s" repeatCount="indefinite" /></stop>
        </linearGradient>
      )}
    </defs>
  ) : null

  // Colored vinyl badge
  const coloredVinylBadge = isColoredVinyl ? (
    <>
      <defs>
        <linearGradient id="cmyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#00bcd4" />
          <stop offset="50%" stopColor="#e91e63" />
          <stop offset="100%" stopColor="#ffeb3b" />
        </linearGradient>
      </defs>
      <rect x="260" y="4" width="148" height="40" rx="20" fill="none" stroke="url(#cmyGrad)" strokeWidth="3" />
      <rect x="263" y="7" width="142" height="34" rx="17" fill="rgba(0,0,0,0.8)" />
      <text x="334" y="30" fontFamily="Arial,sans-serif" fontSize="16" fontWeight="700" fill="#fff" textAnchor="middle" letterSpacing="2">COLORED</text>
    </>
  ) : null
  const faceColor = isHoloFace ? 'url(#holoFace)' : mediaFaceColor

  if (backingType !== 'branded') {
    // Blank backing — no peel strip, cleaner roll
    return (
      <svg viewBox="0 0 414.46 400.23" style={{ width: size, height: size * (400.23 / 414.46) }}>
        {holoDefs}
        {/* Backing area */}
        <path fill="#e6e7e8" d="M226.8,188.59H55.04c.03,3.75.05,7.52.05,11.32v.21c0,16.75-.28,33.01-.81,48.55h0c.04-1.89.8-2.91,2.14-3.2h0s358.03-56.88,358.03-56.88h-187.66Z"/>
        {/* Media face — top surface */}
        <path fill={faceColor} d="M414.46,0H27.14c14.98,0,27.12,89.48,27.14,199.9v.21c0,3.55-.01,7.08-.04,10.58v.08c0,.14,0,.29,0,.43-.01,1.96-.03,3.91-.06,5.86,0,.29,0,.57-.01.86-.02,1.95-.05,3.9-.08,5.83,0,.09,0,.18,0,.27,0,.03,0,.07,0,.1-.05,3.2-.11,6.38-.19,9.54,0,.03,0,.06,0,.09,0,.03,0,.06,0,.09-.1,4.29-.22,8.53-.35,12.72,0,.14,0,.27-.01.41-.09,2.88-.2,5.75-.31,8.58,0,.02,0,.05,0,.07,0,.06,0,.12,0,.18-.07,1.81-.15,3.62-.22,5.41l-.02.36c-.08,1.77-.16,3.53-.24,5.28,0,.06,0,.12,0,.18,0,.05,0,.09,0,.14-.08,1.63-.16,3.26-.24,4.87,0,.06,0,.12,0,.18,0,.02,0,.05,0,.07-.2,3.85-.42,7.64-.65,11.36,0,.03,0,.05,0,.08-.11,1.77-.23,3.53-.34,5.28-.01.16-.02.32-.03.48-.36,5.32-.75,10.51-1.17,15.54-.03.34-.06.68-.09,1.01-.11,1.3-.22,2.6-.34,3.88-.03.37-.07.75-.1,1.12-.13,1.48-.27,2.96-.41,4.41,0,.08-.01.16-.02.24,0,.04,0,.09-.01.13-.15,1.52-.3,3.02-.45,4.51-.04.43-.09.86-.13,1.29-.11,1.04-.22,2.07-.33,3.09-.05.46-.1.92-.15,1.38-.11,1.04-.23,2.08-.35,3.1-.04.38-.09.76-.13,1.13-.16,1.35-.32,2.69-.48,4.02,0,.02,0,.05,0,.07,0,.02,0,.04,0,.06-.2,1.62-.4,3.21-.61,4.78-.04.32-.08.64-.13.96-.19,1.46-.39,2.9-.59,4.32,0,.04,0,.07-.01.11-.01.08-.02.15-.03.23-.04.27-.08.54-.12.81-.1.68-.2,1.37-.3,2.04-.13.87-.26,1.72-.39,2.57,0,.03,0,.06-.01.09-.01.07-.02.15-.03.22-.32,2.08-.65,4.1-.98,6.07-.02.11-.04.22-.05.32-.03.17-.06.35-.09.52-.11.62-.22,1.23-.32,1.83-.07.36-.13.73-.19,1.09-.07.39-.14.76-.21,1.14-.01.06-.02.11-.03.17-.27,1.45-.54,2.87-.82,4.24,0,0,0,.02,0,.02-.08.39-.16.77-.24,1.15,0,0,0,.01,0,.02-.14.66-.27,1.31-.41,1.96-.1.49-.21.97-.31,1.45-.25,1.12-.5,2.22-.75,3.28-.13.53-.25,1.05-.38,1.57-.27,1.09-.54,2.15-.81,3.18-.04.15-.08.3-.12.45-.17.62-.34,1.24-.51,1.83-.06.21-.12.41-.18.62-.15.53-.31,1.05-.46,1.56-.07.22-.14.44-.2.66-.15.48-.3.95-.45,1.41-.07.22-.14.43-.21.64-.15.45-.3.89-.46,1.32-.07.2-.14.4-.21.59-.16.44-.32.86-.48,1.28-.06.17-.13.34-.19.5-.19.47-.37.92-.56,1.36-.04.09-.08.19-.12.28-.23.54-.47,1.05-.7,1.54,0,.02-.02.03-.02.05-.22.46-.44.89-.66,1.31-.07.13-.14.25-.21.38-.16.29-.32.58-.48.85-.09.15-.18.28-.26.42-.15.23-.29.46-.44.68-.09.14-.19.27-.29.4-.14.2-.28.39-.43.56-.1.12-.2.25-.3.36-.14.17-.28.32-.43.47-.1.1-.2.21-.3.31-.15.14-.29.27-.44.4-.1.08-.19.17-.29.24-.16.12-.32.23-.48.33-.08.05-.16.11-.25.16-.24.14-.48.25-.72.35,0,0,0,0-.01,0h0c-.13.05-.26.07-.39.11-.1.03-.2.07-.3.09-.08.02-.17.01-.26.02-.15.02-.3.04-.45.04h0c14.99,0,27.14-40.9,27.14-151.41,0-.05,0-.1,0-.15h0c.53-15.55.81-31.81.81-48.55v-.21c0-3.8-.02-7.57-.05-11.32h359.42V0Z"/>
        {coloredVinylBadge}
        {/* Roll edge */}
        <path fill="#c7c8ca" d="M28.41,400.01s.08-.02.12-.04c0,0,0,0,.01,0,.24-.09.48-.21.72-.35.08-.05.16-.11.25-.16.16-.1.32-.21.48-.33.1-.07.19-.16.29-.24.15-.13.29-.25.44-.4.1-.1.2-.2.3-.31.14-.15.28-.31.43-.47.1-.12.2-.24.3-.36.14-.18.28-.37.43-.56.1-.13.19-.26.29-.4.15-.22.29-.45.44-.68.09-.14.18-.28.26-.42.16-.27.32-.56.48-.85.07-.13.14-.25.21-.38.22-.42.44-.85.66-1.31,0-.02.02-.03.02-.05.23-.49.47-1,.7-1.54.04-.09.08-.19.12-.28.19-.44.38-.89.56-1.36.06-.16.13-.33.19-.5.16-.42.32-.84.48-1.28.07-.19.14-.39.21-.59.15-.43.31-.87.46-1.32.07-.21.14-.43.21-.64.15-.46.3-.93.45-1.41.07-.22.14-.43.2-.66.16-.51.31-1.03.46-1.56.06-.21.12-.41.18-.62.17-.6.34-1.21.51-1.83.04-.15.08-.3.12-.45.21-.79.42-1.59.63-2.42.01-.05.03-.1.04-.15.05-.2.1-.41.15-.61.13-.52.25-1.04.38-1.57.17-.72.34-1.45.5-2.19.04-.15.07-.3.1-.46.05-.21.09-.43.14-.64.11-.48.21-.96.31-1.45.14-.64.27-1.3.41-1.96.08-.4.16-.79.25-1.19,0,0,0,0,0,0,.18-.89.35-1.79.53-2.71.1-.5.19-1.02.28-1.53.31-1.65.61-3.34.9-5.08.29-1.72.58-3.47.86-5.27.04-.26.08-.53.12-.79.02-.1.03-.21.05-.31.13-.85.26-1.7.39-2.57.1-.67.2-1.35.3-2.04.04-.25.07-.5.11-.76,0-.02,0-.03,0-.05.02-.11.03-.23.05-.34.2-1.42.4-2.86.59-4.32.04-.32.09-.64.13-.96.2-1.52.4-3.06.59-4.63,0-.05.01-.1.02-.14,0-.04.01-.09.02-.13.16-1.32.32-2.66.48-4.02.04-.38.09-.75.13-1.13.12-1.03.23-2.06.35-3.1.05-.46.1-.92.15-1.38.11-1.02.22-2.06.33-3.09.04-.43.09-.86.13-1.29.15-1.46.3-2.93.44-4.42,0-.03,0-.06,0-.09.01-.12.02-.25.03-.37.14-1.46.28-2.93.41-4.41.03-.37.07-.75.1-1.12.11-1.28.23-2.58.34-3.88.03-.34.06-.67.09-1.01.42-5.04.81-10.22,1.17-15.54.01-.16.02-.32.03-.48.12-1.75.23-3.5.34-5.28,0-.03,0-.05,0-.08.23-3.73.45-7.52.65-11.36,0-.08,0-.17.01-.25.08-1.61.17-3.24.24-4.87,0-.11.01-.21.02-.32.08-1.75.16-3.51.24-5.28l.02-.36c.08-1.79.15-3.6.22-5.41,0-.09,0-.17.01-.26.03-.87.07-1.75.1-2.62.07-1.97.14-3.96.21-5.96,0-.14,0-.27.01-.41.07-2.03.13-4.08.19-6.14.06-2.18.11-4.38.17-6.58,0-.06,0-.12,0-.18.07-3.15.13-6.33.19-9.54,0-.12,0-.25,0-.38.03-1.94.06-3.88.08-5.83,0-.29,0-.57.01-.86.02-1.95.04-3.9.06-5.86,0-.17,0-.34,0-.51.02-3.51.04-7.03.04-10.58v-.21C54.26,89.48,42.12,0,27.14,0S0,89.6,0,200.12s12.15,200.12,27.14,200.12c.34,0,.67-.06,1.01-.15.09-.03.18-.04.27-.07ZM14.89,200.12c0-56.32,5.2-103.69,12.25-117.47,1.35-2.64,2.77-4.06,4.24-4.06,9.1,0,16.48,54.41,16.48,121.53s-7.38,121.53-16.48,121.53c-1.46,0-2.88-1.42-4.24-4.06-7.05-13.78-12.25-61.15-12.25-117.47Z"/>
        {/* Cardboard tube */}
        <path fill="#7c552e" d="M31.38,321.65c9.1,0,16.48-54.41,16.48-121.53s-7.38-121.53-16.48-121.53c-1.46,0-2.88,1.42-4.24,4.06-7.05,13.78-12.25,61.15-12.25,117.47s5.2,103.69,12.25,117.47c1.35,2.64,2.77,4.06,4.24,4.06Z"/>
        {/* Adhesive triangle */}
        <path fill={adhesiveHex} d="M414.46,188.59L56.43,245.46h0c1.92-.41,4.11.65,6.47,2.75,13.85,12.4,33.17,61.25,33.17,61.25l192.76-73.18,125.64-47.7h0Z"/>
        {/* Media face — bottom */}
        <path fill={faceColor} opacity="0.85" d="M414.46,188.59l-125.64,47.7-192.76,73.18s-19.32-48.86-33.17-61.25c-2.35-2.11-4.55-3.17-6.47-2.75-1.35.29-2.1,1.32-2.14,3.2,0,.05,0,.1,0,.15,0,110.51-12.15,151.41-27.14,151.41h387.32v-211.65h0Z"/>
      </svg>
    )
  }

  // Branded backing — original roll with peel strip and brand text
  return (
    <svg viewBox="0 0 414.46 400.23" style={{ width: size, height: size * (400.23 / 414.46) }}>
      {holoDefs}
      {/* Media face — top surface */}
      <path fill={faceColor} d="M54.28,199.9v-20.18h0s0,0,0,0l312.68-34.59,47.5-5.25V0H27.14c14.98,0,27.12,89.48,27.14,199.9Z"/>
      <path fill={faceColor} d="M54.28,179.72h.02s-.01,0-.02,0t0,0Z"/>
      {coloredVinylBadge}
      {/* Roll edge */}
      <path fill="#c7c8ca" d="M27.14,0C12.15,0,0,89.6,0,200.12s12.15,200.12,27.14,200.12c14.99,0,27.14-89.6,27.14-200.12v-.21C54.26,89.48,42.12,0,27.14,0ZM31.38,321.65c-1.46,0-2.88-1.42-4.24-4.06-7.05-13.78-12.25-61.15-12.25-117.47s5.2-103.69,12.25-117.47c1.35-2.64,2.77-4.06,4.24-4.06,9.1,0,16.48,54.41,16.48,121.53s-7.38,121.53-16.48,121.53Z"/>
      {/* Cardboard tube */}
      <path fill="#7c552e" d="M31.38,78.59c-1.46,0-2.88,1.42-4.24,4.06-7.05,13.78-12.25,61.15-12.25,117.47s5.2,103.69,12.25,117.47c1.35,2.64,2.77,4.06,4.24,4.06,9.1,0,16.48-54.41,16.48-121.53s-7.38-121.53-16.48-121.53Z"/>
      {/* Back of backing */}
      <path fill="#ededee" d="M54.3,179.72h-.02s0,0,0,0c0,0,0,0,0,0h0v20.4c0,3.58-.01,7.13-.04,10.66-.03,4.46-.08,8.88-.16,13.26-.05,3.27-.12,6.51-.19,9.73-.05,2.24-.11,4.47-.17,6.68-.12,4.22-.25,8.39-.41,12.5-.03.9-.07,1.8-.1,2.7-.15,3.85-.32,7.66-.5,11.41-.08,1.74-.17,3.47-.26,5.19-.81,15.52-1.88,30.11-3.17,43.48,0,.07-.01.15-.02.22-.62,6.46-1.3,12.64-2.02,18.51,0,.07-.02.13-.02.2-.43,3.46-.87,6.8-1.33,10.02-.01.09-.03.19-.04.28-.26,1.86-.54,3.67-.81,5.45-.05.34-.1.68-.16,1.01-.3,1.92-.61,3.78-.92,5.6-.03.17-.06.35-.09.52-.11.62-.22,1.23-.32,1.83-.07.36-.13.73-.19,1.09-.07.39-.14.76-.21,1.14-.1.57-.21,1.14-.32,1.69-.17.92-.35,1.82-.53,2.71,0,.01,0,.02,0,.03-.08.39-.16.77-.24,1.15-.29,1.39-.57,2.75-.87,4.06-.03.16-.07.3-.1.46-.34,1.51-.68,2.97-1.03,4.36-.01.05-.03.1-.04.15-3.45,13.77-7.35,22.19-11.5,23.74-.04.02-.08.02-.13.04-.19.06-.38.12-.57.16-.08.02-.17.01-.26.02-.15.02-.3.04-.45.04h0c14.99,0,27.14-40.9,27.14-151.41,0-1.99.77-3.05,2.15-3.36h0s358.03-56.88,358.03-56.88v-48.71L74.21,228.19s-6.73-50.45-19.91-48.47Z"/>
      {/* Adhesive triangle */}
      <path fill={adhesiveHex} d="M56.43,245.47c13.19-2.88,82.74,64,82.74,64l275.29-120.88L56.43,245.46h0Z"/>
      {/* Media face — bottom */}
      <path fill={faceColor} opacity="0.85" d="M139.17,309.47s-69.55-66.88-82.74-64c-1.38.3-2.15,1.37-2.15,3.36,0,110.51-12.15,151.41-27.14,151.41h387.32v-211.65l-275.29,120.88Z"/>
      {/* Backing strip */}
      <path fill="#c4c5c7" d="M54.28,179.72s.01,0,.02,0c13.18-1.98,19.91,48.47,19.91,48.47l340.25-88.31-47.5,5.25L54.28,179.72Z"/>
      {/* Brand text */}
      {backingBrandText && (
        <text x="83" y="207" fontFamily="Arial,sans-serif" fontSize="22" fontWeight="700" fill="#222" transform="rotate(-8, 83, 207)" textAnchor="start">{backingBrandText}</text>
      )}
    </svg>
  )
}

function SummaryCard({ label, color, title, details }: { label: string; color: string; title: string; details?: string[] }) {
  return (
    <div style={{
      background: '#1d1d1d',
      borderRadius: '12px',
      border: '1px solid rgba(148, 163, 184, 0.1)',
      padding: '18px',
      borderTop: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: '11px', fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
        {label}
      </div>
      <div style={{ fontSize: '16px', fontWeight: 600, color: '#f1f5f9' }}>{title}</div>
      {details?.map((d, i) => (
        <div key={i} style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>{d}</div>
      ))}
    </div>
  )
}
