# FWG Operations - Feature Audit

**Purpose:** Track what's actually working vs what's just UI in the Next.js system compared to the legacy Apps Script system.

**Status Key:**
- WORKING = Tested and functioning correctly
- PARTIAL = UI exists but logic incomplete or buggy
- UI_ONLY = Looks right but not wired up
- MISSING = Not built yet
- N/A = Not applicable to new system

---

## COMMAND CENTER (Dashboard)

### Priority Queue / Customer Action Center
| Feature | Status | Notes |
|---------|--------|-------|
| Shows new submissions as action cards | | |
| Shows approved quotes needing conversion | | |
| Shows draft quotes needing to be sent | | |
| Shows quotes needing follow-up (3+ days) | | |
| Shows paid invoices needing scheduling | | |
| Shows draft invoices needing to be sent | | |
| Shows invoices needing follow-up | | |
| Shows open tasks (unlinked) | | |
| Shows tasks linked to documents | | |
| Priority ranking logic (1=schedule, 2=convert, etc) | | |
| Pin/unpin items | | |
| Complete task from action card | | |
| Click card navigates to correct detail view | | |
| Add Task button opens modal | | |
| Add Task modal saves to database | | |

### Waiting on Customer Section
| Feature | Status | Notes |
|---------|--------|-------|
| Shows quotes with status Sent/Viewed | | |
| Shows invoices with status Sent/Partial | | |
| Displays total value | | |
| Eye icon shows viewed vs not viewed | | |
| Click card navigates to detail | | |

### Snapshot Metrics
| Feature | Status | Notes |
|---------|--------|-------|
| Month-to-date revenue calculation | | |
| PPF & Vinyl category total | | |
| 2.5% bonus calculation | | |
| Pipeline value (quotes + unpaid invoices) | | |

### MTD by Category
| Feature | Status | Notes |
|---------|--------|-------|
| Fetches revenue by category | | |
| Progress bars scale correctly | | |
| Shows dollar values | | |

---

## SIDEBAR NAVIGATION

| Feature | Status | Notes |
|---------|--------|-------|
| Command Center link works | | |
| Lead Pipeline link works | | |
| Quote Builder link works | | |
| Invoice Manager link works | | |
| Payment History link works | | |
| Message Hub link works | | |
| Customer Database link works | | |
| Job Calendar link works | | |
| Task Board link works | | |
| Production Flow link works | | |
| System Settings link works | | |
| Badge count: Submissions | | |
| Badge count: Messages (unread) | | |
| Badge count: Tasks (open) | | |
| Badge count: Production (pending) | | |

---

## LEAD PIPELINE (Submissions)

### Kanban View
| Feature | Status | Notes |
|---------|--------|-------|
| New Leads lane populated | | |
| Action Needed lane populated | | |
| Waiting lane populated | | |
| In Production lane populated | | |
| Cold section (horizontal) | | |
| Search/filter works | | |
| Pipeline stats (total value, count) | | |
| Click card opens submission detail | | |
| Move to Cold button | | |

### Submission Detail Modal
| Feature | Status | Notes |
|---------|--------|-------|
| Shows customer info | | |
| Shows vehicle info | | |
| Shows project type | | |
| Shows price range | | |
| Shows design scenario | | |
| Shows uploads/attachments | | |
| Create Quote from submission | | |
| Update status | | |
| Send message to customer | | |

---

## DOCUMENTS (Quotes & Invoices)

### Document List View
| Feature | Status | Notes |
|---------|--------|-------|
| Lists all quotes | | |
| Lists all invoices | | |
| Filter by bucket | | |
| Filter by status | | |
| Search works | | |
| Shows viewed/approved indicators | | |
| Shows bucket badges | | |
| Click row opens detail | | |
| Create new quote button | | |

### Document Detail View
| Feature | Status | Notes |
|---------|--------|-------|
| Shows/edits customer info | | |
| Customer autocomplete | | |
| Shows/edits vehicle description | | |
| Shows/edits project description | | |
| Category selector | | |
| Line items display | | |
| Add line item | | |
| Edit line item | | |
| Delete line item | | |
| Line item attachments | | |
| Fees section | | |
| Add/edit/delete fees | | |
| Discount controls ($ and %) | | |
| Tax amount | | |
| Deposit required | | |
| Valid until date | | |
| Notes field | | |
| Totals calculate correctly | | |
| Save changes | | |
| Send Modal opens | | |
| Send via Email | | |
| Send via SMS | | |
| Approval type selection | | |
| Payment terms selection | | |
| Follow-up Modal opens | | |
| Follow-up templates | | |
| Follow-up with discount incentive | | |
| Archive Modal | | |
| Convert quote to invoice | | |
| Record payment | | |
| Project attachments section | | |
| Upload attachments | | |
| View/delete attachments | | |
| Lightbox for images | | |

