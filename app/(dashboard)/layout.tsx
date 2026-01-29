import Sidebar from '../components/Sidebar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#111111' }}>
      <Sidebar />
      <main style={{ flex: 1, marginLeft: '240px', padding: '24px' }}>
        {children}
      </main>
    </div>
  )
}