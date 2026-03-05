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
    street: '4509 Metropolitan Ct STE D',
    city: 'Frederick',
    state: 'MD',
    zip: '21704',
  },
  hours: ['Mon–Fri 8 AM – 5 PM', 'Saturday 9 AM – 2 PM'],
  url: 'https://frederickwraps.com',
}

// ─── Vehicle count dropdown (shared across all pages) ───

export const VEHICLE_COUNT_OPTIONS = [
  { label: '1', value: '1' },
  { label: '2–5', value: '2-5' },
  { label: '6–10', value: '6-10' },
  { label: '10+', value: '10+' },
]

// ─── Shared testimonials ───

export const TESTIMONIALS = [
  {
    quote:
      'They did an awesome job on my food trailer. Fast turn around time and it looks great. Thanks for the great job.',
    name: 'Chris Moreland',
    company: 'Açaí For Me',
  },
  {
    quote:
      'Great customer service. Fast scheduling. They have completed multiple vehicle lettering as well as custom apparel for us. Highly recommend',
    name: 'Karen May',
    company: "May's Heating & Air",
  },
  {
    quote:
      'I am very happy with the work they did for me see the picture',
    name: 'Jorge Velasquez',
    company: "Mayta's Peruvian Cuisine",
  },
  {
    quote:
      "As the owner of B-Dub's Island Soul Foodtruck and Catering Co, Frederick Wraps and Graphics is hands down my favorite wraps and graphic company!!! They are the only ones I trust with bringing my vision to reality and have ALWAYS far exceeded my expectations. Joe, Sharon and the rest of the team are so knowledgeable, helpful and simply down right GREAT people, who's main objective is to help you meet your business goals by enhancing, spotlighting and bringing awareness to your brand. I recommend them for ALL your wrap and graphic needs",
    name: 'Bobby Waters',
    company: "B-Dub's Island Soul",
  },
  {
    quote:
      'Planning the design went smoothly. Their work turned out great. Highly recommend. Will be back for future work.',
    name: 'Bruce Shankle II',
    company: 'Shankles Optimum Security',
  },
  {
    quote:
      'The folks at Frederick Wrap and Graphics are very nice and responsive. I had them make some small vinyl lettering for a business sign in Frederick and they did it the same day for as reasonable price. I would definitely recommend this business!',
    name: 'Dennis Thomas',
    company: 'Urbana Dryer Vent Cleaning',
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
        'In-House Team of Professional Installers',
        'Avery Dennison, Oracal & 3M Materials',
        'In-House Design Team & Free Consultation',
        'Fleet Discounts Available',
      ],
      heroImageAlt: 'Commercial vehicle wrap by Frederick Wraps & Graphics',
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
        'In-House Team of Professional Installers',
        'Avery Dennison, Oracal & 3M Materials',
        'In-House Design Team & Free Consultation',
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

// ─── PPF-specific testimonials ───

export const PPF_TESTIMONIALS = [
  {
    quote:
      'These guys are amazing. I went in with my Tesla Model 3 for all around tint and a full front PPF. They did a great job and were very kind. Super responsive to texts and pricing is great. Highly recommend!',
    name: 'Parthav Poudel',
    company: 'Frederick, MD',
  },
  {
    quote:
      'Awesome team; and the shop has a family like atmosphere. They did an amazing job on two cars for me. They took the utmost care and treated my cars like they were million dollar rides.',
    name: 'Erik Hutson',
    company: 'Frederick, MD',
  },
  {
    quote:
      'My car looks a 1000% better after these guys worked their magic. There is no question where I will bring all my cars in the future.',
    name: 'Tom Forde',
    company: 'Frederick, MD',
  },
  {
    quote:
      'Incredibly happy with the work these guys did for me. Sharon was very professional and made my experience here very pleasant. I wish I had more cars for them to work on!',
    name: 'Christopher Duffy',
    company: 'Frederick, MD',
  },
]

// ─── PPF before/after gallery labels ───

export const PPF_BEFORE_AFTER = [
  {
    beforeLabel: 'BEFORE: Unprotected vehicle paint',
    afterLabel: 'AFTER: Full front PPF installed',
  },
  {
    beforeLabel: 'BEFORE: Rock chips and road damage',
    afterLabel: 'AFTER: Paint protection film applied',
  },
]

// ─── PPF coverage area options (shared across PPF pages) ───

export const PPF_COVERAGE_OPTIONS = [
  { label: 'Full Front', value: 'full_front' },
  { label: 'Full Body', value: 'full_body' },
  { label: 'Partial / Custom', value: 'partial_custom' },
  { label: 'Not Sure Yet', value: 'not_sure' },
]

export const PPF_TESLA_COVERAGE_OPTIONS = [
  { label: 'Full Front', value: 'full_front' },
  { label: 'Full Body', value: 'full_body' },
  { label: 'Track Pack (rockers, A-pillars, door edges)', value: 'track_pack' },
  { label: 'Not Sure Yet', value: 'not_sure' },
]

// ─── PPF page data ───

export type PPFPageContent = {
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
  }
  services: ServiceItem[]
  coverageOptions: { label: string; value: string }[]
}

