// ─── Why Us / Trust Section ───
// 3-column layout: Experience, Quality, Process.
// Replace stats and details with real numbers when ready.

export default function TrustSection() {
  return (
    <section className="py-16 bg-gradient-to-b from-black to-zinc-900">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-white text-center mb-12">
          Why Frederick Wraps & Graphics?
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Experience */}
          <div className="text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#CE0000]/15 flex items-center justify-center">
              <svg className="w-7 h-7 text-[#CE0000]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <h3 className="text-white font-bold text-xl mb-3">Experience</h3>
            {/* Update these stats with real numbers */}
            <p className="text-3xl font-bold text-[#CE0000] mb-2">500+</p>
            <p className="text-gray-200 text-sm mb-1">Vehicles Wrapped</p>
            <p className="text-gray-400 text-xs">
              Years of experience serving Frederick, MD and the surrounding area.
            </p>
          </div>

          {/* Quality */}
          <div className="text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#CE0000]/15 flex items-center justify-center">
              <svg className="w-7 h-7 text-[#CE0000]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <h3 className="text-white font-bold text-xl mb-3">Quality</h3>
            <p className="text-gray-200 text-sm mb-3">
              3M &amp; Avery Dennison certified materials with manufacturer warranties.
            </p>
            <div className="flex justify-center gap-3">
              {/* Badge placeholders — replace with real certification images */}
              <div className="h-8 px-3 bg-zinc-800 rounded-lg flex items-center">
                <span className="text-gray-400 text-xs font-semibold">3M</span>
              </div>
              <div className="h-8 px-3 bg-zinc-800 rounded-lg flex items-center">
                <span className="text-gray-400 text-xs font-semibold">Avery</span>
              </div>
            </div>
          </div>

          {/* Process */}
          <div className="text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#CE0000]/15 flex items-center justify-center">
              <svg className="w-7 h-7 text-[#CE0000]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-white font-bold text-xl mb-3">Process</h3>
            <div className="flex justify-center gap-2 text-xs text-gray-400">
              {['Design', 'Print', 'Install', 'Drive'].map((step, i) => (
                <span key={step} className="flex items-center gap-1">
                  {i > 0 && (
                    <svg className="w-3 h-3 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                  <span className="bg-zinc-800 px-2 py-1 rounded-lg">{step}</span>
                </span>
              ))}
            </div>
            <p className="text-gray-400 text-xs mt-3">
              Simple, transparent process from first call to finished vehicle.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
