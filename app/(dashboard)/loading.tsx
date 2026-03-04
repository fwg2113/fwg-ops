export default function DashboardLoading() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 'calc(100vh - 48px)',
    }}>
      <div style={{
        width: 40,
        height: 40,
        borderRadius: '50%',
        border: '3px solid rgba(255,255,255,0.08)',
        borderTopColor: '#22d3ee',
        animation: 'dash-spin 0.7s linear infinite',
      }} />
      <style>{`
        @keyframes dash-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
