# FWG-OPS Technical Snapshot

> Reference document for VF-OPS and any future OPS-style projects.
> Generated from the live FWG-OPS codebase.

---

## 1. Tech Stack Overview

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.1.4 |
| React | React / React DOM | 19.2.3 |
| Language | TypeScript | 5.9.3 |
| CSS | Tailwind CSS v4 | ^4 |
| PostCSS | @tailwindcss/postcss | ^4 |
| Database | Supabase (PostgreSQL) | @supabase/supabase-js ^2.91.1 |
| File Storage | Cloudflare R2 (S3-compatible) | @aws-sdk/client-s3 ^3.985.0 |
| SMS/Voice | Twilio | twilio ^5.12.0, @twilio/voice-sdk ^2.18.0 |
| Email | Gmail API via googleapis | googleapis ^144.0.0 |
| Payments | Stripe (via API routes) | direct API calls |
| PDF Generation | jspdf + html2canvas | jspdf ^4.1.0, html2canvas ^1.4.1 |
| Hosting | Vercel | default Next.js preset |
| Dev Tooling | ESLint (next config), tsx | eslint ^9, tsx ^4.19.2 |

### No UI Component Library

FWG-OPS does **not** use shadcn/ui, Radix, Material UI, or any component library. All UI is built with:
- **Inline styles** (JavaScript `style={{}}` objects) as the primary styling approach
- **Tailwind CSS v4** via `@import "tailwindcss"` for global base styles and utility classes
- **Custom SVG icons** defined inline in components (no Lucide, no icon library)
- **Raw HTML elements** styled directly

### Font Stack
```css
font-family: Arial, Helvetica, sans-serif;  /* body */
font-family: system-ui, sans-serif;         /* used in some components */
```

---

## 2. Project Structure

