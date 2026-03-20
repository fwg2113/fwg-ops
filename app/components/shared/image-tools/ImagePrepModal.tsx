'use client'

import { useEffect } from 'react'
import { ProgressBar } from './ProgressBar'
import { useImagePrepState } from './image-prep/useImagePrepState'
import { TopBar } from './image-prep/TopBar'
import { BottomBar } from './image-prep/BottomBar'
import { SidebarTabs } from './image-prep/SidebarTabs'
import { PreviewArea } from './image-prep/PreviewArea'
import { EnhancePanel } from './image-prep/EnhancePanel'
import { CropPanel } from './image-prep/CropPanel'
import { ColorsPanel } from './image-prep/ColorsPanel'
import { StylesPanel } from './image-prep/StylesPanel'
import type { ImagePrepModalProps } from './image-prep/types'

export type { ImagePrepModalProps }

export function ImagePrepModal(props: ImagePrepModalProps) {
  const state = useImagePrepState(props)

  // Body scroll lock
  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original }
  }, [])

  // Escape key closes modal
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onComplete()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [props.onComplete])

  // Null state = no images left
  if (!state) {
    props.onComplete()
    return null
  }

  const { activeTab, handleTabChange, isProcessing, justCompleted } = state

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60">
      {/* Keyframe animations */}
      <style>{`
        @keyframes pulse-red-border {
          0%, 100% { border-color: rgba(228, 30, 49, 0.5); box-shadow: 0 0 0 0 rgba(228, 30, 49, 0); }
          50% { border-color: rgba(228, 30, 49, 1); box-shadow: 0 0 10px 0 rgba(228, 30, 49, 0.15); }
        }
        @keyframes zoom-intro {
          0% { transform: scale(0.95); opacity: 0; }
          60% { transform: scale(1.02); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes ring-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(228, 30, 49, 0); }
          50% { box-shadow: 0 0 8px 2px rgba(228, 30, 49, 0.2); }
        }
      `}</style>

      <div className="relative bg-[#0d1117] rounded-2xl shadow-2xl flex flex-row overflow-hidden border border-white/[0.08]"
        style={{ width: '90vw', height: '90vh', maxWidth: '1400px', maxHeight: '900px' }}
      >
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Top Bar */}
          <TopBar state={state} />

          {/* Content: Preview + Panel side by side */}
          <div className="flex-1 flex flex-row min-h-0">
            {/* Preview Area */}
            <div className="flex-1 min-w-0 min-h-0 flex flex-col">
              <PreviewArea state={state} />
            </div>

            {/* Right Panel: tabs on top + active content below */}
            <div className="w-[340px] flex-shrink-0 border-l border-white/[0.08] flex flex-col min-h-0">
              <SidebarTabs activeTab={activeTab} onChange={handleTabChange} />
              <div className="flex-1 flex flex-col min-h-0">
                {activeTab === 'enhance' && <EnhancePanel state={state} />}
                {activeTab === 'crop' && <CropPanel state={state} />}
                {activeTab === 'colors' && <ColorsPanel state={state} />}
                {activeTab === 'styles' && <StylesPanel />}
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <BottomBar state={state} />

          {/* Progress Bar */}
          <div className="px-5 pb-3">
            <ProgressBar isProcessing={isProcessing} justCompleted={justCompleted} />
          </div>
        </div>
      </div>
    </div>
  )
}
