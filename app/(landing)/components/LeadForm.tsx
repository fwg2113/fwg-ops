'use client'

import { useState, useEffect, useRef, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

// ─── Lead Capture Form ───
// Reusable form used in hero section and final CTA.
// Captures attribution (gclid, UTM) from URL on mount.
// Submits to /api/submissions/public → Supabase submissions table.
// Redirects to /thank-you on success; shows inline error on failure.
//
// formType='wraps' (default): Business Name + Vehicle Description fields
// formType='ppf': Vehicle Year, Make & Model + Coverage Area dropdown
//
// submissionFormType controls the form_type sent to the API:
//   wraps pages: 'ad_landing' (default)
//   PPF pages: 'ppf_landing', 'ppf_pricing', 'ppf_tesla', 'ppf_luxury'

type Props = {
  pageSlug: string
  variant?: 'hero' | 'cta'
  formType?: 'wraps' | 'ppf'
  /** The form_type value sent to the API. Defaults to 'ad_landing' for wraps pages. */
  submissionFormType?: string
  coverageOptions?: { label: string; value: string }[]
}

type FormState = {
  contact_name: string
  phone: string
  email: string
  business_name: string
  vehicle_description: string
  coverage_area: string
  project_details: string
}

type Attribution = {
  gclid?: string
  gbraid?: string
  wbraid?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
  landing_page?: string
  referrer?: string
}

const INITIAL_FORM: FormState = {
  contact_name: '',
  phone: '',
  email: '',
  business_name: '',
  vehicle_description: '',
  coverage_area: '',
  project_details: '',
}

export default function LeadForm({
  pageSlug,
  variant = 'hero',
  formType = 'wraps',
  submissionFormType = 'ad_landing',
  coverageOptions,
}: Props) {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const attrRef = useRef<Attribution>({})

  const isPPF = formType === 'ppf'

  // Capture attribution data from URL on mount
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const attr: Attribution = {}

      const keys: (keyof Attribution)[] = [
        'gclid', 'gbraid', 'wbraid',
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
      ]

      for (const key of keys) {
        const val = params.get(key)
        if (val) attr[key] = val
      }

      attr.landing_page = window.location.href
      if (document.referrer) attr.referrer = document.referrer

      attrRef.current = attr
    } catch {
      // Silently ignore — attribution is optional
    }
  }, [])

  const validate = (): boolean => {
    const errs: Partial<Record<keyof FormState, string>> = {}

    if (!form.contact_name.trim()) errs.contact_name = 'Name is required'
    if (!form.phone.trim()) {
      errs.phone = 'Phone number is required'
    } else if (form.phone.replace(/\D/g, '').length < 10) {
      errs.phone = 'Enter a valid phone number'
    }
    if (!form.email.trim()) {
      errs.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) {
      errs.email = 'Enter a valid email address'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitError('')

    if (!validate()) return

    setSubmitting(true)

    try {
      // Build additional_info: prepend coverage area if selected
      const parts: string[] = []
      if (isPPF && form.coverage_area) {
        const label = coverageOptions?.find(o => o.value === form.coverage_area)?.label || form.coverage_area
        parts.push(`Coverage: ${label}`)
      }
      if (form.project_details.trim()) {
        parts.push(form.project_details.trim())
      }

      const payload = {
        form_type: submissionFormType,
        contact_name: form.contact_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        contact_method: 'phone',
        business_name: isPPF ? undefined : (form.business_name.trim() || undefined),
        vehicle_description: isPPF
          ? (form.vehicle_description.trim() || undefined)
          : (form.vehicle_description.trim() || undefined),
        additional_info: parts.join('\n\n') || undefined,
        source_page: `/${pageSlug}`,
        user_agent: navigator.userAgent,
        ...attrRef.current,
      }

      const res = await fetch('/api/submissions/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Submission failed')
      }

      // Pass gclid through to thank-you page for conversion tracking
      const thankYouParams = new URLSearchParams()
      if (attrRef.current.gclid) thankYouParams.set('gclid', attrRef.current.gclid)
      if (attrRef.current.gbraid) thankYouParams.set('gbraid', attrRef.current.gbraid)
      if (attrRef.current.wbraid) thankYouParams.set('wbraid', attrRef.current.wbraid)
      const qs = thankYouParams.toString()
      router.push(`/thank-you${qs ? `?${qs}` : ''}`)
      return
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      setSubmitError(message + '. Please try again or call us directly.')
    } finally {
      setSubmitting(false)
    }
  }

  const update = (field: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  const inputClass = (field: keyof FormState) =>
    `w-full px-4 py-2.5 rounded-lg border text-gray-900 placeholder:text-gray-400 text-sm focus:ring-2 focus:ring-[#CE0000] focus:border-transparent outline-none transition ${
      errors[field] ? 'border-red-400' : 'border-gray-300'
    }`

  const labelClass = 'block text-gray-900 text-sm font-medium mb-1'

  // ── Form ──
  return (
    <form
      id={variant === 'hero' ? 'quote-form' : undefined}
      onSubmit={handleSubmit}
      noValidate
      className="bg-white rounded-2xl shadow-xl p-6 md:p-8"
    >
      <h3 className="text-gray-900 font-bold text-lg mb-1">
        {isPPF ? 'Get Your Free PPF Quote' : 'Get Your Free Quote'}
      </h3>
      <p className="text-gray-500 text-sm mb-5">No obligation. We respond within 1 business day.</p>

      {submitError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {submitError}
        </div>
      )}

      <div className="space-y-4">
        {/* Full Name */}
        <div>
          <label htmlFor={`name-${variant}`} className={labelClass}>
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            id={`name-${variant}`}
            type="text"
            value={form.contact_name}
            onChange={e => update('contact_name', e.target.value)}
            placeholder="e.g. John Smith"
            className={inputClass('contact_name')}
          />
          {errors.contact_name && <p className="text-red-500 text-xs mt-1">{errors.contact_name}</p>}
        </div>

        {/* Phone */}
        <div>
          <label htmlFor={`phone-${variant}`} className={labelClass}>
            Phone <span className="text-red-500">*</span>
          </label>
          <input
            id={`phone-${variant}`}
            type="tel"
            value={form.phone}
            onChange={e => update('phone', e.target.value)}
            placeholder="e.g. (240) 555-1234"
            className={inputClass('phone')}
          />
          {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
        </div>

        {/* Email Address */}
        <div>
          <label htmlFor={`email-${variant}`} className={labelClass}>
            Email Address <span className="text-red-500">*</span>
          </label>
          <input
            id={`email-${variant}`}
            type="email"
            value={form.email}
            onChange={e => update('email', e.target.value)}
            placeholder={isPPF ? 'e.g. john@example.com' : 'e.g. john@smithplumbing.com'}
            className={inputClass('email')}
          />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
        </div>

        {/* PPF: Vehicle Year, Make & Model — Wraps: Business Name */}
        {isPPF ? (
          <div>
            <label htmlFor={`vehicle-${variant}`} className={labelClass}>
              Vehicle Year, Make &amp; Model
            </label>
            <input
              id={`vehicle-${variant}`}
              type="text"
              value={form.vehicle_description}
              onChange={e => update('vehicle_description', e.target.value)}
              placeholder="e.g. 2024 Tesla Model 3"
              className={inputClass('vehicle_description')}
            />
          </div>
        ) : (
          <div>
            <label htmlFor={`business-${variant}`} className={labelClass}>
              Business Name
            </label>
            <input
              id={`business-${variant}`}
              type="text"
              value={form.business_name}
              onChange={e => update('business_name', e.target.value)}
              placeholder="e.g. Smith Plumbing LLC"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 placeholder:text-gray-400 text-sm focus:ring-2 focus:ring-[#CE0000] focus:border-transparent outline-none transition"
            />
          </div>
        )}

        {/* PPF: Coverage Area dropdown — Wraps: Vehicle Description */}
        {isPPF ? (
          coverageOptions && coverageOptions.length > 0 && (
            <div>
              <label htmlFor={`coverage-${variant}`} className={labelClass}>
                Coverage Area
              </label>
              <select
                id={`coverage-${variant}`}
                value={form.coverage_area}
                onChange={e => update('coverage_area', e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus:ring-2 focus:ring-[#CE0000] focus:border-transparent outline-none transition bg-white"
              >
                <option value="">Select coverage area...</option>
                {coverageOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )
        ) : (
          <div>
            <label htmlFor={`vehicle-${variant}`} className={labelClass}>
              Vehicle Description
            </label>
            <input
              id={`vehicle-${variant}`}
              type="text"
              value={form.vehicle_description}
              onChange={e => update('vehicle_description', e.target.value)}
              placeholder="e.g. 2024 Ford Transit 250 (white)"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 placeholder:text-gray-400 text-sm focus:ring-2 focus:ring-[#CE0000] focus:border-transparent outline-none transition"
            />
          </div>
        )}

        {/* Project Details */}
        <div>
          <label htmlFor={`details-${variant}`} className={labelClass}>
            Project Details
          </label>
          <textarea
            id={`details-${variant}`}
            value={form.project_details}
            onChange={e => update('project_details', e.target.value)}
            placeholder={isPPF
              ? 'e.g. Looking for full front PPF on my new Tesla. Want to protect the hood and bumper.'
              : 'e.g. Looking for a full wrap on our work van with logo, phone number, and website. We have artwork ready.'
            }
            rows={3}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 placeholder:text-gray-400 text-sm focus:ring-2 focus:ring-[#CE0000] focus:border-transparent outline-none transition resize-none"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-[#CE0000] hover:bg-[#A30000] disabled:bg-[#CE0000]/50 text-white font-bold text-base py-3 rounded-lg transition-colors"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Submitting...
            </span>
          ) : (
            'Get Your Free Quote'
          )}
        </button>
      </div>
    </form>
  )
}
