// ─── Service Card ───
// Displays a service with placeholder image, title, and description.
// Cards are NOT clickable links.

type Props = {
  title: string
  description: string
  imageAlt: string
}

// Deterministic gradient colors based on card index
const GRADIENTS = [
  'from-blue-900 to-blue-700',
  'from-indigo-900 to-indigo-700',
  'from-cyan-900 to-cyan-700',
  'from-violet-900 to-violet-700',
]

export default function ServiceCard({ title, description, imageAlt }: Props & { index?: number }) {
  // Pick gradient based on title hash
  const idx =
    title.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) %
    GRADIENTS.length

  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden">
      {/* Placeholder image — replace with next/image when real photos are ready */}
      <div
        className={`aspect-[16/10] bg-gradient-to-br ${GRADIENTS[idx]} flex items-center justify-center p-4`}
      >
        <span className="text-white/60 text-sm text-center font-medium">
          {imageAlt}
        </span>
      </div>

      <div className="p-5">
        <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
        <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
      </div>
    </div>
  )
}
