// =============================================
//  LANDING PAGE CONTENT
//  All page-specific content lives here for easy editing.
//  Update text, swap placeholder descriptions, etc.
// =============================================

// ─── Business Info (used in header, footer, JSON-LD) ───

export const BUSINESS = {
  name: 'Frederick Wraps & Graphics',
  phone: '(240) 693-3715',
  phoneTel: 'tel:+12406933715',
  address: {
    street: '5728 Industry Ln, Unit 8',
    city: 'Frederick',
    state: 'MD',
    zip: '21704',
  },
  hours: 'Mon–Fri 8 AM – 5 PM',
  url: 'https://frederickwraps.com',
}

// ─── Vehicle count dropdown (shared across all pages) ───

export const VEHICLE_COUNT_OPTIONS = [
  { label: '1', value: '1' },
  { label: '2–5', value: '2-5' },
  { label: '6–10', value: '6-10' },
  { label: '10+', value: '10+' },
]

// ─── Shared testimonials (replace with real ones later) ───

export const TESTIMONIALS = [
  {
    quote:
      'The wrap on our delivery fleet has been incredible for brand recognition. Every vehicle is a moving billboard — we get calls daily from people who saw our trucks on the road.',
    name: 'Mike R.',
    company: 'R&R Plumbing',
  },
  {
    quote:
      'Professional work from start to finish. Our box truck wrap looks amazing and has held up through two winters already. Highly recommend Frederick Wraps.',
    name: 'Sarah T.',
    company: 'Frederick Catering Co.',
  },
  {
    quote:
      'Turned our plain white vans into rolling billboards. The design team nailed our brand and the install was flawless. Best marketing investment we\'ve made.',
    name: 'James K.',
    company: 'DMV Electric',
  },
]

// ─── Shared before/after gallery labels ───

export const BEFORE_AFTER = [
  {
    beforeLabel: 'BEFORE: Plain white cargo van — no branding',
    afterLabel: 'AFTER: Full branded cargo van wrap',
  },
  {
    beforeLabel: 'BEFORE: Unmarked box truck',
    afterLabel: 'AFTER: Fully wrapped box truck with company graphics',
  },
  {
    beforeLabel: 'BEFORE: Blank pickup truck',
    afterLabel: 'AFTER: Partial wrap with logo, phone, and website',
  },
]

// ─── Per-page data ───

export type ServiceItem = {
  title: string
  description: string
  imageAlt: string
}

export type PageContent = {
  meta: {
    title: string
    description: string
    ogImage: string
  }
  hero: {
    h1: string
    subline: string
    subheadline: string
    trustBullets: string[]
    heroImageAlt: string
    heroImage?: string
  }
  services: ServiceItem[]
  formOptions: { label: string; value: string }[]
}

