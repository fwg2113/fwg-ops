// ─── Testimonial Card ───
// Quote, name, company, and photo placeholder.
// Replace photo placeholder with real client images when ready.

type Props = {
  quote: string
  name: string
  company: string
}

export default function TestimonialCard({ quote, name, company }: Props) {
  return (
    <div className="bg-fwg-card rounded-xl p-6 flex flex-col">
      {/* Stars */}
      <div className="flex gap-1 mb-4" aria-label="5 out of 5 stars">
        {[...Array(5)].map((_, i) => (
          <svg
            key={i}
            className="w-5 h-5 text-fwg-gold"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>

      {/* Quote */}
      <blockquote className="text-fwg-surface text-sm leading-relaxed mb-4 flex-1">
        &ldquo;{quote}&rdquo;
      </blockquote>

      {/* Author */}
      <div className="flex items-center gap-3">
        {/* Photo placeholder — replace with real client photo */}
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-fwg-red to-fwg-red-dark flex items-center justify-center text-white font-bold text-sm shrink-0">
          {name.charAt(0)}
        </div>
        <div>
          <p className="text-white font-semibold text-sm">{name}</p>
          <p className="text-fwg-text-muted text-xs">{company}</p>
        </div>
      </div>
    </div>
  )
}
