// ─── Social Proof Bar ───
// Horizontal strip below hero. Light background.
// "Trusted by 500+ businesses" + star rating + certification badges.

export default function SocialProofBar() {
  return (
    <section className="bg-gray-100 py-4">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
          {/* Trust statement */}
          <div className="flex items-center gap-2">
            <span className="text-gray-900 font-semibold text-sm">
              Trusted by 500+ Businesses
            </span>
            <div className="flex gap-0.5" aria-label="5 star rating">
              {[...Array(5)].map((_, i) => (
                <svg
                  key={i}
                  className="w-4 h-4 text-yellow-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px h-6 bg-gray-300" />

          {/* Certification badges — replace with real badge images */}
          <div className="flex items-center gap-4">
            {/* 3M badge placeholder */}
            <div className="h-8 px-3 bg-gray-200 rounded flex items-center justify-center">
              <span className="text-gray-600 text-xs font-bold">3M Certified</span>
            </div>
            {/* Avery Dennison badge placeholder */}
            <div className="h-8 px-3 bg-gray-200 rounded flex items-center justify-center">
              <span className="text-gray-600 text-xs font-bold">Avery Dennison</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
