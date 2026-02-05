# Phase 5.1: Production Automations

## Overview

This phase implements two key automations to streamline the production workflow:

1. **Auto-move to Production on Payment** - Automatically generates production tasks when an invoice is fully paid
2. **Customer Notification on Completion** - Sends SMS/email to customers when all tasks for a line item are completed

Both automations can be enabled/disabled via toggles in the Settings page.

---

## Features Implemented

### 1. Automation Settings UI

**Location:** Settings > Automations tab

- Beautiful toggle switches for each automation
- Clear descriptions of what each automation does
- Real-time enable/disable with instant visual feedback
- Status indicators showing "Enabled" or "Disabled"

### 2. Automation #1: Auto-move to Production on Payment

**Trigger:** When an invoice is fully paid via Stripe

**Actions:**
- Checks if `auto_production_on_payment` automation is enabled
- Generates production tasks for all line items using templates
- Sets `in_production = true` on the invoice
- Moves invoice to "IN_PRODUCTION" bucket
- All happens automatically in the background

**Files Modified:**
- `/app/payment-success/page.tsx` - Added automation logic after payment processing

**How it works:**
```
Customer pays invoice in full
  ↓
Payment success page processes payment
  ↓
Check if automation is enabled
  ↓ (if enabled)
Call /api/production/generate-tasks
  ↓
Generate tasks from templates for each line item
  ↓
Set in_production = true
  ↓
Invoice appears in Production Flow
```

### 3. Automation #2: Customer Notification on Completion

**Trigger:** When a task is marked as COMPLETED

**Actions:**
- Checks if all other tasks for the same line item are also completed
- Checks if `notify_customer_on_completion` automation is enabled
- Sends SMS via Twilio to customer's phone (if available)
- Sends email via Resend to customer's email (if available)
- Includes invoice details and pickup instructions

**Files Modified:**
- `/app/api/tasks/update/route.ts` - Added automation logic after task status update

**How it works:**
```
User marks a task as COMPLETED
  ↓
Task status updated in database
  ↓
Check if all tasks for this line item are COMPLETED
  ↓ (if all completed)
Check if automation is enabled
  ↓ (if enabled)
Fetch customer contact info (phone/email)
  ↓
Send SMS: "Hi [Name]! Your [service] is ready for pickup!"
  ↓
Send Email: Beautiful HTML email with pickup details
```

**SMS Template:**
```
Hi [Customer Name]! Great news - your [service description] is complete
and ready for pickup! Contact us to schedule: (301) 620-4275.
-Frederick Wraps & Graphics
```

**Email Template:**
- Professional HTML email with gradient header
- Invoice number and vehicle description
- Pickup instructions with phone number and address
- Company branding and contact info

---

## Database Schema

### New Table: `automation_settings`