export const PPF_PAGES: Record<string, PPFPageContent> = {
  ppf: {
    meta: {
      title: 'PPF Installation Frederick MD | Paint Protection Film | Frederick Wraps & Graphics',
      description:
        'Premium paint protection film installation in Frederick, MD. Self-healing PPF for rock chips, scratches, and road debris. Free estimates.',
      ogImage: '/images/ppf/hero/ppf-hero.jpg',
    },
    hero: {
      h1: 'Paint Protection Film',
      subline: 'Protect Your Vehicle\'s Paint From Day One',
      subheadline:
        'Premium self-healing PPF installation in Frederick, MD. Stop rock chips, scratches, and road debris before they damage your paint.',
      trustBullets: [
        'SunTek, STEK & Autobahn Films',
        '650+ Five-Star Reviews',
        'Self-Healing Film Technology',
        'Free Estimates & Consultations',
      ],
      heroImageAlt: 'Paint protection film installation by Frederick Wraps & Graphics',
    },
    services: [
      {
        title: 'Full Front PPF',
        description:
          'Protect the hood, fenders, bumper, and mirrors — the areas that take the most abuse from rock chips and road debris.',
        imageAlt: 'SERVICE: Full front PPF installation',
      },
      {
        title: 'Full Body PPF',
        description:
          'Complete bumper-to-bumper protection for your entire vehicle. The ultimate defense against chips, scratches, and swirl marks.',
        imageAlt: 'SERVICE: Full body PPF coverage',
      },
      {
        title: 'Track Pack / Partial PPF',
        description:
          'Custom coverage for high-impact zones — rocker panels, door edges, A-pillars, and more. Tailored to your driving needs.',
        imageAlt: 'SERVICE: Partial PPF on high-impact zones',
      },
      {
        title: 'Ceramic Coating + PPF',
        description:
          'Combine PPF with a professional ceramic coating for the ultimate protection and shine. Self-healing film plus hydrophobic surface.',
        imageAlt: 'SERVICE: Ceramic coating combined with PPF',
      },
    ],
    coverageOptions: PPF_COVERAGE_OPTIONS,
  },

  'ppf-pricing': {
    meta: {
      title: 'PPF Pricing Frederick MD | Paint Protection Film Cost | Frederick Wraps & Graphics',
      description:
        'Transparent PPF pricing for every vehicle. Full front from $2,000+, full body from $5,000+. Free, no-obligation quotes in Frederick, MD.',
      ogImage: '/images/ppf/hero/ppf-pricing-hero.jpg',
    },
    hero: {
      h1: 'PPF Pricing & Packages',
      subline: 'Transparent Pricing. No Surprises.',
      subheadline:
        'Every vehicle is different. Get an honest quote based on your specific vehicle and the coverage you want. No hidden fees, no pressure.',
      trustBullets: [
        'Free Estimates — No Obligation',
        '650+ Five-Star Reviews',
        'SunTek, STEK & Autobahn Films',
        'Honest, Transparent Pricing',
      ],
      heroImageAlt: 'PPF pricing and packages at Frederick Wraps & Graphics',
    },
    services: [
      {
        title: 'Partial / High-Impact Zones',
        description:
          'Protect the most vulnerable areas — door edges, rocker panels, door cups, and A-pillars. Great entry point for PPF.',
        imageAlt: 'SERVICE: Partial PPF on high-impact zones',
      },
      {
        title: 'Full Front Package',
        description:
          'Hood, front bumper, fenders, mirrors, and headlights. The most popular package — protects where it matters most.',
        imageAlt: 'SERVICE: Full front PPF package',
      },
      {
        title: 'Full Body PPF',
        description:
          'Bumper-to-bumper protection for your entire vehicle. The ultimate investment in your paint.',
        imageAlt: 'SERVICE: Full body PPF installation',
      },
    ],
    coverageOptions: PPF_COVERAGE_OPTIONS,
  },

  'ppf-tesla': {
    meta: {
      title: 'Tesla PPF Frederick MD | Tesla Paint Protection Film | Frederick Wraps & Graphics',
      description:
        'Tesla paint protection film in Frederick, MD. PPF for Model 3, Model Y, Model S, Model X, and Cybertruck. Professional installation.',
      ogImage: '/images/ppf/hero/tesla-hero.jpg',
    },
    hero: {
      h1: 'Tesla Paint Protection Film',
      subline: 'Protect Every Tesla Model — Including Cybertruck',
      subheadline:
        'Tesla\'s paint is notoriously soft. PPF is not optional — it\'s essential. We protect Model 3, Model Y, Model S, Model X, and Cybertruck.',
      trustBullets: [
        'All Tesla Models — Including Cybertruck',
        '650+ Five-Star Reviews',
        'SunTek, STEK & Autobahn Films',
        'Self-Healing Film Technology',
      ],
      heroImageAlt: 'Tesla paint protection film installation by Frederick Wraps & Graphics',
    },
    services: [
      {
        title: 'Model 3 PPF',
        description:
          'The best-selling Tesla deserves the best protection. Full front and full body packages available for all Model 3 variants.',
        imageAlt: 'SERVICE: Tesla Model 3 with PPF',
      },
      {
        title: 'Model Y PPF',
        description:
          'Protect your Model Y from day one. Popular packages include full front plus rocker panels for maximum coverage.',
        imageAlt: 'SERVICE: Tesla Model Y with PPF',
      },
      {
        title: 'Model S & Model X PPF',
        description:
          'Premium protection for Tesla\'s flagship models. Custom coverage tailored to the S and X body lines.',
        imageAlt: 'SERVICE: Tesla Model S or Model X with PPF',
      },
      {
        title: 'Cybertruck PPF',
        description:
          'The Cybertruck\'s stainless steel shows everything. PPF keeps it looking factory fresh. We have hands-on Cybertruck experience.',
        imageAlt: 'SERVICE: Tesla Cybertruck with PPF',
      },
    ],
    coverageOptions: PPF_TESLA_COVERAGE_OPTIONS,
  },

  'ppf-luxury': {
    meta: {
      title: 'Luxury Car PPF Frederick MD | BMW, Porsche, Mercedes PPF | Frederick Wraps & Graphics',
      description:
        'Premium PPF installation for BMW, Porsche, Mercedes, Audi, and luxury vehicles in Frederick, MD. Certified Autobahn dealer. Manufacturer-backed warranty.',
      ogImage: '/images/ppf/hero/luxury-hero.jpg',
    },
    hero: {
      h1: 'Luxury Vehicle PPF',
      subline: 'Premium Protection for Premium Vehicles',
      subheadline:
        'Your BMW, Porsche, Mercedes, or Audi deserves the best paint protection available. Certified Autobahn dealer in Frederick, MD.',
      trustBullets: [
        'BMW, Porsche, Mercedes & More',
        '650+ Five-Star Reviews',
        'Certified Autobahn Dealer',
        'Manufacturer-Backed Warranty',
      ],
      heroImageAlt: 'Luxury vehicle PPF installation by Frederick Wraps & Graphics',
    },
    services: [
      {
        title: 'BMW PPF',
        description:
          'Protect your BMW\'s paint from rock chips and road debris. Full front and full body packages for all models — 3 Series through X7.',
        imageAlt: 'SERVICE: BMW with paint protection film',
      },
      {
        title: 'Porsche PPF',
        description:
          'Porsche paint demands premium protection. Custom PPF packages for 911, Cayenne, Macan, Taycan, and more.',
        imageAlt: 'SERVICE: Porsche with paint protection film',
      },
      {
        title: 'Mercedes-Benz PPF',
        description:
          'Keep your Mercedes looking showroom-new. PPF installation for C-Class, E-Class, GLE, AMG models, and more.',
        imageAlt: 'SERVICE: Mercedes-Benz with paint protection film',
      },
      {
        title: 'Audi & Others',
        description:
          'Audi, Lexus, Range Rover, trucks, and any vehicle you want to protect. We install PPF on all makes and models.',
        imageAlt: 'SERVICE: Audi or luxury vehicle with PPF',
      },
    ],
    coverageOptions: PPF_COVERAGE_OPTIONS,
  },
}

