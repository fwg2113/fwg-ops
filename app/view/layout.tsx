import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FWG Portal',
  description: 'Frederick Wraps Customer Portal',
}

export default function ViewLayout({ children }: { children: React.ReactNode }) {
  return children
}
