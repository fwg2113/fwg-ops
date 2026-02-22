# No Idle Hands — Project Understanding Summary

## What This Is

A standalone task/project board app for the FWG/FWT team to capture non-business-specific operational tasks — things to tackle during downtime when the day's scheduled work is done. Named after the team gesture of walking up with open hands meaning "put me to work."

**Domain:** `hands.frederickwraps.com`
**Separate repo/project**, but should feel like a sibling to FWG Ops.

---

## What I Found in the Actual FWG Ops Codebase vs. What the Spec Assumes

The Claude.ai spec was written without access to the current FWG Ops codebase, so there are several important mismatches I need to flag. These will affect how I build No Idle Hands to actually match FWG Ops.

### Tech Stack Differences

| Area | Spec Assumes | FWG Ops Actually Uses |
|------|-------------|----------------------|
| **Next.js** | 14+ | **16.1.4** (with React 19) |
| **Tailwind** | v3 (with `tailwind.config.ts`) | **v4** (CSS-based config via `@import "tailwindcss"`, no config file) |
| **Auth** | Supabase Auth (email/password) | **Simple cookie-based auth** — hardcoded credentials, `fwg_auth` cookie + localStorage, no Supabase Auth at all |
| **Icons** | Lucide React | **Hand-rolled inline SVGs** (no icon library) |
| **State mgmt** | SWR or TanStack Query | **Neither** — direct React state + Supabase queries |
| **Styling approach** | Tailwind utility classes | **Primarily inline styles** (`style={{...}}`) with minimal Tailwind |
| **Supabase client** | Browser + Server + Middleware pattern | **Single browser-only client** (`createClient` with anon key) |
| **Auth middleware** | Next.js middleware for auth redirect | **No middleware file exists** |
| **Project structure** | `src/app/` | **`app/`** (no `src/` directory) |

### Actual FWG Ops Color Palette (What I'll Match)

| Element | Actual Value |
|---------|-------------|
| Background (deepest) | `#111111` |
| Surface / Cards | `#1d1d1d` |
| Input background | `#282a30` |
| Border (inputs) | `#3f4451` |
| Border (dividers) | `rgba(255,255,255,0.08)` |
| Text primary | `#f1f5f9` |
| Text secondary | `#94a3b8` |
| Text muted | `#6b7280` |
| Section headers | `#4b5563` |
| Accent gradient | `linear-gradient(90deg, #22d3ee, #a855f7, #ec4899)` |
| Primary accent | `#06b6d4` / `#22d3ee` (cyan) |
| Button primary | `#d71cd1` (magenta) |
| Error | `#ef4444` |
| Active indicator glow | `#22d3ee` with `box-shadow: 0 0 8px` |

### Actual FWG Ops Styling Patterns

- **Border radius:** `16px` (cards), `10px` (logo badge), `8px` (inputs/buttons), `999px` (pills/badges)
- **Font:** `system-ui, sans-serif` / `Arial, Helvetica, sans-serif`
- **Spacing:** `padding: 24px` (main content), `20px` (sidebar sections), `16px` (card padding), `12px` (inputs)
- **Inline styles are dominant** — components use `style={{...}}` objects, not Tailwind classes
- **No custom Google fonts imported**
- **SVG icons are written inline** in component files (Lucide-style stroked SVGs but hand-coded)

---

## Decision Points / Questions for Joe

### 1. Auth Strategy
FWG Ops currently uses hardcoded credentials with a cookie — no Supabase Auth. The spec calls for Supabase Auth so team members can log in with email/password.

**Options:**
- **A)** Build No Idle Hands with the same simple cookie auth FWG Ops currently uses (fastest, consistent)
- **B)** Build No Idle Hands with proper Supabase Auth as the spec describes (better long-term, but FWG Ops team members would need Supabase Auth accounts created)
- **C)** Build with Supabase Auth and eventually migrate FWG Ops to it too

### 2. Supabase Project — Shared or Separate?
The spec mentions using the same Supabase project as FWG Ops (shared database) or creating a new one. Since the tables (`tasks`, `team_members`, `categories`, `locations`, `task_assignees`) are completely separate from FWG Ops tables, either works.

