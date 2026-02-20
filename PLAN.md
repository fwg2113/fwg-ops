# Implementation Plan: Pricing Snapshots, Settings Protection & Send Persistence

## Phase 1: Remove Legacy "Embroidery Pricing" Tab

### 1a. Settings UI (`SettingsView.tsx`)
- Remove `'embroidery-pricing'` from the `Tab` type union (line 172)
- Remove the tab button `{ key: 'embroidery-pricing', label: 'Embroidery Pricing' }` (line 534)
- Remove state variables: `embroideryPricing`, `editingEmbroideryBreak`, `savingEmbroideryPricing` (lines 265-267)
- Remove the entire `activeTab === 'embroidery-pricing'` rendering block (lines 4715-4891)

### 1b. Settings Page Server Component (`settings/page.tsx`)
- Remove the fetch for `initialEmbroideryPricing` (decoration_type = 'embroidery')
- Remove the prop being passed to `SettingsView`

### 1c. API Route
- Delete `/app/api/settings/embroidery-pricing/route.ts` entirely

### 1d. Legacy Fallback References
- `documents/[id]/page.tsx` lines 87-91: Remove the `embroideryLegacyMatrix` fetch and the `|| embroideryLegacyMatrix` fallbacks on lines 108-109
- `CustomerDocumentView.tsx` lines 126-129: Remove `|| matrices.find(m => m.decoration_type === 'embroidery')` fallbacks in `buildTierPricing()`

---

## Phase 2: Pricing Snapshot System

### 2a. Database Migration
Add columns to `documents` table:
```sql
ALTER TABLE documents ADD COLUMN pricing_snapshot_json JSONB DEFAULT NULL;
ALTER TABLE documents ADD COLUMN pricing_locked BOOLEAN DEFAULT FALSE;
ALTER TABLE documents ADD COLUMN pricing_snapshot_at TIMESTAMPTZ DEFAULT NULL;
```

The `pricing_snapshot_json` stores:
```json
{
  "matrices": {
    "dtf": { ...full matrix object },
    "embroidery_markup": { ...full matrix object },
    "embroidery_fee": { ...full matrix object }
  },
  "captured_at": "2026-02-20T..."
}
```

### 2b. Snapshot Capture on Send (`DocumentDetail.tsx`)
In `handleSendDocument()`, after saving send_options_json:
1. Fetch all current pricing matrices from `apparel_pricing_matrices`
2. Store them as `pricing_snapshot_json` on the document
3. Set `pricing_snapshot_at` timestamp
4. Auto-set `pricing_locked = true` when sending

### 2c. Customer View — Live vs Frozen
In `view/[id]/page.tsx`:
- If `document.options_mode === true` → pass live `pricingMatrices` (current behavior, interactive)
- If `document.options_mode === false` AND `document.pricing_snapshot_json` exists → extract matrices from snapshot and pass those instead of live data
- Fallback to live data if no snapshot exists (backward compat for old docs)

In `CustomerDocumentView.tsx`:
- No changes needed — it already takes `pricingMatrices` as a prop
- The page.tsx decides which matrices to pass

---

## Phase 3: Admin Pricing Change Detection + Lock

### 3a. Compare on Load (`DocumentDetail.tsx`)
When the document detail page loads, if `pricing_snapshot_json` exists:
1. Fetch current live pricing matrices
2. Deep-compare with the snapshot (compare `quantity_breaks` JSON)
3. If different, set a state flag `pricingHasChanged = true`

### 3b. Modal Alert
If `pricingHasChanged` and `pricing_locked === true`:
- Show a modal: "Pricing settings have been updated since this document was last sent. Would you like to apply the new pricing?"
- **Apply**: Recalculates all apparel line items using new matrices, updates `unit_price` and `line_total` on affected items, takes a new snapshot, saves everything
- **Dismiss**: Keeps existing pricing, closes modal. Does not show again until next settings change.

If `pricingHasChanged` and `pricing_locked === false`:
- Same modal but phrased slightly differently since the doc isn't locked

### 3c. Lock/Unlock Toggle
Add a lock icon button near the document header/status area:
- Shows a padlock icon (locked = orange, unlocked = gray)
- Tooltip: "Pricing locked — settings changes won't affect this document" / "Pricing unlocked"
- Click toggles `pricing_locked` on the document
- When unlocked, the change-detection modal won't auto-appear (user opted into live pricing)
- When locked, the modal appears on load if settings have changed since snapshot

