'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'

const navSections = [
  {
    title: 'CORE',
    items: [
      { href: '/', label: 'Command', labelGradient: 'Center', icon: 'grid', badgeKey: 'actions' },
      { href: '/submissions', label: 'Lead', labelGradient: 'Pipeline', icon: 'activity' },
    ]
  },
  {
    title: 'SALES',
    items: [
      { href: '/quotes', label: 'Quote', labelGradient: 'Builder', icon: 'document' },
      { href: '/invoices', label: 'Invoice', labelGradient: 'Manager', icon: 'receipt' },
      { href: '/payments', label: 'Payment', labelGradient: 'History', icon: 'dollar', badgeKey: 'payments' },
    ]
  },
  {
    title: 'COMMUNICATION',
    items: [
      { href: '/customers', label: 'Customer', labelGradient: 'Database', icon: 'users' },
      { href: '/messages', label: 'Message', labelGradient: 'Hub', icon: 'chat', badgeKey: 'messages' },
      { href: '/email', label: 'Email', labelGradient: 'Inbox', icon: 'mail', badgeKey: 'email' },
      { href: '/transfer', label: 'Call', labelGradient: 'Management', icon: 'phone' },
    ]
  },
  {
    title: 'FREDERICK APPAREL',
    items: [
      { href: '/fa-orders', label: 'FA', labelGradient: 'Orders', icon: 'shirt', badgeKey: 'fa-orders' },
      { href: '/purchase-orders', label: 'Purchase', labelGradient: 'Orders', icon: 'truck', badgeKey: 'purchase-orders' },
      { href: '/image-enhancer', label: 'Image', labelGradient: 'Enhancer', icon: 'sparkle' },
    ]
  },
  {
    title: 'PRODUCTION',
    items: [
      { href: '/calendar', label: 'Job', labelGradient: 'Calendar', icon: 'calendar' },
      { href: '/tasks', label: 'Task', labelGradient: 'Board', icon: 'tasks' },
      { href: '/production', label: 'Production', labelGradient: 'Flow', icon: 'layers' },
      { href: '/analytics', label: 'Production', labelGradient: 'Analytics', icon: 'chart' },
    ]
  },
  {
    title: 'ACCOUNT',
    items: [
      { href: '/dev', label: 'Dev', labelGradient: 'Requests', icon: 'bug' },
      { href: '/archive', label: 'Project', labelGradient: 'Archive', icon: 'archive' },
      { href: '/settings', label: 'System', labelGradient: 'Settings', icon: 'cog', badge: '' },
    ]
  }
]