```
fwg-ops/
├── app/                          # Next.js App Router (all app code lives here)
│   ├── layout.tsx                # Root layout (minimal - just <html><body>)
│   ├── globals.css               # Tailwind v4 import + CSS variables + responsive overrides
│   ├── page.tsx                  # Landing/redirect page
│   │
│   ├── (dashboard)/              # Route group: authenticated dashboard pages
│   │   ├── layout.tsx            # Dashboard shell: Sidebar + main content + PhoneWidget
│   │   ├── analytics/            # Production analytics
│   │   ├── archive/              # Project archive
│   │   ├── calendar/             # Job calendar
│   │   ├── customers/            # Customer database (list + [id] detail)
│   │   ├── dev/                  # Dev requests
│   │   ├── documents/            # Quote/invoice document editor ([id], revision)
│   │   ├── email/                # Gmail inbox integration
│   │   ├── email-templates/      # Email template management
│   │   ├── invoices/             # Invoice list
│   │   ├── messages/             # SMS message hub
│   │   ├── payments/             # Payment history (+ bank sub-route)
│   │   ├── production/           # Production workflow board
│   │   ├── purchase-orders/      # Purchase order management
│   │   ├── quotes/               # Quote list
│   │   ├── settings/             # System settings
│   │   ├── submissions/          # Lead pipeline (form submissions)
│   │   ├── tasks/                # Task board
│   │   └── components/           # Dashboard-scoped components (PhoneWidget)
│   │
│   ├── (landing)/                # Route group: public marketing pages
│   │   ├── components/           # Landing page components
│   │   ├── lib/                  # Landing-specific utilities (R2 image fetching)
│   │   ├── commercial-vehicle-wraps/
│   │   ├── fleet-wraps/
│   │   ├── get-quote/
│   │   ├── ppf/                  # PPF pages (luxury, pricing, tesla)
│   │   ├── thank-you/
│   │   └── vehicle-lettering-graphics/
│   │
│   ├── (noidle)/                 # Route group: "No Idle Hands" gamification system
│   │   └── hands/                # Leaderboard and task completion
│   │
│   ├── api/                      # API routes (Next.js Route Handlers)
│   │   ├── calendar/             # Google Calendar OAuth + API
│   │   ├── customer-actions/     # AI-generated customer follow-up actions
│   │   ├── dev-requests/         # Dev feature requests
│   │   ├── documents/            # Document CRUD, approval, status, revisions
│   │   ├── email/                # Email sending
│   │   ├── estimator/            # Public estimator widget config + submissions
│   │   ├── files/                # File serving from R2
│   │   ├── gmail/                # Gmail OAuth, threads, send, attachments
│   │   ├── messages/             # SMS messages
│   │   ├── migrations/           # DB migration runner
│   │   ├── noidle/               # Gamification API (tasks, leaderboard, prizes)
│   │   ├── payment/              # Stripe checkout session creation
│   │   ├── payments/             # Payment history, sync-to-sheet, mark-read
│   │   ├── pdf/                  # PDF generation
│   │   ├── pricing/              # Pricing engine (calculate, matrices)
│   │   ├── production/           # Production task generation
│   │   ├── proxy-image/          # Image proxy for external URLs
│   │   ├── purchase-orders/      # PO management (aggregate, check-inventory)
│   │   ├── settings/             # System settings CRUD (notifications, pricing, templates)
│   │   ├── sms/                  # Twilio SMS webhook (incoming)
│   │   ├── submissions/          # Form submission handling
│   │   ├── suppliers/            # Supplier API integration (SanMar, S&S Activewear)
│   │   ├── tasks/                # Task CRUD
│   │   ├── upload/               # File upload to R2
│   │   └── voice/                # Twilio voice: call, transfer, conference, voicemail, etc.
│   │
│   ├── components/               # Shared app-level components
│   │   ├── Sidebar.tsx           # Main navigation sidebar
│   │   ├── NotificationManager.tsx  # Real-time notification sound system
│   │   └── operations/           # Quote builder components (ProductSearch, PricingDisplay, etc.)
│   │
│   ├── lib/                      # Core utilities and service modules
│   │   ├── supabase.ts           # Supabase client singleton
│   │   ├── twilio.ts             # Twilio client helper
│   │   ├── gmail.ts              # Gmail OAuth2 client
│   │   ├── googleSheets.ts       # Google Sheets API client
│   │   ├── googleAdsConversion.ts # Google Ads conversion tracking
│   │   ├── pricing.ts            # Pricing engine (quantity breaks, decoration costs)
│   │   ├── notificationSounds.ts # Notification sound playback
│   │   ├── automation-settings.ts # Automation configuration
│   │   ├── category-mapping.ts   # Document category mapping
│   │   ├── payment-sheet-sync.ts # Payment-to-Google-Sheets sync
│   │   ├── dstParser.ts          # DST embroidery file parser
│   │   ├── customer/             # Customer action generator (AI-powered)
│   │   ├── production/           # Production workflow logic
│   │   ├── suppliers/            # Supplier API clients (S&S Activewear)
│   │   └── types/                # TypeScript type definitions
│   │       └── production.ts     # Production workflow types
│   │
│   ├── login/                    # Login page
│   ├── operations/               # Operations page
│   ├── payment-success/          # Stripe payment success page
│   ├── scripts/                  # Migration/import scripts
│   ├── snapshot/                 # Document snapshot viewer ([id])
│   ├── transfer/                 # Call transfer page
│   └── view/                     # Public document view ([id])
│
├── supabase/
│   └── migrations/               # 37 SQL migration files (2026-02 to present)
│
├── migrations/                   # Additional standalone migrations
├── scripts/                      # Build/migration shell scripts
├── public/                       # Static assets
├── legacy-appscript/             # Legacy Google Apps Script code
├── legacy-sheets/                # Legacy spreadsheet data
├── sanmar-integration-info/      # Supplier integration docs
├── form files/                   # Form template files
│
├── next.config.ts                # Next.js config (transpilePackages for Twilio)
├── tsconfig.json                 # TypeScript config (paths: @/* -> ./*)
├── postcss.config.mjs            # PostCSS with @tailwindcss/postcss
├── eslint.config.mjs             # ESLint with next core-web-vitals + typescript
├── package.json
├── package-lock.json
└── yarn.lock
```

**Key structural note:** There is no `src/` directory. All app code lives directly under `app/`. The path alias `@/*` maps to `./*` (project root), so imports look like `@/app/lib/supabase`.

---

## 3. Supabase Usage

### Client Setup

A **single shared client** instance is used everywhere (server components, API routes, client components):

