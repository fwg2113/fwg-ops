import type { Metadata } from 'next'
import { PPF_PAGES, PPF_TESTIMONIALS, buildJsonLd } from '../../lib/page-data'
import { getPageImages } from '../../lib/get-landing-images'
import HeroSection from '../../components/HeroSection'
import SocialProofBar from '../../components/SocialProofBar'
import ServiceCard from '../../components/ServiceCard'
import PPFTrustSection from '../../components/PPFTrustSection'
import TestimonialCard from '../../components/TestimonialCard'
import LeadForm from '../../components/LeadForm'

const SLUG = 'ppf-tesla'
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

export default async function PPFTeslaPage() {
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
        coverageOptions={page.coverageOptions}
      />

      {/* 2. Social Proof */}
      <SocialProofBar text="Trusted by Frederick for 13+ Years" />

      {/* 3. Tesla Models Grid */}
      <section className="py-16 bg-black">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-white text-center mb-4">
            PPF for Every Tesla
          </h2>
          <p className="text-gray-400 text-center mb-10 max-w-2xl mx-auto">
            Dedicated PPF packages for every Tesla model in the lineup.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {page.services.map((s, i) => (
              <ServiceCard key={s.title} {...s} image={images.services[i]} />
            ))}
          </div>
        </div>
      </section>

      {/* 4. Why Tesla Owners Choose PPF */}
      <section className="py-16 bg-zinc-900">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-white text-center mb-10">
            Why Tesla Owners Choose PPF
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                title: 'Thinner Paint',
                text: 'Tesla\'s paint is thinner than most manufacturers, making it more susceptible to damage.',
              },
              {
                title: 'Visible Rock Chips',
                text: 'Rock chips are visible almost immediately on dark colors like black and midnight blue.',
              },
              {
                title: 'Self-Healing Technology',
                text: 'PPF is self-healing — minor scratches disappear with heat from the sun or warm water.',
              },
              {
                title: 'Resale Value',
                text: 'Preserves resale value and keeps your Tesla looking showroom-new for years.',
              },
            ].map(item => (
              <div key={item.title} className="flex items-start gap-4 bg-zinc-800 rounded-xl p-5">
                <svg className="w-6 h-6 text-[#CE0000] shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div>
                  <h3 className="text-white font-semibold text-sm mb-1">{item.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Trust Section */}
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
