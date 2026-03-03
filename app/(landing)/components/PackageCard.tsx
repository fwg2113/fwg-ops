// ─── Package Card ───
// Displays a PPF package with pricing, title, and description.
// Used on the PPF pricing page.

import ImageWithFallback from './ImageWithFallback'

type Props = {
  title: string
  description: string
  price: string
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
      </div>
    </div>
  )
}