```typescript
// app/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

- Uses `@supabase/supabase-js` directly (not `@supabase/ssr`)
- No separate server/client Supabase instances
- No cookie-based session management through Supabase
- The same singleton is imported everywhere via `import { supabase } from '@/app/lib/supabase'`

### Row Level Security (RLS)

RLS is **not used** in the traditional per-user sense. The app uses the anon key for all operations. Auth is handled separately via a simple cookie-based system (not Supabase Auth).

### Database Schema (37 migrations)

Major tables include:
- `documents` - Quotes and invoices (unified table with `doc_type` column)
- `document_line_items` - Line items for documents
- `customers` - Customer database
- `customer_actions` - AI-generated follow-up action items
- `payments` - Payment records (linked to documents)
- `messages` - SMS message history
- `calls` - Call log
- `settings` - Key-value settings store
- `project_templates` / `template_tasks` - Production workflow templates
- `production_tasks` - Active production tasks
- `purchase_orders` / `purchase_order_items` - Purchase order tracking
- `submissions` - Website form submissions (lead pipeline)
- `email_logs` - Email send history
- `apparel_pricing_matrices` - Decoration pricing tiers
- `noidle_*` tables - Gamification system (tasks, completions, prizes)
- Various automation and settings tables

### Edge Functions

None currently deployed. All server-side logic runs in Next.js API routes.

### Storage

**Cloudflare R2** is used instead of Supabase Storage:
- File uploads go to R2 via `@aws-sdk/client-s3`
- Stored under paths like `documents/{id}/{timestamp}-{filename}` and `uploads/{timestamp}-{filename}`
- Public R2 URLs served via a custom domain or the R2 public endpoint
- Landing page images also served from R2

---

## 4. Authentication

FWG-OPS uses a **simple cookie-based auth** system (not Supabase Auth):

```typescript
// Login: sets cookie + localStorage
document.cookie = `fwg_auth=${btoa(email)}; path=/; max-age=${60*60*24*30}` // 30 days
localStorage.setItem('fwg_user', JSON.stringify({ email, name: 'Joe', role: 'super_admin' }))

// Logout: clears cookie + localStorage
document.cookie = 'fwg_auth=; path=/; max-age=0'
localStorage.removeItem('fwg_user')
```

There is no middleware.ts file — route protection is handled client-side. The app is designed as an internal tool for a single team, not a multi-tenant SaaS.

---

## 5. Environment Variables

### Required Variables

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Supabase admin key (scripts only) |
| `NEXT_PUBLIC_APP_URL` | Public | App URL (defaults to `https://fwg-ops.vercel.app`) |

### Integrations

| Variable | Purpose |
|---|---|
| `TWILIO_ACCOUNT_SID` | Twilio account |
| `TWILIO_AUTH_TOKEN` | Twilio auth |
| `STRIPE_SECRET_KEY` | Stripe payments |
| `R2_ACCOUNT_ID` | Cloudflare R2 account |
| `R2_ACCESS_KEY_ID` | R2 access key |
| `R2_SECRET_ACCESS_KEY` | R2 secret key |
| `R2_BUCKET_NAME` | R2 bucket name |
| `GOOGLE_CLIENT_ID` | Gmail OAuth |
| `GOOGLE_CLIENT_SECRET` | Gmail OAuth |
| `GOOGLE_SHEETS_CREDENTIALS` | Google Sheets service account JSON |
| `GOOGLE_AD_CLIENT_ID` | Google Ads OAuth |
| `GOOGLE_AD_CLIENT_SECRET` | Google Ads OAuth |
| `GOOGLE_AD_REFRESH_TOKEN` | Google Ads refresh token |
| `GOOGLE_AD_CUSTOMER_ID` | Google Ads customer ID |
| `GOOGLE_AD_MANAGER_ID` | Google Ads manager ID |
| `GOOGLE_AD_DEVELOPER_TOKEN` | Google Ads API token |
| `GOOGLE_AD_CONVERSION_ACTION_ID` | Google Ads conversion tracking |
| `SS_ACTIVEWEAR_BASE_URL` | S&S Activewear API |
| `SS_ACTIVEWEAR_ACCOUNT_NUMBER` | S&S account |
| `SS_ACTIVEWEAR_API_KEY` | S&S API key |

No `.env.example` file exists. Variables are managed directly in Vercel environment settings.

---

## 6. Deployment (Vercel)

- **No `vercel.json`** — uses Vercel's default Next.js detection and build settings
- **Build command:** `next build` (standard)
- **Dev command:** `next dev` (no `--turbopack` flag)
- **Framework preset:** Auto-detected as Next.js by Vercel
- **No custom build configuration**, no monorepo settings, no Docker
- Environment variables are configured in the Vercel dashboard
- The `next.config.ts` is minimal:
  ```typescript
  const nextConfig: NextConfig = {
    experimental: { turbopackUseSystemTlsCerts: true },
    transpilePackages: ['@twilio/voice-sdk'],
  };
  ```

---

## 7. Data Fetching Patterns

### Server Components (Primary Pattern)

Most dashboard pages are **async server components** that fetch data directly from Supabase, then pass it as props to client components:

