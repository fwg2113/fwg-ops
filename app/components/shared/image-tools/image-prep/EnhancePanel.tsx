'use client'

import type { GradientEdgeSeverity } from '@/app/(dashboard)/image-enhancer/utils/analyzeImage'
import { PipelineIndicator } from './PipelineIndicator'
import { SuggestionCard } from './SuggestionCard'
import { SaveToLibraryCard } from './SaveToLibraryCard'
import type { ImagePrepState } from './useImagePrepState'

// ── Tool Icons ──

function UpscaleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 10v4h4M14 6V2h-4M2 14L7 9M14 2L9 7" />
    </svg>
  )
}

function BgRemoveIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="1" width="14" height="14" rx="2" strokeDasharray="3 2" />
      <path d="M4 12l3-4 2 2 3-4 2 3" />
    </svg>
  )
}

function CleanEdgesIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 8h12M5 4l-3 4 3 4M11 4l3 4-3 4" />
    </svg>
  )
}

function EdgeCleanUpIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 12c2-4 4-6 6-6s4 2 6 6" strokeLinecap="round" />
      <path d="M2 4c2 4 4 6 6 6s4-2 6-6" strokeLinecap="round" opacity="0.4" />
    </svg>
  )
}

function VectorizeIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 2l5 5M9 9l5 5M2 14h4v-4M14 2h-4v4" />
    </svg>
  )
}

// ── Edge Warning ──

const SEVERITY_STYLES: Record<GradientEdgeSeverity, { border: string; bg: string; text: string; icon: string }> = {
  none: { border: 'border-emerald-500/30', bg: 'bg-emerald-900/20', text: 'text-emerald-400', icon: 'text-emerald-500' },
  minor: { border: 'border-yellow-500/30', bg: 'bg-yellow-900/20', text: 'text-yellow-400', icon: 'text-yellow-500' },
  moderate: { border: 'border-orange-500/30', bg: 'bg-orange-900/20', text: 'text-orange-400', icon: 'text-orange-500' },
  heavy: { border: 'border-red-500/30', bg: 'bg-fa-red/10', text: 'text-red-400', icon: 'text-red-500' },
}