---

## MESSAGES

| Feature | Status | Notes |
|---------|--------|-------|
| Lists conversations | | |
| Shows unread indicator | | |
| Search conversations | | |
| View conversation thread | | |
| Send SMS reply | | |
| Send MMS (with attachment) | | |
| Receive incoming SMS (webhook) | | |
| Link conversation to document | | |
| Mark as read | | |

---

## CUSTOMERS

| Feature | Status | Notes |
|---------|--------|-------|
| Lists all customers | | |
| Search customers | | |
| Shows lifetime value | | |
| Click opens detail modal | | |
| Edit customer info | | |
| View customer history (quotes/invoices) | | |
| Upload customer files | | |
| Link Google Drive folder | | |
| Create quote for customer | | |
| Create invoice for customer | | |

---

## CALENDAR

| Feature | Status | Notes |
|---------|--------|-------|
| Shows Google Calendar events | | |
| Create new event | | |
| Edit event | | |
| Delete event | | |
| Link event to invoice | | |
| Shows job details on event | | |
| Google Calendar sync (OAuth) | | |

---

## TASK BOARD

| Feature | Status | Notes |
|---------|--------|-------|
| Shows tasks by status (To Do, In Progress, Done) | | |
| Drag and drop between columns | | |
| Create new task | | |
| Edit task | | |
| Delete task | | |
| Link task to document | | |
| Priority levels | | |
| Due dates | | |
| Filter/search | | |

---

## PRODUCTION FLOW

| Feature | Status | Notes |
|---------|--------|-------|
| Shows paid invoices in production | | |
| Progress ring per job | | |
| Pipeline visualization | | |
| Task checklist per job | | |
| Toggle task complete | | |
| Auto-SMS on certain tasks | | |
| Archive completed job | | |
| Celebration animation on complete | | |
| Filter by category | | |
| Search jobs | | |

---

## SYSTEM SETTINGS

| Feature | Status | Notes |
|---------|--------|-------|
| View/edit business info | | |
| Manage categories | | |
| Manage packages | | |
| Manage line item types | | |
| Manage fee types | | |
| Twilio settings | | |
| Email settings | | |
| Calendar settings | | |

---

## API ROUTES

| Route | Status | Notes |
|-------|--------|-------|
| /api/sms (send) | | |
| /api/sms/incoming (webhook) | | |
| /api/email | | |
| /api/calendar | | |
| /api/calendar/auth | | |
| /api/calendar/callback | | |
| /api/documents/approve | | |
| /api/upload | | |
| /api/files/[...path] | | |
| /api/payment | | |
| /api/pdf | | |
| /api/tasks/create | | |
| /api/tasks/update | | |
| /api/tasks/delete | | |
| /api/voice/incoming | | |
| /api/voice/complete | | |
| /api/voice/status | | |
| /api/voice/voicemail | | |

---

## CUSTOMER-FACING PAGES

| Feature | Status | Notes |
|---------|--------|-------|
| View quote (public link) | | |
| View invoice (public link) | | |
| Approve quote | | |
| Request revision | | |
| Make payment (Stripe) | | |
| Payment success page | | |

---

## INTEGRATIONS

| Integration | Status | Notes |
|-------------|--------|-------|
| Supabase database | WORKING | Migrated 1200+ customers |
| Twilio SMS | PARTIAL | Send works, MMS broken |
| Twilio Voice | | |
| Stripe payments | | |
| Resend email | | |
| Google Calendar | | |
| Cloudflare R2 storage | WORKING | Uploads functional |

---

## KNOWN ISSUES

| Issue | Priority | Notes |
|-------|----------|-------|
| Duplicate messages in SMS | HIGH | |
| MMS attachments not working | HIGH | R2 uploads work but Twilio rejects URLs |
| Customer autocomplete infinite loop | FIXED | Removed customers from useEffect deps |

---

## NEXT STEPS

1. Fill in status for each feature by testing
2. Prioritize MISSING and PARTIAL items
3. Fix HIGH priority known issues

---

*Last Updated: January 31, 2025*