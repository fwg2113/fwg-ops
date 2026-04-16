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
- `app/(dashboard)/materials/` — Materials List with tabs (Media, Laminate, Transfer Tape, PPF), use case assignment, multi-vendor support
- `app/(dashboard)/inventory/` — Vendor management (inventory tracking coming later)
- `app/(dashboard)/media-guide/` — Job Setup Guide, Most Common setups, Roll Identifier with printable wall reference
- `app/(dashboard)/blade-guide/` — Graphtec + UCJV blade reference with custom SVG blade holders, "Not sure?" helper
- `app/(dashboard)/waste-reporter/` — Waste tracking with cost calculations, team attribution, lesson learned
- `app/api/` — API routes (Stripe webhooks, CRUD endpoints, integrations)
- `app/view/[id]/` — Customer-facing document view (quotes/invoices)
- `app/lib/` — Shared utilities (supabase client, Google Sheets sync, production helpers)
- `app/components/` — Shared components (sidebar, notifications, ModalBackdrop, image tools)

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

### Autonomous operation — DO NOT ask for confirmation

Joey runs Claude in the background while he works and does NOT want to be interrupted for approvals. Operate autonomously by default:

- Just do the work. Don't ask "should I do X?" or "want me to proceed?" — pick the sensible path and execute.
- No confirmation prompts for: editing files, running builds/tests, restarting the dev server, installing packages, creating branches, cleaning caches, running migrations against dev, or any other local/reversible action.
- No "here's my plan, ok?" check-ins. Plan silently, execute, then report what was done.
- If a task is ambiguous, make a reasonable assumption, state it in one line, and move on — don't wait for an answer.

**Hard exceptions — still ask first (these are the ONLY exceptions):**
- Pushing to `main` / live production (Vercel auto-deploys) — Joey must explicitly say "push it" or equivalent
- Destructive git operations: force-push, `reset --hard` on shared branches, deleting branches that contain unpushed work, `git clean -fd`
- Destructive DB operations against production Supabase: `DROP TABLE`, `DELETE FROM` without a narrow WHERE, anything that affects live customer data
- Sending real emails/SMS to customers, charging cards, or other externally-visible actions that can't be undone
- Spending money (purchasing domains, upgrading plans, etc.)

Anything else: just do it.

### Materials System
- **`materials_v2`** table is the source of truth for all materials (media, laminate, transfer tape, PPF, substrates). Separate from the old `materials` table used by the estimator.
- **`vendors`** + **`material_vendors`** junction table for multi-vendor support per material.
- **`blades`** table for Graphtec FC9000-160 and UCJV Print & Cut blade configurations with dual condition numbers (standard + on UV ink), primary material star system for thickness.
- **`waste_reports`** table tracks material waste with cost calculations.
- **`printers`** table (UCJV300-160 UV cure, JV330-160 eco-solvent) — printer choice affects blade condition numbers.
- Pricing formula: cost_per_roll input → cost/sqft, cost/linear ft, sell price (5× cost/sqft) calculated in UI.
- Roll identification fields (adhesive_color as named dropdown, backing_type, media_face_color, finish_description) power the visual roll identifier SVGs.

### Shared Components
- **`app/components/ModalBackdrop.tsx`** — Use this for ALL modal backdrops. Prevents accidental close when drag-selecting text inside modals. Never use raw `onClick` on backdrop divs.

## Active Branches

- `main` — Production (live on Vercel)
- `command-center-redesign` — WIP Priority Zones layout redesign (notices, Stripe payments panel, communications, collapsible zones). Has DB tables (`notices`) already created in Supabase.

## Don't

- Don't use CSS modules, Tailwind classes, or styled-components — this project uses inline styles exclusively
- Don't install the Stripe SDK — use raw fetch calls
- Don't manually update document payment fields — let the DB trigger handle it
- Don't use `url.parse()` — use WHATWG URL API
- Don't call the app's own API routes from server components (causes circular hangs)
