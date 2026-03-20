import type { UploadedImage } from '../types'

export type ActiveTab = 'enhance' | 'crop' | 'colors' | 'styles'

export type ToolName = 'removeBg' | 'upscale' | 'vectorize' | 'cleanEdges' | 'smoothEdges'

export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

export interface PipelineStep {
  id: string
  label: string
  status: 'completed' | 'active' | 'pending'
}

export interface ImagePrepModalProps {
  images: UploadedImage[]
  onRemoveBg: (imageId: string) => Promise<boolean>
  onUpscale: (imageId: string) => Promise<boolean>
  onVectorize: (imageId: string) => Promise<boolean>
  onCleanEdges?: (imageId: string, threshold: number) => Promise<boolean>
  onSmoothEdges?: (imageId: string, contractionRadius: number, smoothingRadius: number) => Promise<boolean>
  onComplete: () => void
  /** Called when local edits (color replace, crop) need to be applied to the canvas */
  onApplyLocalEdit?: (imageId: string, newDataUrl: string, width: number, height: number) => void
  aiProcessingState: Record<string, { removingBg?: boolean; upscaling?: boolean; vectorizing?: boolean }>
  onSaveToLibrary?: (imageId: string) => void
  isLoggedIn?: boolean
}