### 3d. "Apply New Pricing" Logic
When the user clicks "Apply" in the modal:
1. For each apparel line item with `custom_fields.apparel_mode`:
   - Recalculate `unit_price` using the current tier for the item's quantity
   - Recalculate `line_total = unit_price * quantity`
2. Recalculate document `subtotal`, `tax_amount`, `total`, `balance_due`
3. Take a fresh pricing snapshot
4. Append history entry: "Pricing Updated — Applied latest pricing matrix changes"
5. Save all changes

---

## Phase 4: Send Modal Persistence

### 4a. Load Previous Settings
In `handleOpenSendModal()`:
1. Check if `doc.send_options_json` exists (from a previous send)
2. If yes, pre-populate all modal fields from it:
   - `sendEmail` ← `send_options_json.email`
   - `sendSms` ← `send_options_json.sms`
   - `approvalType` ← `send_options_json.approvalType`
   - `paymentTerms` ← `send_options_json.paymentTerms`
   - `customPaymentAmount` ← `send_options_json.depositAmount` (if paymentTerms is 'custom')
   - `notificationPref` ← `send_options_json.customerNotificationPref`
   - `includeLineAttachments` ← `send_options_json.includeLineAttachments`
   - `includeProjectAttachments` ← `send_options_json.includeProjectAttachments`
3. If no previous send, use current defaults (existing behavior)

### 4b. Rich Activity Log Entry on Send
When a document is sent, append a detailed history entry:
```
Event: "Sent"
Detail: "Quote sent via SMS & Email | 50% deposit ($1,250.00) | Approval: Design & Price"
```

### 4c. Send Snapshot — Full Document State
Add a `document_send_snapshots` table:
```sql
CREATE TABLE document_send_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  snapshot_data JSONB NOT NULL,
  sent_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

`snapshot_data` contains:
```json
{
  "document": { ...all doc fields at time of send },
  "line_items": [ ...all line items with pricing ],
  "send_options": { ...the send modal settings },
  "pricing_matrices": { ...active matrices at time of send },
  "totals": { "subtotal": ..., "discount": ..., "tax": ..., "total": ..., "deposit": ... }
}
```

On send:
1. Capture the full snapshot
2. Insert into `document_send_snapshots`
3. Append history entry with a link: `snapshotId` stored in the entry detail
4. The activity log renders a "View Snapshot" link for entries that have a snapshot ID

### 4d. Snapshot Viewer Route
Create `/app/snapshot/[id]/page.tsx`:
- Fetches the snapshot by ID from `document_send_snapshots`
- Renders a **read-only** version of the customer view using the snapshot data
- Shows a banner at top: "Snapshot — This is what the customer saw when this was sent on [date]"
- Opens in a new tab from the activity log link

---

## Implementation Order
1. Phase 1 (remove legacy tab) — Quick cleanup
2. Phase 2 (snapshot system) — Foundation for everything else
3. Phase 4 (send persistence + send snapshots) — Depends on Phase 2 snapshot
4. Phase 3 (admin modal + lock) — Builds on Phase 2 + 4

## Files Modified
- `app/(dashboard)/settings/SettingsView.tsx` — Remove legacy tab
- `app/(dashboard)/settings/page.tsx` — Remove legacy fetch
- `app/api/settings/embroidery-pricing/route.ts` — Delete
- `app/(dashboard)/documents/[id]/page.tsx` — Remove legacy fallback, add snapshot comparison
- `app/(dashboard)/documents/[id]/DocumentDetail.tsx` — Send modal persistence, lock toggle, change detection modal, snapshot on send
- `app/view/[id]/page.tsx` — Conditional live vs frozen matrices
- `app/view/[id]/CustomerDocumentView.tsx` — Remove legacy fallbacks

## New Files
- `supabase/migrations/YYYYMMDD_pricing_snapshots.sql` — Migration for new columns + table
- `app/snapshot/[id]/page.tsx` — Snapshot viewer page
- `app/snapshot/[id]/SnapshotView.tsx` — Read-only customer view component
