import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'No Idle Hands',
  description: 'FWG Team Task Board — things to tackle when the day\'s work is done',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function HandsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#111111', color: '#f1f5f9', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {children}
    </div>
  )
}
