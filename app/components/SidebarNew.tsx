'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Navigation items organized by sections
const navSections = [
  {
    title: 'CORE',
    items: [
      {
        href: '/',
        label: 'Command Center',
        displayLabel: ['Command', 'Center'],
        icon: 'M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z'
      },
      {
        href: '/submissions',
        label: 'Lead Pipeline',
        displayLabel: ['Lead', 'Pipeline'],
        icon: 'M22 12h-4l-3 9L9 3l-3 9H2'
      },
    ]
  },
  {
    title: 'SALES',
    items: [
      {
        href: '/documents',
        label: 'Quote Builder',
        displayLabel: ['Quote', 'Builder'],
        icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM9 13h6M9 17h6'
      },
      {
        href: '/invoices',
        label: 'Invoice Manager',
        displayLabel: ['Invoice', 'Manager'],
        icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3v-8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z'
      },
      {
        href: '/payments',
        label: 'Payment History',
        displayLabel: ['Payment', 'History'],
        icon: 'M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6'
      },
    ]
  },
  {
    title: 'COMMUNICATION',
    items: [
      {
        href: '/messages',
        label: 'Message Hub',
        displayLabel: ['Message', 'Hub'],
        icon: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z'
      },
      {
        href: '/customers',
        label: 'Customer Database',
        displayLabel: ['Customer', 'Database'],
        icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75M9 7a4 4 0 11-8 0 4 4 0 018 0z'
      },
    ]
  },
  {
    title: 'PRODUCTION',
    items: [
      {
        href: '/calendar',
        label: 'Schedule Calendar',
        displayLabel: ['Schedule', 'Calendar'],
        icon: 'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z'
      },
      {
        href: '/production',
        label: 'Production Flow',
        displayLabel: ['Production', 'Flow'],
        icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5'
      },
    ]
  },
  {
    title: 'ACCOUNT',
    items: [
      {
        href: '/settings',
        label: 'System Settings',
        displayLabel: ['System', 'Settings'],
        icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z'
      },
    ]
  },
]

export default function SidebarNew() {
  const pathname = usePathname()

  console.log('✅✅✅ BRAND NEW SIDEBAR COMPONENT LOADED ✅✅✅')
  console.log('🚛 Frederick Wraps Operations Hub - NEW FILE')

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
      borderRight: '1px solid rgba(148, 163, 184, 0.1)',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      left: 0,
      top: 0
    }}>
      {/* Logo & Header */}
      <div style={{
        padding: '24px 20px',
        borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
      }}>
        {/* Truck Icon Container */}
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
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ width: '24px', height: '24px' }}
          >
            <rect x="1" y="3" width="15" height="13" rx="2" ry="2"></rect>
            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
            <circle cx="5.5" cy="18.5" r="2.5"></circle>
            <circle cx="18.5" cy="18.5" r="2.5"></circle>
          </svg>
        </div>

        {/* Title & Subtitle */}
        <div>
          <h1 style={{
            fontSize: '18px',
            fontWeight: 'bold',
            margin: 0,
            lineHeight: 1.2,
            color: '#f1f5f9'
          }}>
            Frederick{' '}
            <span style={{
              background: 'linear-gradient(90deg, #22d3ee, #a855f7, #ec4899)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              Wraps
            </span>
          </h1>
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

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: 'auto' }}>
        {navSections.map((section) => (
          <div key={section.title}>
            {/* Section Title */}
            <div style={{
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '1.5px',
              color: '#4b5563',
              padding: '16px 20px 10px',
              fontWeight: '600'
            }}>
              {section.title}
            </div>

            {/* Section Items */}
            {section.items.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 20px',
                    borderLeft: `3px solid ${isActive ? '#06b6d4' : 'transparent'}`,
                    background: isActive ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
                    textDecoration: 'none',
                    fontSize: '14px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <svg
                    style={{
                      width: '20px',
                      height: '20px',
                      flexShrink: 0,
                      color: isActive ? '#22d3ee' : '#6b7280'
                    }}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    viewBox="0 0 24 24"
                  >
                    <path d={item.icon} />
                  </svg>

                  {/* Two-tone Label */}
                  <span style={{ color: '#f1f5f9' }}>
                    {item.displayLabel[0]}{' '}
                    <span style={{
                      background: 'linear-gradient(90deg, #22d3ee, #a855f7, #ec4899)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      fontWeight: isActive ? '600' : '400'
                    }}>
                      {item.displayLabel[1]}
                    </span>
                  </span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid rgba(148, 163, 184, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {/* Status Indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12px',
          color: '#6b7280'
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#22d3ee',
            boxShadow: '0 0 8px #22d3ee'
          }}></div>
          FWG Ops • Active
        </div>

        {/* Sign Out Button */}
        <button
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px',
            borderRadius: '8px',
            background: 'transparent',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            color: '#94a3b8',
            fontSize: '14px',
            cursor: 'pointer',
            width: '100%',
            textAlign: 'left',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(148, 163, 184, 0.05)'
            e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.3)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.2)'
          }}
        >
          <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          Sign Out
        </button>
      </div>
    </div>
  )
}
