'use client'

import { useRef, useCallback } from 'react'

export default function ModalBackdrop({
  children,
  onClose,
  zIndex = 9999,
}: {
  children: React.ReactNode
  onClose: () => void
  zIndex?: number
}) {
  const mouseDownTarget = useRef<EventTarget | null>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    mouseDownTarget.current = e.target
  }, [])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    // Only close if both mousedown AND mouseup happened on the backdrop itself
    // This prevents closing when dragging text selection from inside the modal to outside
    if (mouseDownTarget.current === e.currentTarget && e.target === e.currentTarget) {
      onClose()
    }
    mouseDownTarget.current = null
  }, [onClose])

  return (
    <div
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex,
      }}
    >
      {children}
    </div>
  )
}
