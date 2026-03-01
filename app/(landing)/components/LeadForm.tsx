'use client'

import { useState, useEffect, useRef, type FormEvent } from 'react'
import { VEHICLE_COUNT_OPTIONS } from '../lib/page-data'

// ─── Lead Capture Form ───
// Reusable form used in hero section and final CTA.
// Captures attribution (gclid, UTM) from URL on mount.
// Submits to /api/submissions/public with form_type='ad_landing'.

type FormOption = { label: string; value: string }

type Props = {
  formOptions: FormOption[]
  pageSlug: string
  variant?: 'hero' | 'cta'
}

type FormState = {
  contact_name: string
  business_name: string
  phone: string
  email: string
  coverage_type: string
  vehicle_count: string
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
  business_name: '',
  phone: '',
  email: '',
  coverage_type: '',
  vehicle_count: '',
}

export default function LeadForm({ formOptions, pageSlug, variant = 'hero' }: Props) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const attrRef = useRef<Attribution>({})

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
    if (!form.business_name.trim()) errs.business_name = 'Company name is required'
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
    if (!form.coverage_type) errs.coverage_type = 'Please select a service'
    if (!form.vehicle_count) errs.vehicle_count = 'Please select vehicle count'

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitError('')

    if (!validate()) return

    setSubmitting(true)

    try {
      const payload = {
        form_type: 'ad_landing',
        contact_name: form.contact_name.trim(),
        business_name: form.business_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        contact_method: 'phone',
        coverage_type: form.coverage_type,
        vehicle_count: form.vehicle_count,
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

      setSubmitted(true)
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

  // ── Success state ──
  if (submitted) {
    return (
      <div
        id={variant === 'hero' ? 'quote-form' : undefined}
        className="bg-white rounded-2xl shadow-xl p-8 text-center"
      >
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-gray-900 font-bold text-xl mb-2">Quote Request Received!</h3>
        <p className="text-gray-600 text-sm">
          Thank you! We&apos;ll be in touch within one business day with your free quote.
        </p>
      </div>
    )
  }

  // ── Form ──
  return (
    <form
      id={variant === 'hero' ? 'quote-form' : undefined}
      onSubmit={handleSubmit}
      noValidate
      className="bg-white rounded-2xl shadow-xl p-6 md:p-8"
    >
      <h3 className="text-gray-900 font-bold text-lg mb-1">Get Your Free Quote</h3>
      <p className="text-gray-500 text-sm mb-5">No obligation. We respond within 1 business day.</p>

      {submitError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {submitError}
        </div>
      )}

      <div className="space-y-4">
        {/* Full Name */}
        <div>
          <label htmlFor={`name-${variant}`} className="block text-gray-700 text-sm font-medium mb-1">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            id={`name-${variant}`}
            type="text"
            value={form.contact_name}
            onChange={e => update('contact_name', e.target.value)}
            placeholder="John Smith"
            className={`w-full px-4 py-2.5 rounded-lg border text-gray-900 placeholder:text-gray-400 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition ${
              errors.contact_name ? 'border-red-400' : 'border-gray-300'
            }`}
          />
          {errors.contact_name && <p className="text-red-500 text-xs mt-1">{errors.contact_name}</p>}
        </div>

        {/* Company Name */}
        <div>
          <label htmlFor={`company-${variant}`} className="block text-gray-700 text-sm font-medium mb-1">
            Company Name <span className="text-red-500">*</span>
          </label>
          <input
            id={`company-${variant}`}
            type="text"
            value={form.business_name}
            onChange={e => update('business_name', e.target.value)}
            placeholder="Smith Plumbing LLC"
            className={`w-full px-4 py-2.5 rounded-lg border text-gray-900 placeholder:text-gray-400 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition ${
              errors.business_name ? 'border-red-400' : 'border-gray-300'
            }`}
          />
          {errors.business_name && <p className="text-red-500 text-xs mt-1">{errors.business_name}</p>}
        </div>

        {/* Phone */}
        <div>
          <label htmlFor={`phone-${variant}`} className="block text-gray-700 text-sm font-medium mb-1">
            Phone Number <span className="text-red-500">*</span>
          </label>
          <input
            id={`phone-${variant}`}
            type="tel"
            value={form.phone}
            onChange={e => update('phone', e.target.value)}
            placeholder="(240) 555-1234"
            className={`w-full px-4 py-2.5 rounded-lg border text-gray-900 placeholder:text-gray-400 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition ${
              errors.phone ? 'border-red-400' : 'border-gray-300'
            }`}
          />
          {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
        </div>

        {/* Email */}
        <div>
          <label htmlFor={`email-${variant}`} className="block text-gray-700 text-sm font-medium mb-1">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            id={`email-${variant}`}
            type="email"
            value={form.email}
            onChange={e => update('email', e.target.value)}
            placeholder="john@smithplumbing.com"
            className={`w-full px-4 py-2.5 rounded-lg border text-gray-900 placeholder:text-gray-400 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition ${
              errors.email ? 'border-red-400' : 'border-gray-300'
            }`}
          />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
        </div>

        {/* What do you need? */}
        <div>
          <label htmlFor={`service-${variant}`} className="block text-gray-700 text-sm font-medium mb-1">
            What do you need? <span className="text-red-500">*</span>
          </label>
          <select
            id={`service-${variant}`}
            value={form.coverage_type}
            onChange={e => update('coverage_type', e.target.value)}
            className={`w-full px-4 py-2.5 rounded-lg border text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition appearance-none bg-white ${
              errors.coverage_type ? 'border-red-400' : 'border-gray-300'
            } ${form.coverage_type ? 'text-gray-900' : 'text-gray-400'}`}
          >
            <option value="">Select a service...</option>
            {formOptions.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {errors.coverage_type && <p className="text-red-500 text-xs mt-1">{errors.coverage_type}</p>}
        </div>

        {/* How many vehicles? */}
        <div>
          <label htmlFor={`vehicles-${variant}`} className="block text-gray-700 text-sm font-medium mb-1">
            How many vehicles? <span className="text-red-500">*</span>
          </label>
          <select
            id={`vehicles-${variant}`}
            value={form.vehicle_count}
            onChange={e => update('vehicle_count', e.target.value)}
            className={`w-full px-4 py-2.5 rounded-lg border text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition appearance-none bg-white ${
              errors.vehicle_count ? 'border-red-400' : 'border-gray-300'
            } ${form.vehicle_count ? 'text-gray-900' : 'text-gray-400'}`}
          >
            <option value="">Select...</option>
            {VEHICLE_COUNT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {errors.vehicle_count && <p className="text-red-500 text-xs mt-1">{errors.vehicle_count}</p>}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-base py-3 rounded-lg transition-colors"
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