```sql
CREATE TABLE automation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_key TEXT UNIQUE NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  label TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Default Records:**
- `auto_production_on_payment` (disabled by default)
- `notify_customer_on_completion` (disabled by default)

---

## Files Created/Modified

### New Files:
1. `/supabase/migrations/20260205_automation_settings.sql` - Database migration
2. `/app/lib/automation-settings.ts` - Helper functions for automation management
3. `/app/scripts/run-migration.ts` - Migration runner utility
4. `/app/api/migrations/run/route.ts` - API endpoint for running migrations
5. `/PHASE_5.1_AUTOMATIONS.md` - This documentation file

### Modified Files:
1. `/app/(dashboard)/settings/page.tsx` - Added automation settings data fetch
2. `/app/(dashboard)/settings/SettingsView.tsx` - Added Automations tab with toggle UI
3. `/app/payment-success/page.tsx` - Added Automation #1 logic
4. `/app/api/tasks/update/route.ts` - Added Automation #2 logic

---

## Setup Instructions

### 1. Run Database Migration

**Option A: Supabase SQL Editor (Recommended)**
1. Go to Supabase Dashboard > SQL Editor
2. Copy contents of `/supabase/migrations/20260205_automation_settings.sql`
3. Execute the SQL

**Option B: psql CLI**
```bash
psql $DATABASE_URL -f supabase/migrations/20260205_automation_settings.sql
```

### 2. Verify Migration

Check that the table and default records were created:
```sql
SELECT * FROM automation_settings;
```

Expected output:
```
| automation_key               | enabled | label                              |
|------------------------------|---------|-------------------------------------|
| auto_production_on_payment   | false   | Auto-move to Production on Payment |
| notify_customer_on_completion| false   | Customer Notification on Completion|
```

### 3. Enable Automations

1. Navigate to Settings > Automations
2. Toggle on the automations you want to use
3. Test with a real payment or task completion

---

## Testing

### Test Automation #1: Auto-move to Production on Payment

1. Enable the automation in Settings > Automations
2. Create a test invoice with line items
3. Process a payment via Stripe (use Stripe test mode)
4. Verify invoice appears in Production Flow with generated tasks

### Test Automation #2: Customer Notification on Completion

1. Enable the automation in Settings > Automations
2. Go to Production Flow
3. Mark all tasks for a line item as COMPLETED
4. Verify customer receives SMS and/or email

**Test Checklist:**
- [ ] SMS sent if customer has phone number
- [ ] Email sent if customer has email address
- [ ] Message includes correct customer name
- [ ] Message includes correct service description
- [ ] Notification only sent when ALL tasks are complete

---

## Environment Variables Required

These should already be configured, but verify they're present:

```bash
# Twilio (for SMS)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Resend (for Email)
RESEND_API_KEY=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# App URL (for API calls)
NEXT_PUBLIC_BASE_URL=https://fwg-ops.vercel.app
```

---

## Architecture Notes

### Why These Automations?

**Auto-move to Production on Payment:**
- Eliminates manual step of clicking "Move to Production"
- Ensures production starts immediately after payment
- Reduces friction in workflow
- Prevents forgetting to generate tasks

**Customer Notification on Completion:**
- Improves customer experience with proactive communication
- Reduces phone calls asking "Is it ready?"
- Professional automated touchpoint
- Builds trust and satisfaction

### Design Decisions

**Toggle-based Control:**
- Each automation can be independently enabled/disabled
- No code changes needed to turn automations on/off
- Settings persist across deployments
- Easy to disable if issues occur

**Graceful Degradation:**
- Automation failures don't break core functionality
- Errors are logged but don't throw
- Payment processing continues even if automation fails
- Task updates succeed even if notification fails

**Line Item Granularity:**
- Notifications sent per line item, not per invoice
- More accurate customer communication
- Allows partial completion tracking
- Better production visibility

---

## Future Enhancements

Potential additions for Phase 5.2+:

1. **More Automations:**
   - Auto-assign tasks to team members based on skills
   - Escalate overdue tasks to manager
   - Send progress updates to customers
   - Create calendar events on task completion

2. **Notification Improvements:**
   - Customizable message templates
   - Choose SMS vs Email vs Both
   - Schedule notifications (don't send at night)
   - Customer notification preferences

3. **Analytics:**
   - Track automation success rates
   - Monitor notification delivery
   - Measure time savings
   - A/B test messages

4. **Automation Builder:**
   - Visual workflow editor (like Zapier)
   - Custom trigger conditions
   - Multiple actions per automation
   - Test mode for new automations

---

## Support

For issues or questions:
- Check Supabase logs for automation errors
- Review Next.js server logs for API failures
- Verify environment variables are set
- Test with Stripe test mode and Twilio test numbers
- Contact development team for assistance

---

## Changelog

**2026-02-05** - Phase 5.1 Initial Release
- Created automation_settings table and migration
- Added Automations tab to Settings UI
- Implemented auto-move to production on payment
- Implemented customer notification on task completion
- Added toggle controls for each automation
- Created comprehensive documentation
