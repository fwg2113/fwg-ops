import LeadForm from './LeadForm'
import ImageWithFallback from './ImageWithFallback'

// ─── Hero Section ───
// Full-width background with dark gradient overlay.
// heroImage URL is resolved server-side from the R2 bucket.
// If no image exists, shows a dark gradient fallback.

type Props = {
  h1: string
  subline: string
  subheadline: string
  trustBullets: string[]
  heroImageAlt: string
  heroImage?: string
  formOptions: { label: string; value: string }[]
  pageSlug: string
}

export default function HeroSection({
  h1,
  subline,
  subheadline,
  trustBullets,
  heroImageAlt,
  heroImage,
  formOptions,
  pageSlug,
}: Props) {
  return (
    <section className="relative min-h-screen pt-20 flex items-center">
      {/* Background */}
      <div className="absolute inset-0">
        {heroImage ? (
          <ImageWithFallback
            src={heroImage}
            alt={heroImageAlt}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-800 to-black" />
        )}
        {/* Dark overlay so white text is readable over the photo */}
        <div className="absolute inset-0 bg-black/60" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-12 md:py-20 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left — Text content */}
          <div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-2">
              {h1}
            </h1>
            <p className="text-xl md:text-2xl text-red-500 font-semibold mb-6">
              {subline}
            </p>
            <p className="text-gray-200 text-lg leading-relaxed mb-8 max-w-xl">
              {subheadline}
            </p>

            {/* Trust bullets */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
              {trustBullets.map(bullet => (
                <div key={bullet} className="flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-[#CE0000] shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-slate-100 text-sm font-medium">{bullet}</span>
                </div>
              ))}
            </div>

            {/* CTA button — scrolls to form */}
            <a
              href="#quote-form"
              className="inline-block bg-[#CE0000] hover:bg-[#A30000] text-white font-bold text-lg px-8 py-4 rounded-lg transition-colors lg:hidden"
            >
              Get Your Free Quote
            </a>
          </div>

          {/* Right — Lead form */}
          <div className="lg:max-w-md lg:ml-auto">
            <LeadForm formOptions={formOptions} pageSlug={pageSlug} variant="hero" />
          </div>
        </div>
      </div>
    </section>
  )
}
