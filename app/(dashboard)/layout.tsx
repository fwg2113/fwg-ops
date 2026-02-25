'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
import Sidebar from '../components/Sidebar'
import NotificationManager from '../components/NotificationManager'

const PhoneWidget = dynamic(() => import('./components/PhoneWidget'), { ssr: false })

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  // Close sidebar on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [])

  return (
    <>
      <style jsx global>{`
        /* Mobile header */
        .mobile-header {
          display: none;
        }

        /* Settings tabs responsive */
        .settings-tabs-mobile {
          display: none !important;
        }
        .settings-tabs-desktop {
          display: block !important;
        }

        @media (max-width: 768px) {
          .mobile-header {
            display: flex !important;
          }
          .dashboard-sidebar {
            position: fixed !important;
            left: -260px !important;
            z-index: 1001 !important;
            transition: left 0.3s ease !important;
          }
          .dashboard-sidebar.open {
            left: 0 !important;
          }
          .sidebar-overlay {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.6);
            z-index: 1000;
            backdrop-filter: blur(2px);
          }
          .sidebar-overlay.open {
            display: block;
          }
          .dashboard-main {
            margin-left: 0 !important;
            padding: 16px !important;
            padding-top: 72px !important;
          }

          /* Settings tabs - show dropdown, hide desktop */
          .settings-tabs-mobile {
            display: block !important;
          }
          .settings-tabs-desktop {
            display: none !important;
          }
        }

        @media (max-width: 480px) {
          .dashboard-main {
            padding: 12px !important;
            padding-top: 68px !important;
          }
        }
      `}</style>
      <div style={{ display: 'flex', minHeight: '100vh', background: '#111111' }}>
        {/* Mobile Header */}
        <div
          className="mobile-header"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: '56px',
            background: '#111111',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'none',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            zIndex: 999,
          }}
        >
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: 'none',
              border: 'none',
              color: '#e5e7eb',
              padding: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Toggle menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 24, height: 24 }}>
              {sidebarOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </>
              )}
            </svg>
          </button>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <div style={{
              width: '28px',
              height: '28px',
              background: 'linear-gradient(135deg, #06b6d4, #ec4899)',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                <rect x="1" y="3" width="15" height="13" rx="2" ry="2"></rect>
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                <circle cx="5.5" cy="18.5" r="2.5"></circle>
                <circle cx="18.5" cy="18.5" r="2.5"></circle>
              </svg>
            </div>
            <span style={{
              fontSize: '16px',
              fontWeight: 700,
              color: '#f1f5f9',
            }}>
              FWG <span style={{
                background: 'linear-gradient(90deg, #22d3ee, #a855f7, #ec4899)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>Ops</span>
            </span>
          </div>
          <div style={{ width: '40px' }} /> {/* Spacer for centering */}
        </div>

        {/* Sidebar Overlay (mobile) */}
        <div
          className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
          onClick={() => setSidebarOpen(false)}
        />

        {/* Sidebar */}
        <div className={`dashboard-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <Sidebar />
        </div>

        <main className="dashboard-main" style={{ flex: 1, marginLeft: '240px', padding: '24px', minWidth: 0, overflowX: 'hidden', width: '100%' }}>
          {children}
        </main>
        <NotificationManager />
        <PhoneWidget />
      </div>
    </>
  )
}