const icons: Record<string, React.ReactElement> = {
  grid: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
      <rect x="3" y="3" width="7" height="7"></rect>
      <rect x="14" y="3" width="7" height="7"></rect>
      <rect x="14" y="14" width="7" height="7"></rect>
      <rect x="3" y="14" width="7" height="7"></rect>
    </svg>
  ),
  activity: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
    </svg>
  ),
  document: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
    </svg>
  ),
  receipt: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
      <line x1="1" y1="10" x2="23" y2="10"></line>
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
      <line x1="16" y1="2" x2="16" y2="6"></line>
      <line x1="8" y1="2" x2="8" y2="6"></line>
      <line x1="3" y1="10" x2="21" y2="10"></line>
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
  ),
  layers: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
      <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
      <polyline points="2 17 12 22 22 17"></polyline>
      <polyline points="2 12 12 17 22 12"></polyline>
    </svg>
  ),
  tasks: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
      <rect x="3" y="5" width="18" height="4" rx="1"></rect>
      <rect x="3" y="11" width="18" height="4" rx="1"></rect>
      <rect x="3" y="17" width="18" height="4" rx="1"></rect>
    </svg>
  ),
  cog: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
  ),
  dollar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
      <line x1="12" y1="1" x2="12" y2="23"></line>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
    </svg>
  ),
  mail: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
      <polyline points="22,6 12,13 2,6"></polyline>
    </svg>
  ),
  archive: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
      <polyline points="21 8 21 21 3 21 3 8"></polyline>
      <rect x="1" y="3" width="22" height="5"></rect>
      <line x1="10" y1="12" x2="14" y2="12"></line>
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
      <line x1="18" y1="20" x2="18" y2="10"></line>
      <line x1="12" y1="20" x2="12" y2="4"></line>
      <line x1="6" y1="20" x2="6" y2="14"></line>
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
    </svg>
  ),
  truck: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
      <rect x="1" y="3" width="15" height="13" rx="2" ry="2"></rect>
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
      <circle cx="5.5" cy="18.5" r="2.5"></circle>
      <circle cx="18.5" cy="18.5" r="2.5"></circle>
    </svg>
  ),
  shirt: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
      <path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"></path>
    </svg>
  ),
  sparkle: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
      <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z"></path>
    </svg>
  ),
  bug: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
      <path d="M8 2l1.88 1.88"></path>
      <path d="M14.12 3.88L16 2"></path>
      <path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"></path>
      <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"></path>
      <path d="M12 20v-9"></path>
      <path d="M6.53 9C4.6 8.8 3 7.1 3 5"></path>
      <path d="M6 13H2"></path>
      <path d="M3 21c0-2.1 1.7-3.9 3.8-4"></path>
      <path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"></path>
      <path d="M22 13h-4"></path>
      <path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"></path>
    </svg>
  ),
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [unreadCounts, setUnreadCounts] = useState<{ messages: number; email: number; payments: number; actions: number; 'purchase-orders': number; 'fa-orders': number }>({ messages: 0, email: 0, payments: 0, actions: 0, 'purchase-orders': 0, 'fa-orders': 0 })
  const [handsStats, setHandsStats] = useState<{ availablePoints: number; leaders: { id: string; name: string; avatar_color: string; total_points: number }[] }>({ availablePoints: 0, leaders: [] })

  const fetchUnreadCounts = useCallback(async () => {
    try {
      const [msgRes, emailRes, payRes, actionsRes, poRes, faRes] = await Promise.all([
        fetch('/api/messages/unread-count'),
        fetch('/api/gmail/unread-count'),
        fetch('/api/payments/unread-count'),
        fetch('/api/customer-actions/count'),
        fetch('/api/purchase-orders/active-count'),
        fetch('/api/fa-orders/active-count'),
      ])
      const [msgData, emailData, payData, actionsData, poData, faData] = await Promise.all([
        msgRes.json(), emailRes.json(), payRes.json(), actionsRes.json(), poRes.json(), faRes.json(),
      ])

      setUnreadCounts({
        messages: msgData.count || 0,
        email: emailData.count || 0,
        payments: payData.count || 0,
        actions: actionsData.count || 0,
        'purchase-orders': poData.count || 0,
        'fa-orders': faData.count || 0,
      })
    } catch (err) {
      console.error('Failed to fetch unread counts:', err)
    }
  }, [])

  const fetchHandsStats = useCallback(async () => {
    try {
      const res = await fetch('/api/noidle/sidebar-stats')
      const data = await res.json()
      setHandsStats({ availablePoints: data.availablePoints || 0, leaders: data.leaders || [] })
    } catch (err) {
      console.error('Failed to fetch hands stats:', err)
    }
  }, [])

  useEffect(() => {
    fetchUnreadCounts()
    fetchHandsStats()
    // Refresh every 60 seconds
    const interval = setInterval(fetchUnreadCounts, 60000)
    const handsInterval = setInterval(fetchHandsStats, 120000)
    // Also refresh on window focus
    const handleFocus = () => { fetchUnreadCounts(); fetchHandsStats() }
    const handleUnreadChange = () => fetchUnreadCounts()
    window.addEventListener('focus', handleFocus)
    window.addEventListener('unread-counts-changed', handleUnreadChange)
    return () => {
      clearInterval(interval)
      clearInterval(handsInterval)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('unread-counts-changed', handleUnreadChange)
    }
  }, [fetchUnreadCounts, fetchHandsStats])

  const handleLogout = () => {
    document.cookie = 'fwg_auth=; path=/; max-age=0'
    localStorage.removeItem('fwg_user')
    window.location.href = '/login'
  }

  const gradientStyle = {
    background: 'linear-gradient(90deg, #22d3ee, #a855f7, #ec4899)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  }

  return (
    <div style={{
      width: '240px',
      height: '100vh',
      background: '#111111',
      borderRight: '1px solid rgba(255,255,255,0.08)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Logo Header */}
      <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            background: 'linear-gradient(135deg, #06b6d4, #ec4899)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 26, height: 26 }}>
              <rect x="1" y="3" width="15" height="13" rx="2" ry="2"></rect>
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
              <circle cx="5.5" cy="18.5" r="2.5"></circle>
              <circle cx="18.5" cy="18.5" r="2.5"></circle>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#f1f5f9' }}>
              Frederick <span style={gradientStyle}>Wraps</span>
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280', letterSpacing: '0.5px' }}>
              Operations Hub
            </div>
          </div>
          <button
            onClick={() => {
              setIsRefreshing(true)
              router.refresh()
              setTimeout(() => setIsRefreshing(false), 800)
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#6b7280',
              padding: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#22d3ee' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#6b7280' }}
            aria-label="Refresh page"
            title="Refresh page"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{
              width: 18,
              height: 18,
              animation: isRefreshing ? 'spin 0.6s linear infinite' : 'none',
            }}>
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '16px 0', overflowY: 'auto' }}>
        {/* No Idle Hands Widget */}
        <div style={{ padding: '0 16px 12px', marginBottom: '4px' }}>
          <a
            href="https://hands.frederickwraps.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 12px',
              background: 'linear-gradient(135deg, rgba(34,211,238,0.12), rgba(168,85,247,0.12), rgba(236,72,153,0.12))',
              border: '1px solid rgba(168,85,247,0.2)',
              borderRadius: '10px',
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <svg
              width={28}
              height={28}
              viewBox="0 0 50000 50000"
              xmlns="http://www.w3.org/2000/svg"
              style={{ shapeRendering: 'geometricPrecision', flexShrink: 0 }}
            >
              <defs>
                <linearGradient id="sidebarHandGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#22d3ee" />
                  <stop offset="50%" stopColor="#a855f7" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
              </defs>
              <path
                fill="url(#sidebarHandGrad)"
                fillRule="nonzero"
                d="M27910.7 44254.29c0,371.23 -564.46,371.23 -564.46,0 0,-905.42 -411.1,-2072.39 -905.18,-3474.88 -332.44,-943.68 -701.41,-1991.2 -1012.31,-3145.23 -536.6,-1453.34 -406.49,-1126.04 -857.98,1.49 -310.77,1153.47 -679.54,2200.48 -1011.83,3143.74 -494.08,1402.49 -905.18,2569.46 -905.18,3474.88 0,371.23 -564.46,371.23 -564.46,0 0,-998.94 426.12,-2208.57 938.26,-3662.3 124.93,-354.61 255.11,-724.24 385.33,-1108.66 -274.79,281.37 -562.09,511.72 -856.71,766.01 -279.52,241.87 -647.77,-183.68 -368.23,-425.56 811.74,-700.52 1495.24,-1286.24 1845.41,-2360.57 390.43,-1455.2 684.7,-3077.57 685.5,-4865.77 0.92,-2036.51 -333.63,-3840.85 -649.71,-5545.7 -223.51,-1205.43 -437.89,-2361.98 -521.95,-3524.49 -26.08,-237.41 -64.98,-447.62 -140.83,-612.07 -74.23,-160.93 -188.33,-279.55 -371.18,-338.08 -211.4,-67.83 -108.29,-389.32 103.18,-321.47 152.79,48.91 274.34,123.66 371.67,220.15 0.88,-197.59 6.47,-395.8 17.44,-594.92l602.14 -10926.35c34.53,-626.53 -31.04,-1267.33 -268.63,-1756.96 -180.02,-370.98 -464.34,-654.43 -888.31,-768.83 -256.26,-69.16 -540.95,-106.89 -794.2,-27.67 -285.7,89.36 -245.94,150.65 -292.94,415.53l-2201.19 12404.6c-40.51,228.32 -75.68,179.34 126.28,245.19 96.61,31.52 187.58,67.55 269.47,108.12 199.24,98.3 49.78,401.28 -149.49,302.96 -348.44,-172.64 -890.92,-248.99 -1277.29,-240.26 -221.9,4.34 -228.44,-333.02 -6.62,-337.34 86.59,-1.96 179.7,0.01 276.28,5.87 206.84,12.54 164.64,50.08 202.3,-162.18l2198.12 -12387.25c182.35,-1027.69 484.07,-2593.96 -435.72,-3308.4 -442.19,-343.48 -1136.57,-446.53 -1649.58,-204.75 146.05,566.93 115.75,1257.72 14.9,1929.17 -111.17,740.2 -310.86,1468 -445.78,1958.52l-3184.5 11576.94c-52.59,191.2 -63.08,141.68 134.63,180.92 146.24,29.04 274.37,63 373.48,99.88 207.95,77.43 90.21,393.63 -117.75,316.19 -405.01,-150.7 -1165.78,-196.14 -1587.6,-170.64 -221.88,13.04 -241.69,-324.3 -19.84,-337.34 142.06,-8.59 290.84,-10.19 439.91,-6 200.87,5.66 159.8,41.79 213.84,-154.65l3205.43 -11653.03c129.72,-471.62 321.73,-1171.47 430.33,-1894.58 103.79,-690.93 128.97,-1392.05 -62.17,-1891.52 -395.48,-1033.45 -2080.36,-1051.36 -2659.59,-76.57 -203.15,341.88 -375.18,754.45 -553.96,1300.24 -183.55,560.37 -371.36,1249.28 -602.91,2133.25 -59.6,235.37 -126.22,473.29 -196.9,711.09l-3309.58 11133.65c-58.28,196.11 -66.98,143.92 137.67,176.93 131.52,21.21 264.15,49.91 398.58,85.39 214.89,56.54 128.95,383.34 -86,326.78 -619.87,-163.6 -1188.76,-170.04 -1792.4,63.89 -207.08,80.06 -328.79,-234.8 -121.72,-314.85 222.03,-86.05 440.44,-143.27 658.38,-174.82 225.95,-32.69 163.68,19.75 226.77,-192.49l3348.09 -11263.23c268.78,-904.23 475.8,-1801.33 442.29,-2510.71 -65.26,-1381.69 -1347.99,-1742.62 -2291.5,-894.75 -564.64,507.44 -1138.26,1476.92 -1671.95,3150.58l-3566.57 11184.7c6.3,333.23 4.01,674.22 1.64,1027.7 -4.38,653.02 -9.04,1349.79 43.07,2138.32 74,1119.66 334.2,1767.71 615.81,2469.12 255.51,636.39 527.78,1314.52 707.73,2402.14 24.96,153.44 -79.18,298.06 -232.61,323.02 -153.43,24.96 -298.06,-79.18 -323.02,-232.61 -169.62,-1025.15 -430.16,-1674.09 -674.68,-2283.09 -242.93,-605.08 -470.86,-1172.78 -590.76,-2012.8 -134.25,239.22 -325.48,433.49 -580.91,598.29 -186.85,119.91 -369.39,-164.54 -182.57,-284.45 244.91,-158.01 415.75,-346.61 521.97,-586.13 67.15,-151.41 109.99,-324.65 130.75,-524.47 61.54,-592.13 -1.22,-1382.97 2.97,-2009.55 3.18,-476.17 6.23,-929.16 -12.89,-1377.75 -128.41,-3001.07 -3836.35,-2632.26 -3669.39,955.09 11.12,584.61 -138.13,1577.6 -266.18,2429.66 -87.78,584.02 -165.43,1100.6 -171.72,1335.66 -39.37,1469.3 405.69,3067.86 575.08,4556.95 452.54,3977.69 1537.47,5998.9 2616.11,7488.62 315.96,409.87 699.82,787.51 1154.13,1127.68 446,333.95 962.78,633.32 1552.96,893.3 339.33,149.36 112.22,665.33 -227.12,515.96 -316.8,-139.56 -615.03,-290.86 -895.03,-453.18 1075.16,1136.91 1597.57,1913.79 1203.18,5820.53 -63.81,365.44 -619.44,268.42 -555.63,-97.01 557.72,-4564.51 -499.8,-4675.2 -1924.43,-6480.75 -247.23,-313.34 -502.97,-637.5 -759.2,-990.07l-4.04 -5.54c-1121.6,-1544.52 -2252.04,-3636.01 -2720.98,-7757.81 -173.65,-1526.41 -617.84,-3117.4 -577.28,-4631.91 7.63,-285.26 86.73,-811.4 176.13,-1406.22 125.53,-835.25 271.82,-1808.64 261.77,-2337.04 -75.12,-3945.46 3744.63,-4776.7 4635.83,-1930.68l3200.09 -10035.47c568.18,-1781.79 1198.96,-2831.98 1830.71,-3399.73 1040.42,-934.98 2733.82,-777.24 3135.31,657.44 156.78,-439.79 315.73,-795.67 499.84,-1105.51 751.19,-1264.2 2764.9,-1348.09 3535.11,-111.97 698.04,-318 1610.03,-185.71 2210.42,280.67 728.94,566.21 868.48,1542.12 848.47,2314.86 -17.24,666.81 -171.74,490.21 359.44,476.67 227.6,-5.79 457.14,30.91 676.44,90.08 601.81,162.4 1001.07,555.9 1249.92,1068.7 283.3,583.82 362.91,1321.68 323.75,2032.58l-602.14 10926.34c-91.95,1668.71 210.86,3301.91 532.86,5038.59 130.83,705.65 264.77,1428.12 377.41,2178.34 355.81,-2369.76 1042.23,-4822.11 910.27,-7216.93l-602.14 -10926.34c-83.86,-1522.29 506.59,-3396.67 2400.29,-3181.16 297.59,33.84 245.14,124.77 227.04,-192.81 -109.46,-1916.49 1109.17,-3769.69 3041.11,-2889.59 770.21,-1236.12 2783.92,-1152.23 3535.11,111.97 184.11,309.84 343.06,665.72 499.84,1105.51 401.49,-1434.68 2094.89,-1592.42 3135.31,-657.44 631.75,567.75 1262.53,1617.94 1830.71,3399.73l3200.09 10035.47c757.54,-2419.18 3605.81,-2126.46 4401.35,241.35 320.8,954.74 323.61,2877.71 496.25,4026.37 232.62,1547.71 216.74,2264.08 -67.93,3840.92 -103.48,573.17 -225.07,1246.56 -333.22,2197.21 -468.94,4121.8 -1609.39,6273.31 -2730.98,7817.83l-4.04 5.53c-256.23,352.57 -511.97,676.73 -759.2,990.08 -1424.63,1805.55 -2421.75,2842.48 -1929.49,6374.55 63.81,365.43 -491.84,462.45 -555.63,97.02 -468.46,-3356.41 291.25,-4616.29 1218.24,-5774.36 -280,162.32 -578.23,313.62 -895.03,453.18 -339.34,149.37 -566.45,-366.6 -227.12,-515.96 590.18,-259.98 1106.96,-559.35 1552.96,-893.3 454.31,-340.17 838.17,-717.81 1154.13,-1127.68 1078.64,-1489.72 2163.57,-3510.93 2616.11,-7488.62 108.41,-952.98 233.42,-1645.38 339.82,-2234.71 274.74,-1521.79 287.44,-2168.39 63.54,-3657.9 -163.22,-1086.02 -173.94,-3032.05 -466.2,-3916.56 -749.45,-2268.03 -3360.9,-2012.46 -3469.37,531.81 -37.18,872.12 -1.13,1747.85 -17.04,2622.82 -7.86,432.12 -41.7,884 137.87,1288.95 106.22,239.52 277.06,428.12 521.97,586.13 186.82,119.91 4.28,404.36 -182.57,284.45 -255.43,-164.8 -446.66,-359.07 -580.91,-598.29 -215.25,1507.98 -1004.97,2721.64 -1265.44,4295.89 -59.45,365.42 -615.08,275.04 -555.63,-90.41 295.31,-1784.91 1204.88,-3075.97 1323.54,-4871.26 70.25,-1062.87 24.68,-2106.41 44.71,-3166.02l-3566.57 -11184.7c-533.69,-1673.66 -1107.31,-2643.14 -1671.95,-3150.58 -943.51,-847.87 -2226.24,-486.94 -2291.5,894.75 -33.51,709.38 173.51,1606.48 442.29,2510.71l3349.95 11269.49c56.92,191.46 1.53,156.11 195.57,182.15 227.67,30.56 455.73,88.99 687.72,178.9 207.07,80.05 85.36,394.91 -121.72,314.85 -603.64,-233.93 -1172.53,-227.49 -1792.4,-63.89 -214.95,56.56 -300.89,-270.24 -86,-326.78 142.34,-37.57 282.67,-67.53 421.79,-89.06 185,-28.64 170.52,15.36 116.46,-166.54l-3311.58 -11140.37c-70.68,-237.8 -137.3,-475.72 -196.9,-711.09 -231.55,-883.97 -419.36,-1572.88 -602.91,-2133.25 -178.78,-545.79 -350.81,-958.36 -553.96,-1300.24 -579.23,-974.79 -2264.11,-956.88 -2659.59,76.57 -191.14,499.47 -165.96,1200.59 -62.17,1891.52 108.6,723.11 300.61,1422.96 430.33,1894.58l3199.35 11630.95c62.72,228.03 17.47,181.18 253.03,175.9 137.95,-3.09 275.26,-1.13 406.8,6.83 221.85,13.04 202.04,350.38 -19.84,337.34 -421.79,-25.52 -1182.64,19.96 -1587.6,170.64 -207.96,77.44 -325.7,-238.76 -117.75,-316.19 97.55,-36.3 223.21,-69.78 366.58,-98.5 224.03,-44.87 192.4,2.67 127.76,-232.36l-3170.73 -11526.88c-134.92,-490.52 -334.61,-1218.32 -445.78,-1958.52 -100.85,-671.45 -131.15,-1362.24 14.9,-1929.17 -2127.03,-1002.44 -2372.52,1894.45 -2123.41,3298.35l2232.84 12582.95c42.03,236.9 -4.61,192.83 226.27,180.08 89.23,-4.92 175.29,-6.49 255.7,-4.67 221.82,4.32 215.28,341.68 -6.62,337.34 -386.37,-8.73 -928.85,67.62 -1277.29,240.26 -199.27,98.32 -348.73,-204.66 -149.49,-302.96 73,-36.17 153.22,-68.73 238.22,-97.7 252.33,-85.99 196.76,-34.52 143.72,-333.41l-2239.55 -12620.8c-125.45,-92.74 -266.76,-141.37 -415.6,-158.3 -1494.63,-170.05 -1839.47,1444.18 -1776.31,2590.23l602.14 10926.35c10.97,199.12 16.56,397.34 17.44,594.92 97.33,-96.49 218.88,-171.24 371.67,-220.15 211.47,-67.85 314.58,253.64 103.18,321.47 -182.85,58.53 -296.95,177.15 -371.18,338.08 -75.85,164.45 -114.75,374.66 -140.83,612.07 -222.4,3076.51 -1173.1,5880.34 -1171.66,9070.19 0.8,1788.2 295.08,3410.55 685.5,4865.77 350.17,1074.33 1033.67,1660.05 1845.41,2360.57 117.51,101.68 130.35,279.38 28.67,396.89 -101.69,117.51 -279.39,130.35 -396.9,28.67 -294.62,-254.29 -581.93,-484.64 -856.71,-766.01 130.22,384.43 260.42,754.05 385.33,1108.66 512.14,1453.73 938.26,2663.36 938.26,3662.3zm-15668.95 -33076.32c200.13,96.58 53.28,400.87 -146.85,304.29 -272.15,-130.94 -601.18,-177.57 -901,-170.05 -221.88,5.22 -229.79,-332.13 -7.95,-337.34 355.04,-8.9 733.81,48.18 1055.8,203.1zm4491.02 -827.78c196.64,103.54 39.2,402.53 -157.44,298.98 -256.66,-134.98 -600.11,-180.87 -886.78,-190.62 -221.86,-6.96 -211.27,-344.31 10.59,-337.34 344.49,11.73 725.38,66.87 1033.63,228.98zm3328.82 1137.23c210.57,70.48 103.41,390.64 -107.16,320.16 -278.18,-93.24 -629.44,-139.03 -922.59,-131.78 -221.87,5.22 -229.79,-332.13 -7.94,-337.34 334.91,-8.3 719.83,42.43 1037.69,148.96zm2996.55 2317.83c196.64,103.55 39.2,402.53 -157.44,298.99 -255.86,-134.79 -603.82,-173.24 -887.82,-133.53 -220.16,30.44 -266.4,-304.27 -46.3,-334.7 356.57,-49.85 770.81,0.28 1091.56,169.24zm-12359.06 2339.56c200.11,95.68 54.63,399.99 -145.52,304.29 -214.42,-102.57 -592.04,-174.57 -828.38,-141.13 -220.16,30.45 -266.4,-304.27 -46.3,-334.7 303.09,-42.91 745.04,39.91 1020.2,171.54zm4354.76 -66.79c207.95,77.43 90.21,393.63 -117.75,316.19 -286.79,-107.66 -541.18,-141.26 -846.64,-116.88 -221.88,17.4 -248.32,-319.95 -26.46,-337.34 356.27,-28.46 656.5,12.53 990.85,138.03zm3861.98 848.43c203.61,89.63 67.33,399.19 -136.26,309.57 -262.97,-116.39 -635.39,-148 -919.62,-124.89 -221.87,17.4 -248.31,-319.95 -26.46,-337.34 339.04,-27.59 769.16,14.05 1082.34,152.66zm3733.66 1284.51c185.96,120.78 2.08,403.91 -183.9,283.11 -232.72,-151.49 -602.57,-163.57 -870.58,-137.54 -221.02,20.87 -252.73,-315.17 -31.74,-336.03 352.37,-34.23 781.75,-7.75 1086.22,190.46zm-5798.49 15373.89c61.77,213.19 -262.36,307.08 -324.11,93.93 -761.13,-2635.86 -2771.27,-4572.63 -5465.22,-5155.61 -217.5,-46.97 -146.08,-377.7 71.44,-330.73 2815.32,609.24 4922.38,2637.47 5717.89,5392.41zm-746.8 -5307.14c181.61,127.72 -12.83,404.23 -194.47,276.5 -2137.18,-1503.54 -5103.32,-1345.05 -6497.52,-2728.19 -157.47,-156.61 80.66,-396.06 238.14,-239.44 1270.96,1260.88 4348.76,1210.17 6453.85,2691.13zm5136.63 -1738.73c220.16,-30.45 266.4,304.27 46.3,334.7 -2210.74,307.34 -7871.91,-378.32 -9501.07,-1999.13 -157.47,-156.61 80.66,-396.06 238.14,-239.44 1544.08,1536.16 7117.25,2195.72 9216.63,1903.87zm16664.28 -15056.72c-200.13,96.58 -346.98,-207.71 -146.85,-304.29 321.99,-154.92 700.76,-212 1055.8,-203.1 221.84,5.21 213.93,342.56 -7.95,337.34 -299.82,-7.52 -628.85,39.11 -901,170.05zm-4480.43 -833.09c-196.64,103.55 -354.08,-195.44 -157.44,-298.98 308.25,-162.11 689.14,-217.25 1033.63,-228.98 221.86,-6.97 232.45,330.38 10.59,337.34 -286.67,9.75 -630.12,55.64 -886.78,190.62zm-3379.1 1158.41c-210.57,70.48 -317.73,-249.68 -107.16,-320.16 317.86,-106.53 702.78,-157.26 1037.69,-148.96 221.85,5.21 213.93,342.56 -7.94,337.34 -293.15,-7.25 -644.41,38.54 -922.59,131.78zm-2946.27 2296.66c-196.64,103.54 -354.08,-195.44 -157.44,-298.99 320.75,-168.96 734.99,-219.09 1091.56,-169.24 220.1,30.43 173.86,365.14 -46.3,334.7 -284,-39.71 -631.96,-1.26 -887.82,133.53zm12347.14 2344.86c-200.15,95.7 -345.63,-208.61 -145.52,-304.29 275.16,-131.63 717.11,-214.45 1020.2,-171.54 220.1,30.43 173.86,365.15 -46.3,334.7 -236.34,-33.44 -613.96,38.56 -828.38,141.13zm-4382.53 -54.89c-207.96,77.44 -325.7,-238.76 -117.75,-316.19 334.35,-125.5 634.58,-166.49 990.85,-138.03 221.86,17.39 195.42,354.74 -26.46,337.34 -305.46,-24.38 -559.85,9.22 -846.64,116.88zm-3843.47 841.81c-203.59,89.62 -339.87,-219.94 -136.26,-309.57 313.18,-138.61 743.3,-180.25 1082.34,-152.66 221.85,17.39 195.41,354.74 -26.46,337.34 -284.23,-23.11 -656.65,8.5 -919.62,124.89zm-3686.02 1258.05c-185.98,120.8 -369.86,-162.33 -183.9,-283.11 304.47,-198.21 733.85,-224.69 1086.22,-190.46 220.99,20.86 189.28,356.9 -31.74,336.03 -268.01,-26.03 -637.86,-13.95 -870.58,137.54zm5938.7 15184.71c-61.75,213.15 -385.88,119.26 -324.11,-93.93 795.51,-2754.94 2902.57,-4783.17 5717.89,-5392.41 217.52,-46.97 288.94,283.76 71.44,330.73 -2693.95,582.98 -4704.09,2519.75 -5465.22,5155.61zm617.16 -5124.57c-181.64,127.73 -376.08,-148.78 -194.47,-276.5 2105.09,-1480.96 5182.89,-1430.25 6453.85,-2691.13 157.48,-156.62 395.61,82.83 238.14,239.44 -1394.2,1383.14 -4360.34,1224.65 -6497.52,2728.19zm-5377.4 -1680.53c-220.1,-30.43 -173.86,-365.15 46.3,-334.7 2099.38,291.85 7672.55,-367.71 9216.63,-1903.87 157.48,-156.62 395.61,82.83 238.14,239.44 -1629.16,1620.81 -7290.33,2306.47 -9501.07,1999.13z"
              />
            </svg>
            {handsStats.availablePoints > 0 && (
              <span style={{
                fontSize: '14px',
                fontWeight: 700,
                background: 'linear-gradient(90deg, #22d3ee, #a855f7, #ec4899)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                {handsStats.availablePoints} pts
              </span>
            )}
          </a>
          {handsStats.leaders.length > 0 && (
            <div style={{ marginTop: '8px', padding: '0 4px' }}>
              {handsStats.leaders.map((leader, i) => {
                const rankColors = ['#fbbf24', '#94a3b8', '#cd7f32']
                return (
                  <div key={leader.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '4px 0',
                  }}>
                    <span style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '4px',
                      background: rankColors[i],
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '9px',
                      fontWeight: 800,
                      color: '#000',
                      flexShrink: 0,
                    }}>
                      {i + 1}
                    </span>
                    <span style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '999px',
                      background: leader.avatar_color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '9px',
                      fontWeight: 700,
                      color: '#fff',
                      flexShrink: 0,
                    }}>
                      {leader.name[0]}
                    </span>
                    <span style={{ flex: 1, fontSize: '12px', fontWeight: 500, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                      {leader.name}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      background: 'linear-gradient(90deg, #22d3ee, #a855f7, #ec4899)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}>
                      {leader.total_points}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {navSections.map((section) => (
          <div key={section.title} style={{ marginBottom: '8px' }}>
            {section.title && (
              <div style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#4b5563',
                textTransform: 'uppercase',
                letterSpacing: '1.5px',
                padding: '16px 20px 10px'
              }}>
                {section.title}
              </div>
            )}
            {section.items.map((item) => {
              const isActive = pathname === item.href
              const badgeCount = 'badgeKey' in item ? unreadCounts[item.badgeKey as keyof typeof unreadCounts] : 0
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={(e) => {
                    e.preventDefault()
                    if ((window as any).__documentIsDirty) {
                      if (!confirm('You have unsaved changes. Leave anyway?')) return
                      ;(window as any).__documentIsDirty = false
                    }
                    router.push(item.href)
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 20px',
                    color: isActive ? '#22d3ee' : '#6b7280',
                    textDecoration: 'none',
                    borderLeft: isActive ? '3px solid #06b6d4' : '3px solid transparent',
                    background: isActive ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ color: isActive ? '#22d3ee' : '#6b7280' }}>
                    {icons[item.icon]}
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#e5e7eb', flex: 1 }}>
                    {item.label}{item.labelGradient && <span style={gradientStyle}> {item.labelGradient}</span>}
                  </span>
                  {badgeCount > 0 && (
                    <span style={{
                      minWidth: '20px',
                      height: '20px',
                      padding: '0 6px',
                      borderRadius: '999px',
                      background: ('badgeKey' in item && item.badgeKey === 'payments') ? '#16a34a' : ('badgeKey' in item && item.badgeKey === 'actions') ? '#06b6d4' : ('badgeKey' in item && item.badgeKey === 'purchase-orders') ? '#a855f7' : ('badgeKey' in item && item.badgeKey === 'fa-orders') ? '#f59e0b' : '#d71cd1',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1,
                    }}>
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                  )}
                  {'badge' in item && item.badge && (
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '999px',
                      background: '#4b5563',
                      color: '#f1f5f9'
                    }}>
                      {item.badge}
                    </span>
                  )}
                </a>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: '20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#22d3ee',
            boxShadow: '0 0 8px #22d3ee'
          }}></div>
          <span style={{ fontSize: '12px', color: '#6b7280' }}>FWG Ops - Active</span>
        </div>
        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            padding: '10px',
            background: 'transparent',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: '8px',
            color: '#94a3b8',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}