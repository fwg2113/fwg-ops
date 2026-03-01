import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import Header from './components/Header'
import Footer from './components/Footer'

// ─── Landing Page Layout ───
// Shared layout for all ad campaign landing pages.
// Includes: Google Tag Manager, Inter font (via CDN), sticky header, footer.
// All landing pages are noindex (not for organic search).

// GTM container ID — replace GTM-XXXXXXX with real ID when ready
const GTM_ID = 'GTM-XXXXXXX'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="font-sans bg-fwg-black" style={{ scrollBehavior: 'smooth', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      {/* Inter font via CDN — loaded in head for landing pages */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
      />

      {/* Google Tag Manager — replace GTM-XXXXXXX with real container ID */}
      <Script id="gtm" strategy="afterInteractive">
        {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
        new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
        j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
        'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
        })(window,document,'script','dataLayer','${GTM_ID}');`}
      </Script>

      {/* GTM noscript fallback */}
      <noscript>
        <iframe
          src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
          height="0"
          width="0"
          style={{ display: 'none', visibility: 'hidden' }}
        />
      </noscript>

      <Header />
      <main>{children}</main>
      <Footer />
    </div>
  )
}