```typescript
// Typical page pattern
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function QuotesPage() {
  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('doc_type', 'quote')
    .order('created_at', { ascending: false })
    .limit(50)

  return <DocumentList initialDocuments={documents || []} />
}
```

Key patterns:
- `export const dynamic = 'force-dynamic'` on every page to prevent stale cache
- `export const revalidate = 0` for immediate freshness
- Data passed as `initialX` props to `'use client'` components
- Client components handle mutations and UI state

### Client-Side Fetching

Client components use **`fetch()` to internal API routes** for mutations and real-time data:

```typescript
// Sidebar badge counts - polling via fetch()
const [msgRes, emailRes, payRes] = await Promise.all([
  fetch('/api/messages/unread-count'),
  fetch('/api/gmail/unread-count'),
  fetch('/api/payments/unread-count'),
])
```

- No React Query / TanStack Query / SWR
- No client-side Supabase calls from components
- All mutations go through `/api/*` route handlers
- Polling via `setInterval` for real-time-ish updates (e.g., 60s for badge counts)
- `window.addEventListener('focus', ...)` to refresh on tab focus

### API Routes

Standard Next.js Route Handlers using `NextRequest`/`NextResponse`:

```typescript
import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

export async function POST(request: Request) {
  const body = await request.json()
  // ... supabase operations ...
  return NextResponse.json({ success: true })
}
```

---

## 8. UI/Design Conventions

### Styling Approach: Inline Styles

The app uses **JavaScript inline styles** as the primary styling method, not Tailwind utility classes for most components:

```typescript
<div style={{
  background: '#1d1d1d',
  borderRadius: '16px',
  padding: '40px',
  width: '100%',
  maxWidth: '400px'
}}>
```

### Color Palette (Dark Theme)

The app is **dark-mode only**:

| Usage | Color |
|---|---|
| Page background | `#111111` |
| Card/surface background | `#1d1d1d` |
| Input background | `#282a30` |
| Input border | `#3f4451` |
| Primary text | `#f1f5f9` |
| Secondary text | `#94a3b8` |
| Muted text | `#6b7280` |
| Brand accent (cyan) | `#22d3ee` / `#06b6d4` |
| Brand accent (purple) | `#a855f7` |
| Brand accent (pink) | `#ec4899` / `#d71cd1` |
| Success (green) | `#16a34a` |
| Error (red) | `#ef4444` |
| Border/divider | `rgba(255,255,255,0.08)` |

### Brand Gradient

Used throughout for emphasis text and decorative elements:
```typescript
background: 'linear-gradient(90deg, #22d3ee, #a855f7, #ec4899)'
WebkitBackgroundClip: 'text'
WebkitTextFillColor: 'transparent'
```

### Typography

- Headings: `fontSize: '24px'`, `fontWeight: 700`
- Body text: `fontSize: '14px'`, `fontWeight: 500`
- Labels: `fontSize: '14px'`, `color: '#94a3b8'`
- Section titles: `fontSize: '11px'`, `fontWeight: 600`, `textTransform: 'uppercase'`, `letterSpacing: '1.5px'`
- Badges: `fontSize: '11px'`, `fontWeight: 700`

### Common UI Patterns

- **Buttons:** Inline styled, no shared Button component
- **Inputs:** Inline styled with dark background (`#282a30`), rounded corners (`8px`)
- **Cards:** Dark surface (`#1d1d1d`), `borderRadius: '16px'`
- **Badges:** Pill-shaped (`borderRadius: '999px'`), color-coded by type
- **Tables:** Standard HTML tables, horizontally scrollable on mobile
- **Modals:** Fixed-position overlays with backdrop
- **Kanban boards:** Column-based layout with drag support

---

## 9. Navigation & Layout Structure

### App Shell

```
+--[ Mobile Header (hidden on desktop) ]--+
|                                          |
| +--------+  +-------------------------+ |
| | Sidebar |  |     Main Content        | |
| | (240px) |  |     (flex: 1)           | |
| | fixed   |  |     padding: 24px       | |
| |         |  |     marginLeft: 240px   | |
| |         |  |                         | |
| +--------+  +-------------------------+ |
|                                          |
| [ NotificationManager (invisible) ]     |
| [ PhoneWidget (floating) ]              |
+------------------------------------------+
```

### Sidebar Sections

