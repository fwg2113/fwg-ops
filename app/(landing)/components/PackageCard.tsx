// ─── Package Card ───
<<<<<<< HEAD
// Displays a PPF package with pricing, title, and description.
// Used on the PPF pricing page.

import ImageWithFallback from './ImageWithFallback'
=======
// Displays a PPF package with pricing, title, features, and optional "Most Popular" badge.
// Clean, text-focused card design without vehicle images.
>>>>>>> claude/fwg-landing-pages-mcae2

type Props = {
  title: string
  description: string
  price: string
<<<<<<< HEAD
  imageAlt: string
  image?: string
}

const GRADIENTS = [
  'from-red-950 to-red-900',
  'from-rose-950 to-red-950',
  'from-stone-900 to-red-950',
]

export default function PackageCard({ title, description, price, imageAlt, image }: Props) {
  const idx = title.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % GRADIENTS.length

  return (
    <div className="bg-zinc-800 rounded-xl overflow-hidden">
      <div className="aspect-[16/10] relative">
        {image ? (
          <ImageWithFallback
            src={image}
            alt={imageAlt}
            className="absolute inset-0 w-full h-full object-cover"
            fallbackGradient={GRADIENTS[idx]}
            fallbackLabel={imageAlt}
          />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${GRADIENTS[idx]} flex items-center justify-center p-4`}>
            <span className="text-white/60 text-sm text-center font-medium">{imageAlt}</span>
          </div>
        )}
      </div>

      <div className="p-5">
        <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
        <p className="text-gray-400 text-sm leading-relaxed mb-3">{description}</p>
        <p className="text-[#CE0000] font-bold text-lg">{price}</p>
=======
  features: string[]
  popular?: boolean
}

export default function PackageCard({ title, description, price, features, popular }: Props) {
  // Split price into label + amount for consistent vertical alignment
  const hasStartingAt = price.toLowerCase().includes('starting at')
  const priceAmount = hasStartingAt ? price.replace(/.*starting at\s*/i, '') : price
  const isContactPrice = priceAmount.toLowerCase().includes('contact')
  const priceLabel = hasStartingAt ? 'Most Vehicles\nStarting at' : isContactPrice ? '\n' : '\nPer Vehicle'

  return (
    <div className="flex flex-col items-center">
      {popular ? (
        <span className="bg-[#CE0000] text-white text-xs font-bold uppercase tracking-wider px-4 py-1.5 rounded-t-xl">
          Most Popular
        </span>
      ) : (
        <span className="h-[30px]" />
      )}
      <div
        className={`rounded-xl p-6 flex flex-col flex-1 w-full text-center ${
          popular
            ? 'bg-zinc-800 border-2 border-[#CE0000]'
            : 'bg-zinc-800'
        }`}
      >
        <h3 className="text-white font-bold text-lg mb-1">{title}</h3>
        <p className="text-gray-400 text-sm leading-relaxed mb-4 min-h-[3.5rem]">{description}</p>

        <div className="mb-4">
          <p className="text-gray-400 text-xs uppercase tracking-wide mb-1 whitespace-pre-line">
            {priceLabel}
          </p>
          <p className="text-[#CE0000] font-bold text-2xl">{priceAmount}</p>
        </div>

        <ul className="space-y-2 text-left">
          {features.map(f => (
            <li key={f} className="flex items-start gap-2 text-gray-300 text-sm">
              <svg
                className="w-4 h-4 text-[#CE0000] shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              {f}
            </li>
          ))}
        </ul>
>>>>>>> claude/fwg-landing-pages-mcae2
      </div>
    </div>
  )
}
