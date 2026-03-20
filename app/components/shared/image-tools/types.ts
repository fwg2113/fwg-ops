/**
 * Shared types for the image tools modal.
 * UploadedImage is compatible with the FA gang-sheet builder's type,
 * but uses the fwg-ops ImageAnalysis interface.
 */

import type { ImageAnalysis } from '@/app/(dashboard)/image-enhancer/utils/analyzeImage'

export type { ImageAnalysis }

export interface UploadedImage {
  id: string
  fileName: string
  originalFile: File
  objectUrl: string
  previewUrl?: string
  svgDataUrl?: string
  nativeWidth: number
  nativeHeight: number
  aspectRatio: number
  isRaster: boolean
  realWidthInches?: number
  realHeightInches?: number
  analysis?: ImageAnalysis
}
