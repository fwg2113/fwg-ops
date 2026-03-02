import { BUSINESS } from '../lib/page-data'

// ─── Thank You Page ───
// Dead-end confirmation page shown after a successful form submission.
// No navigation links — user should call or wait for follow-up.

export default function ThankYouPage() {
  return (
    <div className="min-h-[calc(100vh-96px)] flex items-center justify-center px-4 pt-24 pb-16">
      <div className="max-w-md w-full text-center">
        {/* Green checkmark */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-600/20 flex items-center justify-center">
          <svg
            className="w-10 h-10 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        {/* Heading */}
        <h1 className="text-white font-bold text-3xl md:text-4xl mb-4">
          Quote Request Received!
        </h1>

        {/* Body text */}
        <p className="text-gray-400 text-lg mb-8">
          Thank you! We&apos;ll be in touch within one business day with your
          free quote.
        </p>

        {/* Phone CTA */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
          <p className="text-gray-400 text-sm mb-2">
            Need a faster response? Give us a call:
          </p>
          <a
            href={BUSINESS.phoneTel}
            className="text-white font-bold text-2xl hover:text-red-400 transition-colors"
          >
            {BUSINESS.phone}
          </a>
        </div>
      </div>
    </div>
  )
}
