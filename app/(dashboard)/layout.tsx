'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Sidebar from '../components/Sidebar'
import NotificationManager from '../components/NotificationManager'

const PhoneWidget = dynamic(() => import('./components/PhoneWidget'), { ssr: false })
const IncomingCallToast = dynamic(() => import('../components/IncomingCallToast'), { ssr: false })

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

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

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

  const handleRefresh = () => {
    setIsRefreshing(true)
    router.refresh()
    setTimeout(() => setIsRefreshing(false), 800)
  }

  return (
    <>
      <style jsx global>{`
        /* Desktop sidebar - fixed position */
        .dashboard-sidebar {
          position: fixed;
          top: 0;
          left: 0;
          z-index: 1001;
          transition: transform 0.3s ease;
        }

        /* Mobile header - hidden on desktop */
        .mobile-header {
          display: none !important;
        }

        /* Sidebar overlay - hidden on desktop */
        .sidebar-overlay {
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
            transform: translateX(-100%);
          }
          .dashboard-sidebar.open {
            transform: translateX(0);
          }
          .sidebar-overlay {
            display: block;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s ease;
          }
          .sidebar-overlay.open {
            opacity: 1;
            pointer-events: auto;
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

          /* Messages: stack conversation list and chat panel */
          .messages-split-view {
            flex-direction: column !important;
            height: auto !important;
            min-height: calc(100vh - 180px);
          }
          .messages-convo-list {
            width: 100% !important;
            max-height: 50vh;
          }
          .messages-chat-panel {
            min-height: 300px;
          }

          /* Email: stack sidebar and content */
          .email-layout {
            flex-direction: column !important;
          }
          .email-sidebar {
            width: 100% !important;
            flex-direction: row !important;
            overflow-x: auto !important;
            flex-shrink: 0 !important;
          }
          .email-sidebar > div:first-child {
            display: none !important;
          }

          /* Kanban: enable horizontal scroll */
          .kanban-container {
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch;
            padding-bottom: 8px;
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
          {/* Refresh button (mobile) */}
          <button
            onClick={handleRefresh}
            style={{
              background: 'none',
              border: 'none',
              color: '#6b7280',
              padding: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.2s',
            }}
            aria-label="Refresh page"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{
              width: 20,
              height: 20,
              animation: isRefreshing ? 'spin 0.6s linear infinite' : 'none',
            }}>
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
          </button>
        </div>

        {/* Sidebar Overlay (mobile) */}
        <div
          className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            zIndex: 1000,
            backdropFilter: 'blur(2px)',
          }}
        />

        {/* Sidebar */}
        <div className={`dashboard-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <Sidebar />
        </div>

        <main className="dashboard-main" style={{ flex: 1, marginLeft: '240px', padding: '24px', minWidth: 0, overflowX: 'hidden', width: '100%' }}>
          {children}
        </main>
        <NotificationManager />
        <IncomingCallToast />
        <PhoneWidget />
      </div>
    </>
  )
}