// ─── PPF FAQ data (pricing page) ───

export type FAQItem = {
  question: string
  answer: string
}

export const PPF_FAQ: FAQItem[] = [
  {
    question: 'How much does PPF cost?',
    answer:
      'PPF pricing depends on your vehicle and coverage area. Full front packages typically start around $2,000 and full body starts around $5,000. We provide free, no-obligation quotes for every vehicle.',
  },
  {
    question: 'Is PPF worth the cost?',
    answer:
      'Absolutely. PPF prevents rock chips, scratches, and paint damage that would cost far more to repair. It also preserves your vehicle\'s resale value. Think of it as insurance for your paint.',
  },
  {
    question: 'Do you offer payment plans?',
    answer: 'Contact us to discuss payment options for your PPF installation.',
  },
  {
    question: 'How long does PPF last?',
    answer:
      'Our SunTek, STEK, and Autobahn films come with manufacturer-backed warranties. With proper care, PPF typically lasts 7-10 years.',
  },
  {
    question: 'What\'s included in a full front package?',
    answer:
      'Full front typically covers the hood, front bumper, fenders, mirrors, and headlights — the areas that take the most abuse from road debris.',
  },
]

// ─── PPF package pricing data ───

export type PackageItem = {
  title: string
  description: string
  price: string
  features: string[]
  popular?: boolean
}