export const PAGES: Record<string, PageContent> = {
  'commercial-vehicle-wraps': {
    meta: {
      title: 'Commercial Vehicle Wraps | Frederick Wraps & Graphics',
      description:
        'Full and partial wraps for trucks, vans, trailers, and fleets. Designed, printed, and installed in Frederick, MD. Free consultation.',
      ogImage: '/images/hero/commercial-vehicle-wraps-og.jpg',
    },
    hero: {
      h1: 'Commercial Vehicle Wraps',
      subline: 'That Get Your Brand Noticed',
      subheadline:
        'Full and partial wraps for trucks, vans, trailers, and fleets. Designed, printed, and installed in Frederick, MD.',
      trustBullets: [
        'Certified Wrap Installers',
        '3M & Avery Dennison Materials',
        'Free Design Consultation',
        'Fleet Discounts Available',
      ],
      heroImageAlt: 'Commercial vehicle wrap by Frederick Wraps & Graphics',
      heroImage: 'https://pub-fc53e761336c467eb14e978df4383491.r2.dev/commercial.jpg',
    },
    services: [
      {
        title: 'Truck Wraps',
        description:
          'Full and partial wraps for pickup trucks and heavy-duty work trucks. Maximum visibility on the road.',
        imageAlt: 'SERVICE: Wrapped pickup truck or work truck',
      },
      {
        title: 'Van & Sprinter Wraps',
        description:
          'Transform cargo vans and Sprinters into branded mobile advertisements that work 24/7.',
        imageAlt: 'SERVICE: Branded cargo van or Sprinter wrap',
      },
      {
        title: 'Fleet Wraps',
        description:
          'Consistent branding across your entire fleet with volume pricing for 3 or more vehicles.',
        imageAlt: 'SERVICE: Multiple branded fleet vehicles',
      },
      {
        title: 'Food Truck & Trailer Wraps',
        description:
          'Eye-catching wraps for food trucks, enclosed trailers, and specialty vehicles.',
        imageAlt: 'SERVICE: Wrapped food truck or trailer',
      },
    ],
    formOptions: [
      { label: 'Full Vehicle Wrap', value: 'full_vehicle_wrap' },
      { label: 'Partial Vehicle Wrap', value: 'partial_vehicle_wrap' },
      { label: 'Fleet Wraps (3+ vehicles)', value: 'fleet_wraps' },
      { label: 'Box Truck Wrap', value: 'box_truck_wrap' },
      { label: 'Food Truck Wrap', value: 'food_truck_wrap' },
      { label: 'Not Sure', value: 'not_sure' },
    ],
  },

  'vehicle-lettering-graphics': {
    meta: {
      title: 'Vehicle Lettering & Graphics | Frederick Wraps & Graphics',
      description:
        'Custom lettering, logos, DOT numbers, and graphics for trucks, vans, and fleet vehicles. Designed and applied in Frederick, MD.',
      ogImage: '/images/hero/vehicle-lettering-graphics-og.jpg',
    },
    hero: {
      h1: 'Vehicle Lettering & Graphics',
      subline: 'Professional Branding for Your Fleet',
      subheadline:
        'Custom lettering, logos, DOT numbers, and graphics for trucks, vans, and fleet vehicles. Designed and applied in Frederick, MD.',
      trustBullets: [
        'Custom Design Included',
        'DOT & USDOT Compliant Lettering',
        'Same-Week Turnaround Available',
        'Fleet Volume Pricing',
      ],
      heroImageAlt: 'HERO: Vehicle with professional lettering and graphics',
    },
    services: [
      {
        title: 'Truck & Van Lettering',
        description:
          'Professional cut vinyl lettering for company name, phone number, and services on any vehicle.',
        imageAlt: 'SERVICE: Truck with vinyl lettering',
      },
      {
        title: 'Logo & Graphics Application',
        description:
          'Your logo and custom graphics applied precisely to doors, tailgates, and panels.',
        imageAlt: 'SERVICE: Vehicle with applied logo and graphics',
      },
      {
        title: 'DOT & USDOT Numbers',
        description:
          'Compliant DOT, USDOT, MC, and GVW number lettering for commercial vehicles.',
        imageAlt: 'SERVICE: Truck with DOT/USDOT number lettering',
      },
      {
        title: 'Fleet Graphics Packages',
        description:
          'Unified graphics packages for fleets of any size — consistent branding across every vehicle.',
        imageAlt: 'SERVICE: Fleet of vehicles with matching graphics',
      },
    ],
    formOptions: [
      { label: 'Vehicle Lettering', value: 'vehicle_lettering' },
      { label: 'Logo & Graphics', value: 'logo_graphics' },
      { label: 'DOT/USDOT Numbers', value: 'dot_usdot_numbers' },
      { label: 'Fleet Graphics Package', value: 'fleet_graphics_package' },
      { label: 'Truck Signage', value: 'truck_signage' },
      { label: 'Not Sure', value: 'not_sure' },
    ],
  },

  'fleet-wraps': {
    meta: {
      title: 'Fleet Wraps & Graphics | Frederick Wraps & Graphics',
      description:
        'Consistent, professional fleet branding for 3 to 300+ vehicles. Design, print, and installation managed under one roof in Frederick, MD.',
      ogImage: '/images/hero/fleet-wraps-og.jpg',
    },
    hero: {
      h1: 'Fleet Wraps & Graphics',
      subline: 'One Brand. Every Vehicle. Maximum Impact.',
      subheadline:
        'Consistent, professional fleet branding for 3 to 300+ vehicles. Design, print, and installation managed under one roof in Frederick, MD.',
      trustBullets: [
        'Volume Pricing for 3+ Vehicles',
        'Single Point of Contact for Entire Fleet',
        'Consistent Brand Application Across All Vehicle Types',
        'National Brands Trust Us',
      ],
      heroImageAlt: 'HERO: Fleet of branded vehicles lined up',
    },
    services: [
      {
        title: 'Full Fleet Wraps',
        description:
          'Complete vehicle coverage for your entire fleet — maximum brand impact on every vehicle.',
        imageAlt: 'SERVICE: Fully wrapped fleet vehicle',
      },
      {
        title: 'Partial Fleet Wraps',
        description:
          'Strategic partial coverage that balances branding impact with budget — great for large fleets.',
        imageAlt: 'SERVICE: Partially wrapped fleet vehicle',
      },
      {
        title: 'Fleet Lettering & Graphics',
        description:
          'Coordinated lettering and graphics across all vehicle types — vans, trucks, and trailers.',
        imageAlt: 'SERVICE: Fleet vehicle with lettering and graphics',
      },
      {
        title: 'Fleet Re-Branding',
        description:
          'Updating your brand? We remove old wraps and apply fresh branding across your fleet.',
        imageAlt: 'SERVICE: Fleet vehicle being re-branded',
      },
    ],
    formOptions: [
      { label: 'Full Fleet Wraps', value: 'full_fleet_wraps' },
      { label: 'Partial Fleet Wraps', value: 'partial_fleet_wraps' },
      { label: 'Fleet Lettering & Graphics', value: 'fleet_lettering_graphics' },
      { label: 'Fleet Re-Brand', value: 'fleet_rebrand' },
      { label: 'Mixed', value: 'mixed' },
      { label: 'Just Getting Pricing', value: 'just_getting_pricing' },
    ],
  },

  'get-quote': {
    meta: {
      title: 'Get a Free Quote | Frederick Wraps & Graphics',
      description:
        'Get a free quote for commercial vehicle wraps, lettering, graphics, and fleet branding in Frederick, MD.',
      ogImage: '/images/hero/get-quote-og.jpg',
    },
    hero: {
      h1: 'Frederick Wraps & Graphics',
      subline: 'Commercial Vehicle Wraps & Lettering',
      subheadline:
        'Full wraps, partial wraps, lettering, graphics, and fleet branding — all designed, printed, and installed in Frederick, MD. Get your free quote today.',
      trustBullets: [
        'Certified Wrap Installers',
        '3M & Avery Dennison Materials',
        'Free Design Consultation',
        'Fleet Discounts Available',
      ],
      heroImageAlt: 'HERO: Showcase of various wrapped vehicles',
    },
    services: [
      {
        title: 'Commercial Vehicle Wraps',
        description:
          'Full and partial wraps for trucks, vans, trailers, and more. Maximum brand impact.',
        imageAlt: 'SERVICE: Wrapped commercial vehicle',
      },
      {
        title: 'Vehicle Lettering & Graphics',
        description:
          'Custom lettering, logos, DOT numbers, and graphics for any commercial vehicle.',
        imageAlt: 'SERVICE: Vehicle with professional lettering',
      },
      {
        title: 'Fleet Branding',
        description:
          'Consistent branding across your entire fleet — from 3 vehicles to 300+.',
        imageAlt: 'SERVICE: Fleet of branded vehicles',
      },
    ],
    formOptions: [
      { label: 'Commercial Vehicle Wraps', value: 'commercial_vehicle_wraps' },
      { label: 'Vehicle Lettering & Graphics', value: 'vehicle_lettering_graphics' },
      { label: 'Fleet Wraps', value: 'fleet_wraps' },
      { label: 'Other', value: 'other' },
      { label: 'Not Sure', value: 'not_sure' },
    ],
  },
}

