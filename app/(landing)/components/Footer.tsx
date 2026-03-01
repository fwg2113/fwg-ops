import { BUSINESS } from '../lib/page-data'

// ─── Minimal Footer ───
// Business info only. NO navigation links. NO social media.

export default function Footer() {
  return (
    <footer className="bg-fwg-black border-t border-fwg-border-dark py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-fwg-text-muted text-sm">
          <div>
            <p className="text-white font-semibold">{BUSINESS.name}</p>
            <p>
              {BUSINESS.address.street}, {BUSINESS.address.city},{' '}
              {BUSINESS.address.state} {BUSINESS.address.zip}
            </p>
          </div>

          <div className="flex flex-col md:items-end gap-1">
            <a
              href={BUSINESS.phoneTel}
              className="hover:text-white transition-colors"
            >
              {BUSINESS.phone}
            </a>
            {BUSINESS.hours.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-fwg-border-dark flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-fwg-text-muted text-xs">
          <p>&copy; {new Date().getFullYear()} {BUSINESS.name}. All rights reserved.</p>
          {/* Replace href with actual privacy policy URL when ready */}
          <a href="/privacy" className="hover:text-fwg-surface transition-colors">
            Privacy Policy
          </a>
        </div>
      </div>
    </footer>
  )
}
