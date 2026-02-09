import Sidebar from '../components/Sidebar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <style jsx global>{`
        @media (max-width: 768px) {
          .dashboard-sidebar {
            position: fixed !important;
            left: -240px !important;
            z-index: 1000 !important;
            transition: left 0.3s ease !important;
          }
          .dashboard-main {
            margin-left: 0 !important;
            padding: 16px !important;
          }
        }
      `}</style>
      <div style={{ display: 'flex', minHeight: '100vh', background: '#111111' }}>
        <div className="dashboard-sidebar">
          <Sidebar />
        </div>
        <main className="dashboard-main" style={{ flex: 1, marginLeft: '240px', padding: '24px', minWidth: 0, overflowX: 'hidden', width: '100%' }}>
          {children}
        </main>
      </div>
    </>
  )
}