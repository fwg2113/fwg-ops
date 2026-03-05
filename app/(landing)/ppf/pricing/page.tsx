import type { Metadata } from 'next'
import { PPF_PAGES, PPF_TESTIMONIALS, PPF_FAQ, PPF_PACKAGES, buildJsonLd } from '../../lib/page-data'
import { getPageImages } from '../../lib/get-landing-images'
import HeroSection from '../../components/HeroSection'
import SocialProofBar from '../../components/SocialProofBar'
import PackageCard from '../../components/PackageCard'
import FAQSection from '../../components/FAQSection'
import PPFTrustSection from '../../components/PPFTrustSection'
import TestimonialCard from '../../components/TestimonialCard'
import LeadForm from '../../components/LeadForm'

const SLUG = 'ppf-pricing'
const page = PPF_PAGES[SLUG]

export const metadata: Metadata = {
  title: page.meta.title,
  description: page.meta.description,
  openGraph: {
    title: page.meta.title,
    description: page.meta.description,
    images: [page.meta.ogImage],
  },
}

export default async function PPFPricingPage() {
  const images = await getPageImages(SLUG)
  const jsonLd = buildJsonLd(page.meta.description)

  return (
    <>
      {/* 1. Hero + Form */}
      <HeroSection
        {...page.hero}
        heroImage={images.hero}
        pageSlug={SLUG}
        formType="ppf"
        submissionFormType="ppf_pricing"
        coverageOptions={page.coverageOptions}
      />

      {/* 2. Social Proof */}
      <SocialProofBar text="Trusted by Frederick for 13+ Years" />

      {/* 3. Packages Section */}
      <section className="py-16 bg-black">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-white text-center mb-4">
            PPF Coverage Options
          </h2>
          <p className="text-gray-400 text-center mb-10 max-w-2xl mx-auto">
            Pricing varies by vehicle size, model, and coverage area. Here&apos;s what to expect.
          </p>
<<<<<<< HEAD
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {PPF_PACKAGES.map((pkg, i) => (
              <PackageCard key={pkg.title} {...pkg} image={images.services[i]} />
=======
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {PPF_PACKAGES.map(pkg => (
              <PackageCard key={pkg.title} {...pkg} />
>>>>>>> claude/fwg-landing-pages-mcae2
            ))}
          </div>
          <div className="mt-8 bg-zinc-800 rounded-xl p-6 text-center">
            <p className="text-gray-300 text-sm leading-relaxed">
              Every quote is customized to your specific vehicle. Factors that affect pricing include vehicle size, body complexity, and film coverage area. Call or fill out the form for an accurate quote.
            </p>
          </div>
        </div>
      </section>

      {/* 4. Why Pricing Varies */}
      <section className="py-16 bg-zinc-900">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-white text-center mb-10">
            Why PPF Pricing Varies
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-[#CE0000] shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <p className="text-gray-300 text-sm">Vehicle size and body lines affect install complexity</p>
            </div>
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-[#CE0000] shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <p className="text-gray-300 text-sm">Coverage area (partial vs full front vs full body)</p>
            </div>
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-[#CE0000] shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <p className="text-gray-300 text-sm">Film type and warranty level</p>
            </div>
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-[#CE0000] shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <p className="text-gray-300 text-sm">Some vehicles have more complex curves requiring extra labor</p>
            </div>
          </div>
          <p className="text-center mt-8 text-gray-400 text-sm">
            The best way to get your price? Just ask. We&apos;ll give you an honest quote in minutes.
          </p>
        </div>
      </section>

      {/* 5. FAQ */}
      <FAQSection items={PPF_FAQ} />

      {/* 6. Trust Section */}
      <PPFTrustSection />

      {/* 7. Testimonials */}
      <section className="py-16 bg-black">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-white text-center mb-10">
            What Our Clients Say
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {PPF_TESTIMONIALS.map(t => (
              <TestimonialCard key={t.name} {...t} />
            ))}
          </div>
        </div>
      </section>

      {/* 8. Final CTA */}
      <section className="py-16 bg-zinc-900">
        <div className="max-w-lg mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-3">
            Ready to Protect Your Paint?
          </h2>
          <p className="text-gray-400 mb-8">
            Get a free, no-obligation quote for your PPF installation.
          </p>
          <LeadForm
            pageSlug={SLUG}
            variant="cta"
            formType="ppf"
            submissionFormType="ppf_pricing"
            coverageOptions={page.coverageOptions}
          />
        </div>
      </section>

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  )
}