| Section | Items |
|---|---|
| **CORE** | Command Center, Lead Pipeline |
| **SALES** | Quote Builder, Invoice Manager, Payment History |
| **COMMUNICATION** | Customer Database, Message Hub, Email Inbox, Call Management |
| **PURCHASING** | Purchase Orders |
| **PRODUCTION** | Job Calendar, Task Board, Production Flow, Production Analytics |
| **ACCOUNT** | Dev Requests, Project Archive, System Settings |

### Sidebar Features
- Fixed 240px width on desktop
- Slide-in drawer on mobile (< 768px) with overlay backdrop
- Real-time badge counts (fetched via API polling every 60s)
- "No Idle Hands" gamification widget at top
- Brand gradient text styling on nav item names
- Active state: left cyan border + cyan tint background
- Refresh button in header
- Sign out button in footer

### Mobile Responsiveness
- Handled via CSS media queries in the dashboard layout's `<style jsx global>`
- Sidebar becomes a slide-out drawer on mobile
- Mobile header appears with hamburger toggle
- Tables become horizontally scrollable
- Content padding reduces on smaller screens

---

## 10. Conventions for Building New Modules

### Page Pattern

1. Create a directory under `app/(dashboard)/your-module/`
2. Create `page.tsx` as an async server component:
   ```typescript
   export const dynamic = 'force-dynamic'
   export const revalidate = 0

   import { supabase } from '../../lib/supabase'
   import YourModuleList from './YourModuleList'

   export default async function YourModulePage() {
     const { data } = await supabase
       .from('your_table')
       .select('*')
       .order('created_at', { ascending: false })

     return <YourModuleList initialData={data || []} />
   }
   ```
3. Create a `'use client'` component for the interactive UI (e.g., `YourModuleList.tsx`)

### API Route Pattern

1. Create `app/api/your-module/route.ts`
2. Export `GET`, `POST`, `PUT`, `DELETE` as needed
3. Import supabase from `@/app/lib/supabase`
4. Return `NextResponse.json()`

### Component Conventions

- Use `'use client'` directive for interactive components
- Style with inline `style={{}}` objects
- Use the dark color palette constants (see Section 8)
- No external component libraries — build from scratch
- SVG icons inline or from the icon set in Sidebar.tsx
- Use `useState` / `useEffect` / `useCallback` for state management
- Fetch data from `/api/*` routes for mutations

### Type Definitions

- Define types in `app/lib/types/` or co-locate with the feature
- Use explicit type definitions (not auto-generated from Supabase)
- Pattern: `Type` for reads, `TypeInsert` using `Omit<Type, 'id' | 'created_at' | 'updated_at'>`

### Database Changes

- Add SQL migration files to `supabase/migrations/`
- Naming: `YYYYMMDD_description.sql`
- Can be run via the migration runner API route

### Adding Sidebar Navigation

Edit `app/components/Sidebar.tsx`:
1. Add entry to the appropriate section in `navSections`
2. Add icon SVG to the `icons` record
3. If badges needed, add to the `unreadCounts` state and fetch logic

---

## 11. Key Integrations Summary

| Integration | Purpose | Client Location |
|---|---|---|
| Supabase | Database (PostgreSQL) | `app/lib/supabase.ts` |
| Cloudflare R2 | File storage | `app/api/upload/route.ts` |
| Twilio | SMS + Voice calls | `app/lib/twilio.ts` |
| Gmail API | Email inbox + sending | `app/lib/gmail.ts` |
| Google Sheets | Payment sync, legacy data | `app/lib/googleSheets.ts` |
| Google Ads | Conversion tracking | `app/lib/googleAdsConversion.ts` |
| Stripe | Payment processing | `app/api/payment/route.ts` |
| SanMar / S&S Activewear | Supplier product catalogs | `app/lib/suppliers/` |
| jspdf + html2canvas | PDF generation | `app/api/pdf/` |

---

## 12. What VF-OPS Should Match

To feel like it was built by the same hands:

1. **Next.js 16+ with App Router** — no Pages Router
2. **Supabase** for database — single shared client, direct queries
3. **Tailwind CSS v4** for base styles, but **inline styles** for component-level styling
4. **Dark-mode only** UI with the same color palette
5. **Server components** for initial data fetching, `'use client'` for interactivity
6. **API routes** for all mutations and external service calls
7. **No UI library** — build components from scratch with inline styles
8. **Same folder structure**: `app/(dashboard)/`, `app/api/`, `app/lib/`, `app/components/`
9. **Cloudflare R2** for file storage (not Supabase Storage)
10. **Polling-based** real-time updates (setInterval + focus events), not WebSockets
11. **Vercel** deployment with zero config
12. **TypeScript strict mode** throughout
