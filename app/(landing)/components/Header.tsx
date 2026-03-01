'use client'

import Image from 'next/image'
import { BUSINESS } from '../lib/page-data'

const LOGO_URL =
  'https://pub-fc53e761336c467eb14e978df4383491.r2.dev/assets/logo/logo.png'

// ─── Sticky Header ───
// Dark background, fixed on scroll.
// Logo (NOT linked) on left, phone + CTA on right.

export default function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black border-b border-zinc-700">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo — NOT linked to homepage */}
        <div className="flex items-center gap-2">
          <Image
            src={LOGO_URL}
            alt={BUSINESS.name}
            width={36}
            height={36}
            className="h-9 w-auto object-contain"
            unoptimized
          />
          <span className="text-white font-bold text-lg hidden sm:inline">
            {BUSINESS.name}
          </span>
          <span className="text-white font-bold text-lg sm:hidden">FWG</span>
        </div>

        {/* Phone + CTA */}
        <div className="flex items-center gap-3">
          {/* Phone — always visible */}
          <a
            href={BUSINESS.phoneTel}
            className="flex items-center gap-2 text-white hover:text-red-400 transition-colors"
          >
            {/* Phone icon */}
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
            <span className="hidden md:inline font-semibold text-sm">
              {BUSINESS.phone}
            </span>
          </a>

          {/* CTA button — scrolls to form */}
          <a
            href="#quote-form"
            className="bg-[#CE0000] hover:bg-[#A30000] text-white font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
          >
            Get a Quote
          </a>
        </div>
      </div>
    </header>
  )
}
