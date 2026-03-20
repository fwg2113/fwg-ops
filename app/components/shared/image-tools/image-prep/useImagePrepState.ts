'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { UploadedImage } from '../types'
import type { PreviewBg } from '../PreviewBgSelector'
import { generateEdgeHeatmap } from '@/app/(dashboard)/image-enhancer/utils/analyzeImage'
import type { ActiveTab, ToolName, CropRect, ImagePrepModalProps } from './types'
import { LENS_SIZE, getZoomMultiplier } from './Magnifier'

export interface FrozenMagnifier {
  id: string
  screenX: number
  screenY: number
  nativeX: number
  nativeY: number
  snapshotUrl: string | null
  previewUrl: string | null
}

const MAX_FROZEN = 3

export function useImagePrepState(props: ImagePrepModalProps) {
  const { images, onRemoveBg, onUpscale, onVectorize, onCleanEdges, onSmoothEdges, onComplete, onApplyLocalEdit, aiProcessingState, onSaveToLibrary } = props

  // ── Navigation ──
  const [currentIndex, setCurrentIndex] = useState(0)

  // ── Tab state ──
  const [activeTab, setActiveTab] = useState<ActiveTab>('enhance')

  // ── Tool completion tracking ──
  const [completedTools, setCompletedTools] = useState<Record<string, Set<ToolName>>>({})
  const [justCompleted, setJustCompleted] = useState(false)
  const completedTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // ── Before/after (ref captures synchronously on first encounter) ──
  const originalUrlsRef = useRef<Record<string, string>>({})
  const [baView, setBaView] = useState<'before' | 'after'>('after')

  // ── Preview background ──
  const [previewBg, setPreviewBg] = useState<PreviewBg>('checkerboard')

  // ── Magnifier (on by default) ──
  const [magnifierActive, setMagnifierActive] = useState(true)
  const [zoomLevel, setZoomLevel] = useState(3)
  const magnifierBeforeCropRef = useRef(true)

  // ── Heatmap ──
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [heatmapUrls, setHeatmapUrls] = useState<Record<string, string>>({})
  const [heatmapLoading, setHeatmapLoading] = useState(false)

  // ── Edge Clean Up (contraction + contour smoothing) ──
  const [edgeCleanupActive, setEdgeCleanupActive] = useState(false)
  const [contractionRadius, setContractionRadius] = useState(0)
  const [smoothingRadius, setSmoothingRadius] = useState(0)
  const [edgeCleanupPreviewUrl, setEdgeCleanupPreviewUrl] = useState<string | null>(null)
  const edgeCleanupDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // ── Frozen magnifiers (edge cleanup only) ──
  const [frozenMagnifiers, setFrozenMagnifiers] = useState<FrozenMagnifier[]>([])
  const frozenMagnifiersRef = useRef<FrozenMagnifier[]>([])
  useEffect(() => { frozenMagnifiersRef.current = frozenMagnifiers }, [frozenMagnifiers])

  // ── Save to library ──
  const [savedImages, setSavedImages] = useState<Set<string>>(new Set())
  const [saveDismissed, setSaveDismissed] = useState<Set<string>>(new Set())

  // ── Crop (client-side) ──
  const [cropRect, setCropRect] = useState<CropRect | null>(null)
  const [cropAspectLocked, setCropAspectLocked] = useState(false)
  const [croppedUrls, setCroppedUrls] = useState<Record<string, string>>({})
  const [croppedDims, setCroppedDims] = useState<Record<string, { width: number; height: number }>>({})

  // ── Color tools (client-side) ──
  const [colorReplacedUrls, setColorReplacedUrls] = useState<Record<string, string>>({})

  // ── Timer cleanup ──
  useEffect(() => () => {
    if (completedTimer.current) clearTimeout(completedTimer.current)
    if (edgeCleanupDebounceRef.current) clearTimeout(edgeCleanupDebounceRef.current)
  }, [])

  // ── Auto-show heatmap when navigating to image with gradient edges ──
  useEffect(() => {
    const img = images[currentIndex]
    if (!img?.analysis?.suggestCleanEdges) return
    const alreadyCleaned = (completedTools[img.id] ?? new Set()).has('cleanEdges')
    if (alreadyCleaned) return

    const imageId = img.id
    if (heatmapUrls[imageId]) {
      setShowHeatmap(true)
      return
    }

    let cancelled = false
    setHeatmapLoading(true)
    generateEdgeHeatmap(img.objectUrl, img.nativeWidth, img.nativeHeight)
      .then(url => {
        if (cancelled) return
        setHeatmapUrls(prev => ({ ...prev, [imageId]: url }))
        setShowHeatmap(true)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setHeatmapLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex])

  // ── Current image derivations ──
  const current = images[currentIndex] as UploadedImage | undefined

  // Capture original URL synchronously on first encounter (before any tools run)
  if (current && !originalUrlsRef.current[current.id]) {
    originalUrlsRef.current[current.id] = current.previewUrl ?? current.objectUrl
  }

  if (!current) {
    return null
  }

  const analysis = current.analysis
  const aiState = aiProcessingState[current.id]
  const isProcessing = !!(aiState?.removingBg || aiState?.upscaling || aiState?.vectorizing)
  const done = completedTools[current.id] ?? new Set<ToolName>()
  const hasAppliedAny = done.size > 0

  const originalUrl = originalUrlsRef.current[current.id]
  const currentDisplayUrl = croppedUrls[current.id] ?? colorReplacedUrls[current.id] ?? current.previewUrl ?? current.objectUrl
  const hasBeforeAfter = hasAppliedAny && !!originalUrl && originalUrl !== currentDisplayUrl

  // Display URL priority: heatmap > edge cleanup preview > before view > current
  let displayUrl: string
  if (showHeatmap && heatmapUrls[current.id]) {
    displayUrl = heatmapUrls[current.id]
  } else if (edgeCleanupActive && edgeCleanupPreviewUrl) {
    displayUrl = edgeCleanupPreviewUrl
  } else if (hasBeforeAfter && baView === 'before') {
    displayUrl = originalUrl
  } else {
    displayUrl = currentDisplayUrl
  }

  // ── Tool visibility ──
  // Show tools when suggested by analysis (keep visible even after completed to show green checkmark)
  const showUpscale = !!analysis?.suggestUpscale
  const showBgRemoval = !!analysis?.suggestBgRemoval
  const showCleanEdges = (!!analysis?.suggestCleanEdges || (analysis?.gradientEdgeSeverity !== 'none' && !!analysis?.hasTransparency)) && !!onCleanEdges
  const cleanEdgesDone = done.has('cleanEdges')
  const showEdgeContraction = current.isRaster && !!analysis?.hasTransparency
    && !analysis?.isVector && !!onSmoothEdges
    && (showCleanEdges || cleanEdgesDone)
  const edgeContractionLocked = showEdgeContraction && !cleanEdgesDone
  const vectorizeComplexity = analysis?.vectorizeComplexity ?? 'complex'
  const showVectorize = !!analysis?.suggestVectorize
    && vectorizeComplexity !== 'very_complex'
  const vectorizeHiddenByComplexity = !!analysis?.suggestVectorize && !done.has('vectorize')
    && vectorizeComplexity === 'very_complex' && !analysis?.isVector
  const hasGradientEdges = analysis ? analysis.gradientEdgeSeverity !== 'none' : false
  // "No tools left" only when every shown tool is completed
  const noToolsLeft = (!showBgRemoval || done.has('removeBg'))
    && (!showUpscale || done.has('upscale'))
    && (!showVectorize || done.has('vectorize'))
    && (!showCleanEdges || done.has('cleanEdges'))
    && (!showEdgeContraction || done.has('smoothEdges'))
    && !vectorizeHiddenByComplexity
  // Warn (but don't block) when clean edges is suggested and not yet done
  const edgesBlocked = false
  const edgesWarning = showCleanEdges && !done.has('cleanEdges') && (analysis?.gradientEdgeSeverity === 'moderate' || analysis?.gradientEdgeSeverity === 'heavy')

  // ── Handlers ──
  const markDone = useCallback((imageId: string, tool: ToolName) => {
    setCompletedTools(prev => {
      const existing = prev[imageId] ?? new Set<ToolName>()
      const next = new Set(existing)
      next.add(tool)
      return { ...prev, [imageId]: next }
    })
  }, [])

  const flashCompleted = useCallback(() => {
    setJustCompleted(true)
    if (completedTimer.current) clearTimeout(completedTimer.current)
    completedTimer.current = setTimeout(() => setJustCompleted(false), 1400)
  }, [])

  const handleTool = useCallback(async (tool: ToolName) => {
    let success = false
    if (tool === 'removeBg') success = await onRemoveBg(current.id)
    else if (tool === 'upscale') success = await onUpscale(current.id)
    else if (tool === 'vectorize') success = await onVectorize(current.id)
    else if (tool === 'cleanEdges' && onCleanEdges) success = await onCleanEdges(current.id, 50)
    if (success) {
      markDone(current.id, tool)
      flashCompleted()
      setBaView('after')
      setShowHeatmap(false)
    }
  }, [current.id, onRemoveBg, onUpscale, onVectorize, onCleanEdges, markDone, flashCompleted])

  const handleToggleHeatmap = useCallback(async () => {
    if (showHeatmap) {
      setShowHeatmap(false)
      return
    }
    if (!heatmapUrls[current.id]) {
      setHeatmapLoading(true)
      try {
        const url = await generateEdgeHeatmap(current.objectUrl, current.nativeWidth, current.nativeHeight)
        setHeatmapUrls(prev => ({ ...prev, [current.id]: url }))
      } catch {
        return
      } finally {
        setHeatmapLoading(false)
      }
    }
    setShowHeatmap(true)
  }, [showHeatmap, heatmapUrls, current])

  // ── Tab change handler (disables magnifier on crop) ──
  const handleTabChange = useCallback((tab: ActiveTab) => {
    if (tab === 'crop') {
      magnifierBeforeCropRef.current = magnifierActive
      setMagnifierActive(false)
    } else if (activeTab === 'crop') {
      setMagnifierActive(magnifierBeforeCropRef.current)
    }
    setActiveTab(tab)
  }, [activeTab, magnifierActive])

  // ── Edge Clean Up handlers ──
  const handleEdgeCleanupOpen = useCallback(() => {
    setEdgeCleanupActive(true)
    setContractionRadius(0)
    setSmoothingRadius(0)
    setEdgeCleanupPreviewUrl(null)
    setFrozenMagnifiers([])
  }, [])

  // Generate frozen magnifier zoom previews for given positions
  const generateFrozenPreviews = useCallback(async (
    positions: FrozenMagnifier[],
    contraction: number,
    smoothing: number,
    imgUrl: string,
    nativeW: number,
    nativeH: number,
  ) => {
    if (positions.length === 0) return
    const regionSize = Math.round(LENS_SIZE / getZoomMultiplier(zoomLevel))
    try {
      const { generateZoomPreview } = await import('@/app/(dashboard)/image-enhancer/utils/edgeSmoothing')
      const previews = await Promise.all(
        positions.map(fm => {
          const region = {
            x: Math.max(0, Math.min(nativeW - regionSize, Math.round(fm.nativeX - regionSize / 2))),
            y: Math.max(0, Math.min(nativeH - regionSize, Math.round(fm.nativeY - regionSize / 2))),
            size: regionSize,
          }
          return generateZoomPreview(imgUrl, nativeW, nativeH, region, contraction, smoothing, getZoomMultiplier(zoomLevel))
        })
      )
      setFrozenMagnifiers(prev =>
        prev.map(fm => {
          const idx = positions.findIndex(p => p.id === fm.id)
          return idx >= 0 ? { ...fm, previewUrl: previews[idx] ?? null } : fm
        })
      )
    } catch {
      // Preview generation failed
    }
  }, [zoomLevel])

  // Shared debounced preview generator for both sliders
  const generateEdgeCleanupPreview = useCallback((contraction: number, smoothing: number) => {
    if (edgeCleanupDebounceRef.current) clearTimeout(edgeCleanupDebounceRef.current)

    if (contraction === 0 && smoothing === 0) {
      setEdgeCleanupPreviewUrl(null)
      // Clear frozen previews back to null
      setFrozenMagnifiers(prev => prev.map(fm => ({ ...fm, previewUrl: null })))
      return
    }

    edgeCleanupDebounceRef.current = setTimeout(async () => {
      try {
        const { previewEdgeSmoothing } = await import('@/app/(dashboard)/image-enhancer/utils/edgeSmoothing')
        const preview = await previewEdgeSmoothing(current.objectUrl, current.nativeWidth, current.nativeHeight, contraction, smoothing)
        setEdgeCleanupPreviewUrl(preview)

        // Generate frozen magnifier previews
        const frozen = frozenMagnifiersRef.current
        if (frozen.length > 0) {
          await generateFrozenPreviews(frozen, contraction, smoothing, current.objectUrl, current.nativeWidth, current.nativeHeight)
        }
      } catch {
        // Preview generation failed
      }
    }, 150)
  }, [current, generateFrozenPreviews])

  const handleContractionChange = useCallback((value: number) => {
    setContractionRadius(value)
    generateEdgeCleanupPreview(value, smoothingRadius)
  }, [smoothingRadius, generateEdgeCleanupPreview])

  const handleSmoothingChange = useCallback((value: number) => {
    setSmoothingRadius(value)
    generateEdgeCleanupPreview(contractionRadius, value)
  }, [contractionRadius, generateEdgeCleanupPreview])

  // Freeze a magnifier at screen + native coordinates (max 3)
  const handleFreezeClick = useCallback((screenX: number, screenY: number, nativeX: number, nativeY: number, snapshotUrl: string | null) => {
    setFrozenMagnifiers(prev => {
      if (prev.length >= MAX_FROZEN) return prev
      const fm: FrozenMagnifier = {
        id: `frozen-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        screenX,
        screenY,
        nativeX,
        nativeY,
        snapshotUrl,
        previewUrl: null,
      }
      return [...prev, fm]
    })

    // If sliders are non-zero, immediately generate a processed preview for the new position
    if (contractionRadius > 0 || smoothingRadius > 0) {
      const regionSize = Math.round(LENS_SIZE / getZoomMultiplier(zoomLevel))
      const region = {
        x: Math.max(0, Math.min(current.nativeWidth - regionSize, Math.round(nativeX - regionSize / 2))),
        y: Math.max(0, Math.min(current.nativeHeight - regionSize, Math.round(nativeY - regionSize / 2))),
        size: regionSize,
      }
      import('@/app/(dashboard)/image-enhancer/utils/edgeSmoothing').then(({ generateZoomPreview }) =>
        generateZoomPreview(current.objectUrl, current.nativeWidth, current.nativeHeight, region, contractionRadius, smoothingRadius, getZoomMultiplier(zoomLevel))
      ).then(url => {
        setFrozenMagnifiers(prev => {
          // Update the most recently added item that has no preview
          const idx = prev.findIndex(fm => fm.nativeX === nativeX && fm.nativeY === nativeY && !fm.previewUrl)
          if (idx < 0) return prev
          const updated = [...prev]
          updated[idx] = { ...updated[idx], previewUrl: url }
          return updated
        })
      }).catch(() => {})
    }
  }, [current, contractionRadius, smoothingRadius, zoomLevel])

  const handleClearFrozen = useCallback(() => {
    setFrozenMagnifiers([])
  }, [])

  const handleEdgeCleanupApply = useCallback(async () => {
    if (!onSmoothEdges) return
    if (contractionRadius === 0 && smoothingRadius === 0) return
    const success = await onSmoothEdges(current.id, contractionRadius, smoothingRadius)
    if (success) {
      markDone(current.id, 'smoothEdges')
      flashCompleted()
      // Keep panel open — clear preview (actual image was updated by parent), clear frozen magnifiers
      setEdgeCleanupPreviewUrl(null)
      setFrozenMagnifiers([])
      setBaView('after')
    }
  }, [current.id, onSmoothEdges, contractionRadius, smoothingRadius, markDone, flashCompleted])

  const handleEdgeCleanupCancel = useCallback(() => {
    setEdgeCleanupActive(false)
    setContractionRadius(0)
    setSmoothingRadius(0)
    setEdgeCleanupPreviewUrl(null)
    setFrozenMagnifiers([])
  }, [])

  // ── Save to library ──
  const handleSaveClick = useCallback((imageId: string) => {
    if (onSaveToLibrary) {
      onSaveToLibrary(imageId)
      setSavedImages(prev => new Set(prev).add(imageId))
    }
  }, [onSaveToLibrary])

  const handleSaveDismiss = useCallback((imageId: string) => {
    setSaveDismissed(prev => new Set(prev).add(imageId))
  }, [])

  // ── Crop handlers ──
  const handleApplyCrop = useCallback(async () => {
    if (!cropRect || !current) return
    const canvas = document.createElement('canvas')
    canvas.width = cropRect.width
    canvas.height = cropRect.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = reject
      img.src = current.previewUrl ?? current.objectUrl
    })
    ctx.drawImage(img, cropRect.x, cropRect.y, cropRect.width, cropRect.height, 0, 0, cropRect.width, cropRect.height)
    const dataUrl = canvas.toDataURL('image/png')
    setCroppedUrls(prev => ({ ...prev, [current.id]: dataUrl }))
    setCroppedDims(prev => ({ ...prev, [current.id]: { width: cropRect.width, height: cropRect.height } }))
    setCropRect(null)

    // Push cropped image to the canvas immediately
    if (onApplyLocalEdit) {
      onApplyLocalEdit(current.id, dataUrl, cropRect.width, cropRect.height)
    }
  }, [cropRect, current, onApplyLocalEdit])

  const handleResetCrop = useCallback(() => {
    if (!current) return
    setCroppedUrls(prev => {
      const next = { ...prev }
      delete next[current.id]
      return next
    })
    setCroppedDims(prev => {
      const next = { ...prev }
      delete next[current.id]
      return next
    })
    setCropRect(null)
  }, [current])

  // ── Navigation ──
  const advance = useCallback(() => {
    setJustCompleted(false)
    setBaView('after')
    setShowHeatmap(false)
    setEdgeCleanupActive(false)
    setContractionRadius(0)
    setSmoothingRadius(0)
    setEdgeCleanupPreviewUrl(null)
    setFrozenMagnifiers([])
    setActiveTab('enhance')
    setMagnifierActive(true)
    setCropRect(null)
    if (currentIndex < images.length - 1) {
      setCurrentIndex(prev => prev + 1)
    } else {
      onComplete()
    }
  }, [currentIndex, images.length, onComplete])

  return {
    // Navigation
    currentIndex,
    current,
    advance,

    // Tab
    activeTab,
    setActiveTab,
    handleTabChange,

    // Tool state
    completedTools,
    done,
    isProcessing,
    justCompleted,
    hasAppliedAny,
    noToolsLeft,
    handleTool,

    // Before/after
    originalUrl,
    baView,
    setBaView,
    hasBeforeAfter,

    // Preview
    previewBg,
    setPreviewBg,
    displayUrl,
    currentDisplayUrl,

    // Magnifier
    magnifierActive,
    setMagnifierActive,
    zoomLevel,
    setZoomLevel,

    // Heatmap
    showHeatmap,
    setShowHeatmap,
    heatmapUrls,
    heatmapLoading,
    handleToggleHeatmap,
    hasGradientEdges,

    // Edge Clean Up (contraction + contour smoothing)
    edgeCleanupActive,
    contractionRadius,
    smoothingRadius,
    edgeCleanupPreviewUrl,
    frozenMagnifiers,
    handleEdgeCleanupOpen,
    handleContractionChange,
    handleSmoothingChange,
    handleFreezeClick,
    handleClearFrozen,
    handleEdgeCleanupApply,
    handleEdgeCleanupCancel,

    // Tool visibility
    showUpscale,
    showBgRemoval,
    showCleanEdges,
    cleanEdgesDone,
    showEdgeContraction,
    edgeContractionLocked,
    showVectorize,
    vectorizeComplexity,
    vectorizeHiddenByComplexity,
    edgesBlocked,
    edgesWarning,

    // Analysis
    analysis,
    aiState,

    // Save to library
    savedImages,
    saveDismissed,
    handleSaveClick,
    handleSaveDismiss,

    // Crop
    cropRect,
    setCropRect,
    cropAspectLocked,
    setCropAspectLocked,
    croppedUrls,
    croppedDims,
    handleApplyCrop,
    handleResetCrop,

    // Color tools
    colorReplacedUrls,
    setColorReplacedUrls,
    onApplyLocalEdit,

    // Props passthrough
    images,
    onComplete,
    onSaveToLibrary,
    isLoggedIn: props.isLoggedIn,
  }
}

export type ImagePrepState = NonNullable<ReturnType<typeof useImagePrepState>>