function GradientEdgeWarning({ severity, label }: { severity: GradientEdgeSeverity; label: string }) {
  if (severity === 'none') return null
  const s = SEVERITY_STYLES[severity]

  return (
    <div className={`px-3 py-2 rounded-lg border ${s.border} ${s.bg}`}>
      <div className="flex items-start gap-2">
        <svg className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${s.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className={`text-[11px] font-semibold ${s.text}`}>{label}</p>
          <p className="text-[10px] text-white/50 mt-0.5 leading-snug">
            DTF printers place solid white ink behind all visible pixels &mdash; gradient edges will show a visible white outline when heat pressed.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Enhance Panel ──

export function EnhancePanel({ state }: { state: ImagePrepState }) {
  const {
    analysis, aiState, done, isProcessing,
    showUpscale, showBgRemoval, showCleanEdges,
    cleanEdgesDone, showEdgeContraction, edgeContractionLocked,
    showVectorize, vectorizeComplexity, vectorizeHiddenByComplexity,
    noToolsLeft, edgesBlocked, hasGradientEdges,
    edgeCleanupActive, contractionRadius, smoothingRadius,
    frozenMagnifiers, handleClearFrozen,
    handleTool, handleEdgeCleanupOpen, handleContractionChange, handleSmoothingChange,
    handleEdgeCleanupApply, handleEdgeCleanupCancel,
  } = state

  return (
    <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3 min-h-0">
      {/* Pipeline Indicator */}
      <PipelineIndicator state={state} />

      {/* Clear Frozen Windows — shown when frozen magnifiers exist */}
      {frozenMagnifiers.length > 0 && (
        <button
          onClick={handleClearFrozen}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-semibold bg-[#e41e31] text-white transition-all hover:brightness-115 hover:scale-[1.02]"
          style={{ boxShadow: '0 0 12px rgba(228,30,49,0.4)' }}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="2">
            <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
          </svg>
          Clear Frozen Windows ({frozenMagnifiers.length})
        </button>
      )}

      {/* Analysis summary */}
      {analysis && (
        <div className="flex items-center gap-2 flex-wrap text-[11px]">
          {analysis.dpiDetail ? (
            <span className="font-medium text-white/50">{analysis.dpiDetail}</span>
          ) : analysis.dpi > 0 ? (
            <span className="font-medium text-white/50">{analysis.dpiLabel}</span>
          ) : null}
          <span className="text-white/40">{analysis.fileTypeLabel}</span>
          {!analysis.hasTransparency && !analysis.isVector && (
            <span className="text-white/40">Opaque Background</span>
          )}
          {analysis.hasTransparency && (
            <span className="text-emerald-600">Transparent Background</span>
          )}
        </div>
      )}

      {/* Gradient Edge Warning */}
      {analysis && hasGradientEdges && (
        <GradientEdgeWarning
          severity={analysis.gradientEdgeSeverity}
          label={analysis.gradientEdgeLabel}
        />
      )}

      {/* Blocked warning */}
      {edgesBlocked && (
        <p className="text-[11px] text-red-500 text-center">
          Fix transparency edges before proceeding &mdash; they cause visible white outlines on prints
        </p>
      )}

      {/* Upscale */}
      {showUpscale && (
        <SuggestionCard
          icon={<UpscaleIcon />}
          title="Enhance Resolution"
          description={analysis?.dpiDetail
            ? `Current: ${analysis.dpiDetail}. Upscale to 300+ DPI for sharp, crisp prints`
            : 'Upscale to 300+ DPI for sharp, crisp prints'
          }
          badge="recommended"
          isLoading={aiState?.upscaling}
          isComplete={done.has('upscale')}
          disabled={isProcessing || edgeCleanupActive || done.has('upscale')}
          onClick={() => handleTool('upscale')}
        />
      )}

      {/* Remove Background */}
      {showBgRemoval && (
        <SuggestionCard
          icon={<BgRemoveIcon />}
          title="Remove Background"
          description="Removes the background for clean transfer prints"
          badge="recommended"
          isLoading={aiState?.removingBg}
          isComplete={done.has('removeBg')}
          disabled={isProcessing || edgeCleanupActive || done.has('removeBg')}
          onClick={() => handleTool('removeBg')}
        />
      )}

      {/* Transparency Clean Up */}
      {showCleanEdges && (
        <SuggestionCard
          icon={<CleanEdgesIcon />}
          title="Transparency Clean Up"
          description="Remove gradient/feathered edges that cause white ink halos"
          badge={edgesBlocked ? 'fix-required' : 'recommended'}
          isComplete={done.has('cleanEdges')}
          disabled={isProcessing || edgeCleanupActive}
          onClick={() => handleTool('cleanEdges')}
          onRerun={done.has('cleanEdges') ? () => handleTool('cleanEdges') : undefined}
          rerunLabel="Re-run"
          pulseRed={edgesBlocked}
        />
      )}

      {/* Edge Clean Up (contraction + smoothing dual sliders) */}
      {showEdgeContraction && (
        edgeContractionLocked ? (
          <SuggestionCard
            icon={<EdgeCleanUpIcon />}
            title="Edge Clean Up"
            description="Contract and smooth edges for a tighter, cleaner contour"
            badge="optional"
            isLocked
            lockedMessage="Run Transparency Clean Up first"
          />
        ) : edgeCleanupActive ? (
          <SuggestionCard
            icon={<EdgeCleanUpIcon />}
            title="Edge Clean Up"
            description=""
            badge="optional"
          >
            <div className="flex items-center gap-2 mb-3">
              <p className="text-[13px] font-semibold text-white/70">Edge Clean Up</p>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider text-white/30 border border-white/[0.08]">
                Optional
              </span>
            </div>

            {/* Contraction slider */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-white/60">Contraction: {contractionRadius}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={20}
                step={1}
                value={contractionRadius}
                onChange={e => handleContractionChange(Number(e.target.value))}
                className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-fa-red"
              />
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[10px] text-white/30">0</span>
                <span className="text-[10px] text-white/30">20</span>
              </div>
            </div>

            {/* Smoothing slider */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-white/60">Contour Smoothing: {smoothingRadius}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={20}
                step={1}
                value={smoothingRadius}
                onChange={e => handleSmoothingChange(Number(e.target.value))}
                className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-fa-red"
              />
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[10px] text-white/30">0</span>
                <span className="text-[10px] text-white/30">20</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleEdgeCleanupApply}
                disabled={contractionRadius === 0 && smoothingRadius === 0}
                className="flex-1 px-4 py-2 text-[13px] font-semibold rounded-lg bg-fa-red text-white transition-all hover:brightness-115 hover:scale-[1.02] disabled:opacity-40"
              >
                {done.has('smoothEdges') ? 'Re-apply' : 'Apply'}
              </button>
              <button
                onClick={handleEdgeCleanupCancel}
                className="px-4 py-2 text-[13px] font-medium rounded-lg border border-white/10 text-white/50 hover:bg-white/[0.03] transition-colors"
              >
                Cancel
              </button>
            </div>
          </SuggestionCard>
        ) : (
          <SuggestionCard
            icon={<EdgeCleanUpIcon />}
            title="Edge Clean Up"
            description="Contract and smooth edges for a tighter, cleaner contour"
            badge="optional"
            isComplete={done.has('smoothEdges')}
            disabled={isProcessing || done.has('smoothEdges')}
            onClick={handleEdgeCleanupOpen}
          />
        )
      )}

      {/* Vectorize */}
      {showVectorize && (
        <SuggestionCard
          icon={<VectorizeIcon />}
          title="Vectorize"
          description={vectorizeComplexity === 'complex'
            ? 'This image has many colors/gradients \u2014 vectorization may lose detail'
            : 'Convert to infinitely scalable vector format'
          }
          badge={vectorizeComplexity === 'simple' ? 'recommended' : vectorizeComplexity === 'complex' ? 'not-recommended' : null}
          isLoading={aiState?.vectorizing}
          isComplete={done.has('vectorize')}
          disabled={isProcessing || edgeCleanupActive || done.has('vectorize')}
          onClick={() => handleTool('vectorize')}
        />
      )}

      {/* Hidden vectorize info */}
      {vectorizeHiddenByComplexity && (
        <div className="px-4 py-3 rounded-xl border border-white/[0.06] bg-white/[0.03]">
          <p className="text-[11px] text-white/40 leading-snug">
            Vectorization not recommended for this image type. Edge Clean Up will give better results.
          </p>
        </div>
      )}

      {/* All done indicator */}
      {noToolsLeft && (
        <div className="py-3 text-center">
          <div className="inline-flex items-center gap-1.5 text-[13px] font-medium text-emerald-600">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            All improvements applied
          </div>
        </div>
      )}

      {/* Save to Library */}
      <SaveToLibraryCard state={state} />
    </div>
  )
}
