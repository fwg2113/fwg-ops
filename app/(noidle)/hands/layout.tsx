import type { Metadata, Viewport } from 'next'
import { DM_Sans } from 'next/font/google'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

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
    <div className={dmSans.className} style={{ minHeight: '100vh', background: '#111113', color: '#f1f5f9' }}>
      {children}
    </div>
  )
}
