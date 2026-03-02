import type { Metadata } from 'next'
import { PAGES, TESTIMONIALS, BEFORE_AFTER, buildJsonLd } from '../lib/page-data'
import { getPageImages } from '../lib/get-landing-images'
import HeroSection from '../components/HeroSection'
import SocialProofBar from '../components/SocialProofBar'
import ServiceCard from '../components/ServiceCard'
import VideoSection from '../components/VideoSection'
import BeforeAfterSlider from '../components/BeforeAfterSlider'
import TrustSection from '../components/TrustSection'
import TestimonialCard from '../components/TestimonialCard'
import LeadForm from '../components/LeadForm'

const SLUG = 'commercial-vehicle-wraps'
const page = PAGES[SLUG]

export const metadata: Metadata = {
  title: page.meta.title,
  description: page.meta.description,
  openGraph: {
    title: page.meta.title,
    description: page.meta.description,
    images: [page.meta.ogImage],
  },
}

export default async function CommercialVehicleWrapsPage() {
  const images = await getPageImages(SLUG)
  const jsonLd = buildJsonLd(page.meta.description)

  return (
    <>
      {/* 1. Hero + Form */}
      <HeroSection
        {...page.hero}
        heroImage={images.hero}
        pageSlug={SLUG}
      />

      {/* 2. Social Proof */}
      <SocialProofBar />

      {/* 3. Services Grid */}
      <section className="py-16 bg-black">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-white text-center mb-4">
            Our Commercial Wrap Services
          </h2>
          <p className="text-gray-400 text-center mb-10 max-w-2xl mx-auto">
            From single trucks to full fleets — we handle every type of commercial vehicle.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {page.services.map((s, i) => (
              <ServiceCard key={s.title} {...s} image={images.services[i]} />
            ))}
          </div>
        </div>
      </section>

      {/* 4. Video — hidden until video asset is ready */}
      {/* <VideoSection /> */}

      {/* 5. Before/After Gallery */}
      <section className="py-16 bg-black">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-white text-center mb-4">
            Before &amp; After
          </h2>
          <p className="text-gray-400 text-center mb-10">
            Drag the slider to see the transformation.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {BEFORE_AFTER.map((ba, i) => (
              <BeforeAfterSlider
                key={i}
                {...ba}
                beforeImage={images.beforeAfter[i]?.before}
                afterImage={images.beforeAfter[i]?.after}
              />
            ))}
          </div>
        </div>
      </section>

      {/* 6. Trust Section */}
      <TrustSection />

      {/* 7. Testimonials */}
      <section className="py-16 bg-black">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-white text-center mb-10">
            What Our Clients Say
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {TESTIMONIALS.map(t => (
              <TestimonialCard key={t.name} {...t} />
            ))}
          </div>
        </div>
      </section>

      {/* 8. Final CTA */}
      <section className="py-16 bg-zinc-900">
        <div className="max-w-lg mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-3">
            Ready to Transform Your Fleet?
          </h2>
          <p className="text-gray-400 mb-8">
            Get a free, no-obligation quote for your commercial vehicle wrap project.
          </p>
          <LeadForm
            pageSlug={SLUG}
            variant="cta"
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
