// ─── Package Card ───
// Displays a PPF package with pricing, title, features, and optional "Most Popular" badge.
// Clean, text-focused card design without vehicle images.

type Props = {
  title: string
  description: string
  price: string
  features: string[]
  popular?: boolean
}

export default function PackageCard({ title, description, price, features, popular }: Props) {
  return (
    <div className="flex flex-col">
      {popular ? (
        <span className="self-start bg-[#CE0000] text-white text-xs font-bold uppercase tracking-wider px-4 py-1.5 rounded-t-xl">
          Most Popular
        </span>
      ) : (
        <span className="h-[30px]" />
      )}
      <div
        className={`rounded-xl p-6 flex flex-col flex-1 ${
          popular
            ? 'bg-zinc-800 border-2 border-[#CE0000] rounded-tl-none'
            : 'bg-zinc-800'
        }`}
      >
        <h3 className="text-white font-bold text-lg mb-1">{title}</h3>
        <p className="text-gray-400 text-sm leading-relaxed mb-4">{description}</p>

        <p className="text-[#CE0000] font-bold text-2xl mb-4">{price}</p>

        <ul className="space-y-2 mt-auto">
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
      </div>
    </div>
  )
}
