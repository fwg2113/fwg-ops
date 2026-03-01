// ─── Service Card ───
// Displays a service with image, title, and description.
// Image loads automatically from R2 bucket: service-{pageSlug}-{index}.jpg
// If no image exists, shows a gradient fallback.
// Cards are NOT clickable links.

import ImageWithFallback from './ImageWithFallback'
import { R2_LANDING_BASE } from '../lib/page-data'

type Props = {
  title: string
  description: string
  imageAlt: string
  pageSlug: string
  index: number
}

const GRADIENTS = [
  'from-blue-900 to-blue-700',
  'from-indigo-900 to-indigo-700',
  'from-cyan-900 to-cyan-700',
  'from-violet-900 to-violet-700',
]

export default function ServiceCard({ title, description, imageAlt, pageSlug, index }: Props) {
  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden">
      {/* Auto-loads service-{pageSlug}-{index}.jpg from R2 bucket */}
      <div className="aspect-[16/10] relative">
        <ImageWithFallback
          src={`${R2_LANDING_BASE}/service-${pageSlug}-${index}.jpg`}
          alt={imageAlt}
          className="absolute inset-0 w-full h-full object-cover"
          fallbackGradient={GRADIENTS[index % GRADIENTS.length]}
          fallbackLabel={imageAlt}
        />
      </div>

      <div className="p-5">
        <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
        <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
      </div>
    </div>
  )
}
