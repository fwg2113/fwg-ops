'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Navigation structure with sections
const navSections = [
  {
    title: 'Core',
    items: [
      { href: '/', label: 'Command', labelGradient: 'Center', icon: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z' },
      { href: '/submissions', label: 'Lead', labelGradient: 'Pipeline', icon: 'M22 12h-4l-3 9-6-18-3 9H2' }
    ]
  },
  {
    title: 'Sales',
    items: [
      { href: '/quotes', label: 'Quote', labelGradient: 'Builder', icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8' },
      { href: '/invoices', label: 'Invoice', labelGradient: 'Manager', icon: 'M1 4h22v16H1zM1 10h22' },
      { href: '/payments', label: 'Payment', labelGradient: 'History', icon: 'M12 1v22M17 5H9.5A3.5 3.5 0 006 8.5 3.5 3.5 0 009.5 12h5A3.5 3.5 0 0118 15.5 3.5 3.5 0 0114.5 19H6' }
    ]
  },
  {
    title: 'Communication',
    items: [
      { href: '/messages', label: 'Message', labelGradient: 'Hub', icon: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z' },
      { href: '/customers', label: 'Customer', labelGradient: 'Database', icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 108 0 4 4 0 00-8 0zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75' },
      { href: '/email', label: 'Email', labelGradient: 'Templates', icon: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6', disabled: true, badge: 'Soon' }
    ]
  },
  {
    title: 'Production',
    items: [
      { href: '/calendar', label: 'Job', labelGradient: 'Calendar', icon: 'M3 4h18v18H3zM16 2v4M8 2v4M3 10h18' },
      { href: '/tasks', label: 'Task', labelGradient: 'Board', icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11' },
      { href: '/production', label: 'Production', labelGradient: 'Flow', icon: 'M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2' }
    ]
  },
  {
    title: 'Account',
    items: [
      { href: '/settings', label: 'System', labelGradient: 'Settings', icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z' }
    ]
  }
]

export default function Sidebar() {
  const pathname = usePathname()

  const handleLogout = () => {
    document.cookie = 'fwg_auth=; path=/; max-age=0'
    localStorage.removeItem('fwg_user')
    window.location.href = '/login'
  }

  return (
    <div style={{
      width: '240px',
      height: '100vh',
      background: '#111111',
      borderRight: '1px solid rgba(255, 255, 255, 0.08)',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      left: 0,
      top: 0
    }}>
      {/* Logo Header */}
      <div style={{
        padding: '24px 20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Truck Icon */}
          <div style={{
            width: '44px',
            height: '44px',
            background: 'linear-gradient(135deg, #06b6d4, #ec4899)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <svg
              style={{ width: '26px', height: '26px', color: 'white' }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="1" y="3" width="15" height="13" rx="2" ry="2" />
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          </div>

          <div>
            {/* Title with gradient */}
            <div style={{
              fontSize: '18px',
              fontWeight: 700,
              color: '#f1f5f9',
              lineHeight: '1.2'
            }}>
              Frederick <span style={{
                background: 'linear-gradient(90deg, #22d3ee, #a855f7, #ec4899)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>Wraps</span>
            </div>
            {/* Subtitle */}
            <div style={{
              fontSize: '11px',
              color: '#6b7280',
              letterSpacing: '0.5px',
              marginTop: '2px'
            }}>
              Operations Hub
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '16px 0', overflowY: 'auto' }}>
        {navSections.map((section) => (
          <div key={section.title} style={{ marginBottom: '8px' }}>
            {/* Section Title */}
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

            {/* Section Items */}
            {section.items.map((item) => {
              const isActive = pathname === item.href
              const isDisabled = item.disabled

              if (isDisabled) {
                return (
                  <div
                    key={item.href}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 20px',
                      color: '#94a3b8',
                      borderLeft: '3px solid transparent',
                      opacity: 0.5,
                      cursor: 'not-allowed'
                    }}
                  >
                    <svg
                      style={{ width: '20px', height: '20px', color: '#6b7280', flexShrink: 0 }}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                    >
                      <path d={item.icon} />
                    </svg>
                    <span style={{ fontSize: '14px', fontWeight: 500, color: '#e5e7eb' }}>
                      {item.label} <span style={{
                        background: 'linear-gradient(90deg, #22d3ee, #a855f7, #ec4899)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text'
                      }}>{item.labelGradient}</span>
                    </span>
                    <span style={{
                      marginLeft: 'auto',
                      background: '#374151',
                      color: 'white',
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '10px'
                    }}>
                      {item.badge}
                    </span>
                  </div>
                )
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 20px',
                    color: '#94a3b8',
                    textDecoration: 'none',
                    transition: 'all 0.15s ease',
                    borderLeft: isActive ? '3px solid #06b6d4' : '3px solid transparent',
                    background: isActive ? 'rgba(6, 182, 212, 0.1)' : 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent'
                    }
                  }}
                >
                  <svg
                    style={{
                      width: '20px',
                      height: '20px',
                      color: isActive ? '#22d3ee' : '#6b7280',
                      flexShrink: 0
                    }}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    viewBox="0 0 24 24"
                  >
                    <path d={item.icon} />
                  </svg>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#e5e7eb' }}>
                    {item.label} <span style={{
                      background: 'linear-gradient(90deg, #22d3ee, #a855f7, #ec4899)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text'
                    }}>{item.labelGradient}</span>
                  </span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer with Status */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Glowing Cyan Dot */}
          <div style={{
            width: '8px',
            height: '8px',
            background: '#22d3ee',
            borderRadius: '50%',
            boxShadow: '0 0 8px #22d3ee',
            flexShrink: 0
          }} />

          {/* Status Text */}
          <div style={{ fontSize: '13px', color: '#9ca3af' }}>
            <strong style={{ color: '#ffffff' }}>FWG Ops</strong> &bull; Active
          </div>
        </div>
      </div>
    </div>
  )
}
