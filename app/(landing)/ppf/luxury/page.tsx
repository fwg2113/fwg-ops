import type { Metadata } from 'next'
import { PPF_PAGES, PPF_TESTIMONIALS, PPF_PACKAGES, buildJsonLd } from '../../lib/page-data'
import { getPageImages } from '../../lib/get-landing-images'
import HeroSection from '../../components/HeroSection'
import SocialProofBar from '../../components/SocialProofBar'
import ServiceCard from '../../components/ServiceCard'
import PackageCard from '../../components/PackageCard'
import PPFTrustSection from '../../components/PPFTrustSection'
import TestimonialCard from '../../components/TestimonialCard'
import LeadForm from '../../components/LeadForm'

const SLUG = 'ppf-luxury'
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

export default async function PPFLuxuryPage() {
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
        submissionFormType="ppf_luxury"
        coverageOptions={page.coverageOptions}
      />

      {/* 2. Social Proof */}
      <SocialProofBar text="Trusted by Frederick for 13+ Years" />

      {/* 3. Vehicle Types Grid */}
      <section className="py-16 bg-black">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-white text-center mb-4">
            PPF for Luxury &amp; High-Performance Vehicles
          </h2>
          <p className="text-gray-400 text-center mb-10 max-w-2xl mx-auto">
            Premium paint protection for the vehicles that deserve it most.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {page.services.map((s, i) => (
              <ServiceCard key={s.title} {...s} image={images.services[i]} />
            ))}
          </div>
        </div>
      </section>

      {/* 4. New Car Section */}
      <section className="py-16 bg-zinc-900">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Just Bought a New Car?
          </h2>
          <p className="text-gray-300 text-lg leading-relaxed mb-8">
            The best time to install PPF is before your first rock chip — not after. Bring your new vehicle to us and we&apos;ll protect it before the road does damage. We regularly work with customers who drive straight from the dealership to our shop.
          </p>
          <a
            href="#quote-form"
            className="inline-block bg-[#CE0000] hover:bg-[#A30000] text-white font-bold text-lg px-8 py-4 rounded-lg transition-colors"
          >
            Get Your Free Quote
          </a>
        </div>
      </section>

      {/* 5. Packages & Pricing */}
      <section className="py-16 bg-black">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-white text-center mb-4">
            PPF Packages &amp; Pricing
          </h2>
          <p className="text-gray-400 text-center mb-10 max-w-2xl mx-auto">
            Pricing varies by vehicle size and model. Choose the coverage level that fits your needs.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {PPF_PACKAGES.map(pkg => (
              <PackageCard key={pkg.title} {...pkg} />
            ))}
          </div>
          <p className="text-center mt-8 text-gray-500 text-sm">
            Every quote is customized to your specific vehicle. Contact us for an accurate estimate.
          </p>
        </div>
      </section>

      {/* 6. Trust Section */}
      <PPFTrustSection />

      {/* 6. Testimonials */}
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

      {/* 7. Final CTA */}
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
            submissionFormType="ppf_luxury"
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