export const PPF_PACKAGES: PackageItem[] = [
  {
    title: 'Essentials',
    description: 'Protect everyday touch points from chips and scratches.',
    price: '$395',
    features: ['Door cups', 'Door edges'],
  },
  {
    title: 'Partial Front',
    description: 'Shield the most vulnerable front-facing surfaces from road debris.',
    price: 'Starting at $995+',
    features: ['Partial hood (24")', 'Partial fenders', 'Mirrors', 'Full bumper'],
  },
  {
    title: 'Full Front',
    description: 'Our most popular package — full coverage where it matters most.',
    price: 'Starting at $1,995+',
    popular: true,
    features: ['Full hood', 'Full fenders', 'Mirrors', 'Headlights', 'Full bumper'],
  },
  {
    title: 'Full Front+',
    description: 'Everything in Full Front plus extended protection for high-wear areas.',
    price: 'Starting at $2,995+',
    features: [
      'Full Front package',
      'A-pillars',
      'Rocker panels',
      'Rear bumper',
      'Luggage strip',
    ],
  },
  {
    title: 'Full Vehicle Coverage',
    description: 'Complete bumper-to-bumper PPF coverage for maximum protection.',
    price: 'Contact for Quote',
    features: [
      'Full body coverage',
      'Every painted surface',
      'Custom-fit installation',
    ],
  },
]

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
    description: 'Professional installation by experienced technicians. Your fleet hits the road looking sharp.',
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