// ─── Fleet page process steps ───

export const FLEET_PROCESS_STEPS = [
  {
    step: 1,
    title: 'Consultation & Design',
    description: 'We meet to understand your brand, fleet size, and goals — then create custom designs.',
  },
  {
    step: 2,
    title: 'Proof & Approval',
    description: 'Review digital proofs and vehicle mockups. Revisions included until you\'re 100% satisfied.',
  },
  {
    step: 3,
    title: 'Print & Produce',
    description: 'Your approved designs are printed on premium 3M or Avery Dennison vinyl in-house.',
  },
  {
    step: 4,
    title: 'Install & Launch',
    description: 'Professional installation by certified technicians. Your fleet hits the road looking sharp.',
  },
]

// ─── JSON-LD LocalBusiness schema (shared, page description varies) ───

export function buildJsonLd(pageDescription: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: BUSINESS.name,
    description: pageDescription,
    address: {
      '@type': 'PostalAddress',
      streetAddress: BUSINESS.address.street,
      addressLocality: BUSINESS.address.city,
      addressRegion: BUSINESS.address.state,
      postalCode: BUSINESS.address.zip,
    },
    telephone: '+12406933715',
    url: BUSINESS.url,
    openingHours: 'Mo-Fr 08:00-17:00',
    priceRange: '$$',
    image: 'https://frederickwraps.com/logo.png',
    areaServed: {
      '@type': 'GeoCircle',
      geoMidpoint: {
        '@type': 'GeoCoordinates',
        latitude: 39.4143,
        longitude: -77.4105,
      },
      geoRadius: '80000',
    },
  }
}
