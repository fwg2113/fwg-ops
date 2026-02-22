'use client'

export default function HandsLogo({ size = 36, color = '#22d3ee' }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Left hand - palm up, fingers spread */}
      <path
        d="M18 72 L14 52 C12 46 13 40 16 36 L18 32 L18 24 C18 20 22 19 22 23 L22 34 M22 34 L24 18 C24 14 28 13 28 17 L26 34 M26 34 L30 14 C30 10 34 9 34 13 L31 34 M31 34 L35 20 C35 16 39 15 39 19 L36 36 C38 30 42 30 42 34 C43 40 40 48 36 54 L28 64 L18 72Z"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Right hand - mirrored */}
      <path
        d="M82 72 L86 52 C88 46 87 40 84 36 L82 32 L82 24 C82 20 78 19 78 23 L78 34 M78 34 L76 18 C76 14 72 13 72 17 L74 34 M74 34 L70 14 C70 10 66 9 66 13 L69 34 M69 34 L65 20 C65 16 61 15 61 19 L64 36 C62 30 58 30 58 34 C57 40 60 48 64 54 L72 64 L82 72Z"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
