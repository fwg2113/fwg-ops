import type { Metadata } from 'next'
import { PAGES, TESTIMONIALS, BEFORE_AFTER, FLEET_PROCESS_STEPS, buildJsonLd } from '../lib/page-data'
import HeroSection from '../components/HeroSection'
import SocialProofBar from '../components/SocialProofBar'
import ServiceCard from '../components/ServiceCard'
import ProcessSteps from '../components/ProcessSteps'
import VideoSection from '../components/VideoSection'
import BeforeAfterSlider from '../components/BeforeAfterSlider'
import TrustSection from '../components/TrustSection'
import TestimonialCard from '../components/TestimonialCard'
import LeadForm from '../components/LeadForm'

const page = PAGES['fleet-wraps']

export const metadata: Metadata = {
  title: page.meta.title,
  description: page.meta.description,
  openGraph: {
    title: page.meta.title,
    description: page.meta.description,
    images: [page.meta.ogImage],
  },
}

export default function FleetWrapsPage() {
  const jsonLd = buildJsonLd(page.meta.description)

  return (
    <>
      {/* 1. Hero + Form */}
      <HeroSection
        {...page.hero}
        formOptions={page.formOptions}
        pageSlug="fleet-wraps"
      />

      {/* 2. Social Proof */}
      <SocialProofBar />

      {/* 3. Services Grid */}
      <section className="py-16 bg-gray-900">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-white text-center mb-4">
            Fleet Wrap &amp; Graphics Solutions
          </h2>
          <p className="text-gray-400 text-center mb-10 max-w-2xl mx-auto">
            Scalable fleet branding from 3 vehicles to 300+ — one point of contact.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {page.services.map(s => (
              <ServiceCard key={s.title} {...s} />
            ))}
          </div>
        </div>
      </section>

      {/* 4. Process Steps (unique to fleet page) */}
      <ProcessSteps steps={FLEET_PROCESS_STEPS} />

      {/* 5. Video */}
      <VideoSection />

      {/* 6. Before/After Gallery */}
      <section className="py-16 bg-gray-900">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-white text-center mb-4">
            Before &amp; After
          </h2>
          <p className="text-gray-400 text-center mb-10">
            Drag the slider to see the transformation.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {BEFORE_AFTER.map((ba, i) => (
              <BeforeAfterSlider key={i} {...ba} />
            ))}
          </div>
        </div>
      </section>

      {/* 7. Trust Section */}
      <TrustSection />

      {/* 8. Testimonials */}
      <section className="py-16 bg-gray-800">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-white text-center mb-10">
            What Our Clients Say
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map(t => (
              <TestimonialCard key={t.name} {...t} />
            ))}
          </div>
        </div>
      </section>

      {/* 9. Final CTA */}
      <section className="py-16 bg-gray-950">
        <div className="max-w-lg mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-3">
            Ready to Transform Your Fleet?
          </h2>
          <p className="text-gray-400 mb-8">
            Get fleet pricing for 3 or more vehicles — one project manager for the entire job.
          </p>
          <LeadForm
            formOptions={page.formOptions}
            pageSlug="fleet-wraps"
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
