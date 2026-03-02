// ─── Video Section ───
// Placeholder video thumbnail with play button.
// Replace with real embedded video (YouTube/Vimeo) when ready.
// Autoplay is OFF.

export default function VideoSection() {
  return (
    <section className="py-16 bg-zinc-900">
      <div className="max-w-4xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-white text-center mb-8">
          See Our Work in Action
        </h2>

        {/* Video placeholder — replace with real embed */}
        <div className="relative aspect-video rounded-xl overflow-hidden bg-black">
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {/* Play button */}
            <div className="w-16 h-16 rounded-full bg-[#CE0000]/90 flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-white ml-1"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <p className="text-white/50 text-sm">
              VIDEO: Showcase reel of vehicle wrap installations
            </p>
          </div>
        </div>

        <p className="text-gray-400 text-sm text-center mt-4">
          Watch how we transform commercial vehicles into powerful mobile advertisements.
        </p>
      </div>
    </section>
  )
}