**Shared pros:** Single database to manage, widget integration is simpler, shared auth if we go that route.
**Separate pros:** Clean isolation, no risk of table name conflicts (FWG Ops already has a `tasks` table).

**Note:** FWG Ops already has a `tasks` table in its database. The No Idle Hands spec also defines a `tasks` table with a completely different schema. If sharing a Supabase project, we would need to rename one of them (e.g., `idle_tasks` or `nih_tasks`).

### 3. Styling Approach
The spec says to use Tailwind utility classes, but FWG Ops actually uses inline styles almost exclusively. To truly "match the feel":

**Options:**
- **A)** Use inline styles like FWG Ops does (true consistency if anyone compares code)
- **B)** Use Tailwind utilities but targeting the same color values (cleaner code, visually identical)

### 4. Icon Library
Spec says Lucide React, FWG Ops uses hand-rolled SVGs. For No Idle Hands, Lucide React would be faster to develop with and the visual output is the same (both are stroked SVG icons).

**Recommendation:** Use Lucide React for No Idle Hands — visually identical, much faster to build.

---

## Core Feature Summary

### Data Model
- **Tasks** — simple one-off items (title, description, category, location, urgency, time estimate, assignees, point of contact)
- **Projects** — tasks with `is_project = true` that have sub-tasks (child tasks via `parent_id`)
- **Categories** — Shop Maintenance, Inventory, Vehicles, Admin, Marketing, Equipment, Facility, Other
- **Locations** — Unit A, Unit B, Unit D - Lobby, Unit D - Bay, Loft, Offsite
- **Team members** — Joe (admin), Danny, Bronson, Mikey, Mason, Diogo, Jay
- **Completion** — optional notes + photo proof on completion

### UI Features
- Quick-add bar at top of board
- Task cards with urgency color dots, category badges, time estimates, assignees
- Project cards with expandable sub-task lists and progress indicators
- Filters: category, urgency, time estimate, location, assigned to, show/hide completed
- Stats bar: open tasks, in progress, completed this week, high/critical count
- Drag-and-drop reordering (tasks and sub-tasks) via @dnd-kit
- Complete modal with optional notes and photo upload
- Mobile-first design (phones + shop tablet)
- Empty state with hands icon + tagline

### Phased Build Plan (from spec)
1. **Phase 1 — Foundation:** Project setup, database, auth, deploy to Vercel, DNS instructions
2. **Phase 2 — Core Task Board:** CRUD for simple tasks, filtering, completion flow
3. **Phase 3 — Projects & Sub-tasks:** Project support, nested checkboxes, progress indicators
4. **Phase 4 — Drag & Drop:** @dnd-kit integration, reordering persistence
5. **Phase 5 — Polish:** Photo upload, stats bar, keyboard shortcuts, mobile pass, empty states
6. **Phase 6 — Widget:** Small card on FWG Ops dashboard linking to No Idle Hands with task counts

### DNS Setup
- Add CNAME record in GoDaddy: `hands` → `cname.vercel-dns.com`
- Add domain in Vercel project settings
- Wait for propagation + SSL auto-provisioning

---

## What I'll Build (Proposed Approach)

Given the codebase analysis, here's what I'd recommend to truly match FWG Ops:

| Decision | Recommendation |
|----------|---------------|
| Next.js version | **16** (match FWG Ops) |
| Tailwind version | **v4** (match FWG Ops) |
| Styling | **Tailwind utilities** targeting FWG Ops color values (cleaner than inline styles, visually identical) |
| Icons | **Lucide React** (faster dev, visually identical to FWG Ops hand-rolled SVGs) |
| Auth | **Needs your input** — see Question 1 above |
| Supabase | **Needs your input** — see Question 2 above |
| State management | **Direct React state + Supabase** (match FWG Ops pattern) |
| Structure | **`app/` directory** (match FWG Ops, not `src/app/`) |

---

## Waiting On

Before I start coding, I need answers to:
1. Auth strategy (cookie-based like FWG Ops, or Supabase Auth as spec describes?)
2. Shared Supabase project or separate? (table naming implications)
3. Any preference on styling approach?
4. Do you have the `Empty_Hands.svg` file to provide, or should I create a placeholder?
5. Should this be a new repo, or a subdirectory/monorepo approach within fwg-ops?
