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

export default function MediaGuide({
  materials,
  categories,
  printers,
}: {
  materials: Material[]
  categories: Category[]
  printers: Printer[]
}) {
  const [pageTab, setPageTab] = useState<PageTabKey>('guide')

  // Guided selector state
  const [step, setStep] = useState(1)
  const [selectedUseCase, setSelectedUseCase] = useState<string | null>(null)
  const [selectedMedia, setSelectedMedia] = useState<Material | null>(null)
  const [selectedLaminate, setSelectedLaminate] = useState<Material | null>(null)
  const [selectedFinish, setSelectedFinish] = useState<string | null>(null)

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

  // Step 1: Pick use case → filter media
  const matchingMedia = useMemo(() => {
    if (!selectedUseCase) return []
    return media.filter((m) => (m.use_case_categories || []).includes(selectedUseCase))
  }, [selectedUseCase, media])

  // Step 2: Pick media → find compatible laminates
  const compatibleLaminates = useMemo(() => {
    if (!selectedMedia) return []
    const pairingIds = selectedMedia.laminate_pairing_ids || []
    if (pairingIds.length > 0) {
      return laminates.filter((l) => pairingIds.includes(l.id))
    }
    // If no pairings set, show laminates that share the same use case
    if (selectedUseCase) {
      return laminates.filter((l) => (l.use_case_categories || []).includes(selectedUseCase))
    }
    return laminates
  }, [selectedMedia, selectedUseCase, laminates])

  // Available finishes from compatible laminates
  const availableFinishes = useMemo(() => {
    const finishes = new Set<string>()
    compatibleLaminates.forEach((l) => {
      if (l.finish) finishes.add(l.finish)
    })
    return Array.from(finishes)
  }, [compatibleLaminates])

  // Filtered laminates by finish
  const filteredLaminates = useMemo(() => {
    if (!selectedFinish) return compatibleLaminates
    return compatibleLaminates.filter((l) => l.finish === selectedFinish)
  }, [compatibleLaminates, selectedFinish])

  // Compatible transfer tape (match subtype: cast media → cast tape, calendared → calendared)
  const compatibleTransferTape = useMemo(() => {
    if (!selectedMedia) return []
    const subtype = selectedMedia.material_subtype?.toUpperCase()
    if (subtype === 'CAST') {
      return transferTapes.filter((t) => t.material_subtype?.toUpperCase() === 'CAST')
    }
    if (subtype === 'CALENDARED') {
      return transferTapes.filter((t) => t.material_subtype?.toUpperCase() === 'CALENDARED')
    }
    return transferTapes
  }, [selectedMedia, transferTapes])

  // Printer recommendation
  const recommendedPrinters = useMemo(() => {
    if (!selectedMedia) return printers
    const compat = selectedMedia.printer_compatibility || []
    if (compat.length === 0) return printers
    return printers.filter((p) =>
      compat.some((c) => p.model.toLowerCase().includes(c.toLowerCase()))
    )
  }, [selectedMedia, printers])

  const resetGuide = () => {
    setStep(1)
    setSelectedUseCase(null)
    setSelectedMedia(null)
    setSelectedLaminate(null)
    setSelectedFinish(null)
  }

  const handleSelectUseCase = (key: string) => {
    setSelectedUseCase(key)
    setSelectedMedia(null)
    setSelectedLaminate(null)
    setSelectedFinish(null)
    setStep(2)
  }

  const handleSelectMedia = (mat: Material) => {
    setSelectedMedia(mat)
    setSelectedLaminate(null)
    setSelectedFinish(null)
    setStep(3)
  }

  const handleSelectLaminate = (lam: Material) => {
    setSelectedLaminate(lam)
    setStep(4)
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

      {/* ==================== GUIDED SELECTOR ==================== */}
      {pageTab === 'guide' && (
        <div>
          {/* Progress steps */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', alignItems: 'center' }}>
            {[
              { num: 1, label: 'Use Case' },
              { num: 2, label: 'Media' },
              { num: 3, label: 'Laminate' },
              { num: 4, label: 'Summary' },
            ].map((s, i) => (
              <div key={s.num} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => {
                    if (s.num < step) {
                      setStep(s.num)
                      if (s.num <= 1) { setSelectedMedia(null); setSelectedLaminate(null); setSelectedFinish(null) }
                      if (s.num <= 2) { setSelectedLaminate(null); setSelectedFinish(null) }
                      if (s.num <= 3) { setSelectedLaminate(null) }
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '20px',
                    border: 'none',
                    cursor: s.num <= step ? 'pointer' : 'default',
                    fontSize: '13px',
                    fontWeight: 600,
                    background: step === s.num
                      ? 'rgba(34,211,238,0.15)'
                      : step > s.num
                      ? 'rgba(34,197,94,0.1)'
                      : 'rgba(255,255,255,0.03)',
                    color: step === s.num
                      ? '#22d3ee'
                      : step > s.num
                      ? '#22c55e'
                      : textMuted,
                  }}
                >
                  {step > s.num ? '✓' : s.num}
                  <span>{s.label}</span>
                </button>
                {i < 3 && (
                  <div style={{ width: '24px', height: '1px', background: step > s.num ? '#22c55e' : borderColor }} />
                )}
              </div>
            ))}
            {step > 1 && (
              <button
                onClick={resetGuide}
                style={{
                  marginLeft: 'auto',
                  padding: '6px 14px',
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: '8px',
                  color: '#ef4444',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                }}
              >
                Start Over
              </button>
            )}
          </div>

          {/* Step 1: Select Use Case */}
          {step === 1 && (
            <div>
              <h2 style={{ color: textPrimary, fontSize: '18px', fontWeight: 600, margin: '0 0 16px' }}>
                What type of job is this?
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                {activeCategories.map((cat) => {
                  const count = media.filter((m) => (m.use_case_categories || []).includes(cat.category_key)).length
                  return (
                    <button
                      key={cat.category_key}
                      onClick={() => handleSelectUseCase(cat.category_key)}
                      style={{
                        padding: '20px',
                        background: cardBg,
                        border: `1px solid ${borderColor}`,
                        borderRadius: '12px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(34,211,238,0.3)'
                        e.currentTarget.style.background = 'rgba(34,211,238,0.05)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = borderColor
                        e.currentTarget.style.background = cardBg
                      }}
                    >
                      <div style={{ fontSize: '16px', fontWeight: 600, color: textPrimary, marginBottom: '4px' }}>
                        {cat.label}
                      </div>
                      <div style={{ fontSize: '12px', color: textMuted }}>
                        {count} media option{count !== 1 ? 's' : ''}
                      </div>
                    </button>
                  )
                })}
              </div>
              {activeCategories.length === 0 && (
                <div style={{ padding: '40px', background: cardBg, borderRadius: '12px', border: `1px solid ${borderColor}`, textAlign: 'center' }}>
                  <p style={{ color: textMuted, fontSize: '14px', margin: 0 }}>
                    No use cases have been assigned to materials yet. Go to Materials List → Use Cases tab to assign them.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Select Media */}
          {step === 2 && (
            <div>
              <h2 style={{ color: textPrimary, fontSize: '18px', fontWeight: 600, margin: '0 0 4px' }}>
                Select Media for {getCategoryLabel(selectedUseCase!)}
              </h2>
              <p style={{ color: textMuted, fontSize: '13px', margin: '0 0 16px' }}>
                {matchingMedia.length} option{matchingMedia.length !== 1 ? 's' : ''} available
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
                {matchingMedia.map((mat) => {
                  const costSqFt = calcCostPerSqFt(mat.cost_per_roll, mat.width_inches, mat.length_yards)
                  const pairedLamCount = (mat.laminate_pairing_ids || []).length
                  return (
                    <button
                      key={mat.id}
                      onClick={() => handleSelectMedia(mat)}
                      style={{
                        padding: '18px',
                        background: cardBg,
                        border: `1px solid ${borderColor}`,
                        borderRadius: '12px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(34,211,238,0.3)'
                        e.currentTarget.style.background = 'rgba(34,211,238,0.05)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = borderColor
                        e.currentTarget.style.background = cardBg
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div style={{ fontSize: '15px', fontWeight: 600, color: textPrimary }}>{mat.name}</div>
                        <span style={{
                          padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                          background: mat.relevancy === 'everyday' ? 'rgba(34,197,94,0.1)' : mat.relevancy === 'rare' ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.1)',
                          color: mat.relevancy === 'everyday' ? '#22c55e' : mat.relevancy === 'rare' ? '#ef4444' : '#eab308',
                          flexShrink: 0,
                          marginLeft: '8px',
                        }}>
                          {mat.relevancy}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '12px', color: textSecondary }}>
                        <span>{mat.material_subtype || '—'}</span>
                        <span>{mat.thickness_mil} mil</span>
                        {mat.width_inches && <span>{mat.width_inches}&quot; wide</span>}
                        {costSqFt !== null && <span style={{ color: '#22d3ee' }}>{fmt(costSqFt)}/sqft</span>}
                      </div>
                      <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {pairedLamCount > 0 && (
                          <span style={{ fontSize: '11px', color: '#ec4899', background: 'rgba(236,72,153,0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                            {pairedLamCount} laminate pairing{pairedLamCount !== 1 ? 's' : ''}
                          </span>
                        )}
                        {(mat.printer_compatibility || []).map((p) => (
                          <span key={p} style={{ fontSize: '11px', color: '#a855f7', background: 'rgba(168,85,247,0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                            {p === 'ucjv300' ? 'UCJV300' : p === 'jv330' ? 'JV330' : p}
                          </span>
                        ))}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 3: Select Laminate */}
          {step === 3 && selectedMedia && (
            <div>
              <h2 style={{ color: textPrimary, fontSize: '18px', fontWeight: 600, margin: '0 0 4px' }}>
                Select Laminate for {selectedMedia.name}
              </h2>
              <p style={{ color: textMuted, fontSize: '13px', margin: '0 0 16px' }}>
                {selectedMedia.laminate_pairing_ids?.length
                  ? 'Showing paired laminates for this media'
                  : 'Showing laminates matching this use case'}
              </p>

              {/* Finish filter */}
              {availableFinishes.length > 1 && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: textMuted }}>Filter by finish:</span>
                  <button
                    onClick={() => setSelectedFinish(null)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '6px',
                      border: `1px solid ${!selectedFinish ? 'rgba(34,211,238,0.4)' : borderColor}`,
                      background: !selectedFinish ? 'rgba(34,211,238,0.1)' : 'transparent',
                      color: !selectedFinish ? '#22d3ee' : textMuted,
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    All
                  </button>
                  {availableFinishes.map((f) => (
                    <button
                      key={f}
                      onClick={() => setSelectedFinish(f)}
                      style={{
                        padding: '4px 12px',
                        borderRadius: '6px',
                        border: `1px solid ${selectedFinish === f ? 'rgba(34,211,238,0.4)' : borderColor}`,
                        background: selectedFinish === f ? 'rgba(34,211,238,0.1)' : 'transparent',
                        color: selectedFinish === f ? '#22d3ee' : textMuted,
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                {filteredLaminates.map((lam) => (
                  <button
                    key={lam.id}
                    onClick={() => handleSelectLaminate(lam)}
                    style={{
                      padding: '18px',
                      background: cardBg,
                      border: `1px solid ${borderColor}`,
                      borderRadius: '12px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(236,72,153,0.3)'
                      e.currentTarget.style.background = 'rgba(236,72,153,0.05)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = borderColor
                      e.currentTarget.style.background = cardBg
                    }}
                  >
                    <div style={{ fontSize: '15px', fontWeight: 600, color: textPrimary, marginBottom: '6px' }}>
                      {lam.name}
                    </div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: textSecondary }}>
                      <span>{lam.material_subtype}</span>
                      {lam.finish && <span style={{ color: '#ec4899' }}>{lam.finish}</span>}
                      <span>{lam.thickness_mil} mil</span>
                    </div>
                  </button>
                ))}
                {filteredLaminates.length === 0 && (
                  <div style={{ padding: '30px', background: cardBg, borderRadius: '12px', border: `1px solid ${borderColor}`, textAlign: 'center', gridColumn: '1 / -1' }}>
                    <p style={{ color: textMuted, fontSize: '14px', margin: 0 }}>
                      No laminates {selectedFinish ? `with ${selectedFinish} finish ` : ''}paired with this media. Assign laminate pairings on the Materials List.
                    </p>
                  </div>
                )}
              </div>

              {/* Skip laminate option */}
              <button
                onClick={() => { setSelectedLaminate(null); setStep(4) }}
                style={{
                  marginTop: '12px',
                  padding: '8px 16px',
                  background: 'transparent',
                  border: `1px solid ${borderColor}`,
                  borderRadius: '8px',
                  color: textMuted,
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                Skip — no laminate needed
              </button>
            </div>
          )}

          {/* Step 4: Summary / Recommendation */}
          {step === 4 && selectedMedia && (
            <div>
              <h2 style={{ color: textPrimary, fontSize: '18px', fontWeight: 600, margin: '0 0 20px' }}>
                Your Setup
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                {/* Use Case */}
                <SummaryCard
                  label="Use Case"
                  color="#22d3ee"
                  title={getCategoryLabel(selectedUseCase!)}
                />

                {/* Media */}
                <SummaryCard
                  label="Media"
                  color="#22d3ee"
                  title={selectedMedia.name}
                  details={[
                    `${selectedMedia.material_subtype || '—'} • ${selectedMedia.thickness_mil} mil`,
                    selectedMedia.width_inches ? `${selectedMedia.width_inches}" wide` : null,
                  ].filter(Boolean) as string[]}
                />

                {/* Laminate */}
                <SummaryCard
                  label="Laminate"
                  color="#ec4899"
                  title={selectedLaminate ? selectedLaminate.name : 'None selected'}
                  details={selectedLaminate ? [
                    `${selectedLaminate.material_subtype || '—'} • ${selectedLaminate.finish || 'No finish'} • ${selectedLaminate.thickness_mil} mil`,
                  ] : []}
                />

                {/* Combined Thickness */}
                {selectedLaminate && (
                  <SummaryCard
                    label="Combined Thickness"
                    color="#a855f7"
                    title={`${((selectedMedia.thickness_mil || 0) + (selectedLaminate.thickness_mil || 0)).toFixed(1)} mil`}
                    details={[
                      `Media: ${selectedMedia.thickness_mil} mil + Laminate: ${selectedLaminate.thickness_mil} mil`,
                    ]}
                  />
                )}

                {/* Transfer Tape */}
                <div style={{
                  background: cardBg,
                  borderRadius: '12px',
                  border: `1px solid ${borderColor}`,
                  padding: '18px',
                  borderTop: '3px solid #eab308',
                }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#eab308', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                    Transfer Tape
                  </div>
                  {compatibleTransferTape.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {compatibleTransferTape.map((t) => (
                        <div key={t.id} style={{ fontSize: '14px', color: textPrimary }}>
                          {t.name}
                          <span style={{ fontSize: '12px', color: textMuted, marginLeft: '8px' }}>{t.material_subtype}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '14px', color: textMuted }}>No matching transfer tape</div>
                  )}
                </div>

                {/* Printer Recommendation */}
                <div style={{
                  background: cardBg,
                  borderRadius: '12px',
                  border: `1px solid ${borderColor}`,
                  padding: '18px',
                  borderTop: '3px solid #a855f7',
                }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#a855f7', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                    Printer
                  </div>
                  {recommendedPrinters.map((p) => (
                    <div key={p.id} style={{ marginBottom: '6px' }}>
                      <div style={{ fontSize: '14px', color: textPrimary, fontWeight: 500 }}>
                        {p.brand} {p.name}
                      </div>
                      <div style={{ fontSize: '12px', color: textMuted }}>
                        {p.ink_method === 'on_top' ? 'UV cure — ink sits on top' : 'Eco-solvent — ink embeds into media'}
                      </div>
                    </div>
                  ))}
                  {(selectedMedia.printer_compatibility || []).length === 0 && (
                    <div style={{ fontSize: '12px', color: textMuted, marginTop: '4px', fontStyle: 'italic' }}>
                      No printer preference set for this media — showing all printers
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              {selectedMedia.notes && (
                <div style={{
                  marginTop: '16px',
                  padding: '14px 18px',
                  background: 'rgba(234,179,8,0.05)',
                  border: '1px solid rgba(234,179,8,0.15)',
                  borderRadius: '10px',
                }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#eab308', marginBottom: '4px' }}>Note</div>
                  <div style={{ fontSize: '13px', color: textSecondary }}>{selectedMedia.notes}</div>
                </div>
              )}

              <button
                onClick={resetGuide}
                style={{
                  marginTop: '24px',
                  padding: '12px 24px',
                  background: accentGradient,
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Start New Search
              </button>
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
    </div>
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
