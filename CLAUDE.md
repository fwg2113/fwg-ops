# FWG-OPS

Business operations platform for Frederick Wraps & Graphics. Built and maintained by Joey Volpe (owner/operator, not a developer) with Claude as the sole developer.

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Database**: Supabase (PostgreSQL)
- **Hosting**: Vercel (auto-deploys from `main` branch)
- **Payments**: Stripe (raw fetch to REST API, no SDK)
- **Phone/SMS**: Twilio
- **Email**: Gmail API (Google OAuth)
- **Storage**: AWS S3
- **Styling**: Inline styles (no CSS modules, no Tailwind in app code)
- **Google Sheets**: Used for transaction log sync and some historical metrics

## Project Structure

- `app/(dashboard)/` — Main dashboard pages (Command Center, quotes, invoices, payments, etc.)
- `app/api/` — API routes (Stripe webhooks, CRUD endpoints, integrations)
- `app/view/[id]/` — Customer-facing document view (quotes/invoices)
- `app/lib/` — Shared utilities (supabase client, Google Sheets sync, production helpers)
- `app/components/` — Shared components (sidebar, notifications, image tools)

## Key Architecture Rules

### Payments
- **DB trigger is the single source of truth** for document payment status. The `sync_document_payment_status` trigger fires on payment INSERT/UPDATE/DELETE and recalculates `documents.amount_paid`, `balance_due`, `status`, and `paid_at`.
- **Never manually update** `documents.amount_paid/balance_due/status` after inserting a payment — the trigger handles it.
- **Fee model**: Card payments have a 2.9% + $0.30 customer surcharge. ACH has no fee. Manual/in-store "recorded" payments have no fee.
- **DTF/FA storefront** payments are in the `orders` table, NOT the `payments` table.

### Stripe Integration
- Uses raw `fetch()` calls to `https://api.stripe.com/v1/...` with Bearer token auth
- No Stripe SDK imported — all interactions are direct REST API calls
- Auth: `Authorization: Bearer ${process.env.STRIPE_SECRET_KEY}`

### Supabase
- Client imported from `app/lib/supabase.ts`
- API routes import as `import { supabase } from '../../../lib/supabase'` (relative path varies)

### API Route Pattern
All CRUD API routes follow this pattern:
```typescript
import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    // ... supabase operation ...
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
```

## Working with Joey

- Joey is NOT a developer. Explain decisions in plain language.
- When database changes are needed (migrations, new columns), provide the exact SQL for Joey to paste into the Supabase SQL Editor.
- The Supabase MCP tool may or may not be available — if not, give Joey the SQL to run manually.
- Keep responses direct and actionable. Don't over-explain code internals unless asked.
- Joey deploys by pushing to `main` — Vercel handles the rest.

## Active Branches

- `main` — Production (live on Vercel)
- `command-center-redesign` — WIP Priority Zones layout redesign (notices, Stripe payments panel, communications, collapsible zones). Has DB tables (`notices`) already created in Supabase.

## Don't

- Don't use CSS modules, Tailwind classes, or styled-components — this project uses inline styles exclusively
- Don't install the Stripe SDK — use raw fetch calls
- Don't manually update document payment fields — let the DB trigger handle it
- Don't use `url.parse()` — use WHATWG URL API
- Don't call the app's own API routes from server components (causes circular hangs)
