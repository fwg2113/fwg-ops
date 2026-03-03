'use client'

import { useState } from 'react'
import type { FAQItem } from '../lib/page-data'

// ─── FAQ Section ───
// Expandable accordion for FAQ items.
// Used on the PPF pricing page.

type Props = {
  items: FAQItem[]
}

export default function FAQSection({ items }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section className="py-16 bg-black">
      <div className="max-w-3xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-white text-center mb-10">
          Frequently Asked Questions
        </h2>

        <div className="space-y-3">
          {items.map((item, i) => {
            const isOpen = openIndex === i

            return (
              <div
                key={i}
                className="bg-zinc-800 rounded-xl overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="text-white font-semibold text-sm pr-4">
                    {item.question}
                  </span>
                  <svg
                    className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5">
                    <p className="text-gray-400 text-sm leading-relaxed">
                      {item.answer}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
