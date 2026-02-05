# FWG Ops - Production Flow System Implementation Specification

**Document Version:** 3.0
**Last Updated:** 2026-02-05
**Status:** ✅ Core System Complete - Phases 1-4 Implemented

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Legacy System Architecture](#legacy-system-architecture)
3. [Database Schema](#database-schema)
4. [Production Flow Logic](#production-flow-logic)
5. [Implementation Phases](#implementation-phases)
6. [Current Status](#current-status)
7. [Technical Details](#technical-details)
8. [Key Files Reference](#key-files-reference)

---

## 📊 Executive Summary

### Objective
Migrate the production workflow system from Google Sheets to Supabase, enabling:
- **Template-based task generation** per line item
- **Dynamic task workflows** configurable via System Settings
- **Real-time production tracking** with visual pipeline
- **Elimination of Google Sheets latency** issues

### Core Concept
When an invoice is paid or moved to production, the system automatically generates a checklist of tasks **FOR EACH LINE ITEM** based on that line item's category template.

**Example:**
```
Invoice #1005 - Total: $2,850
├─ Line Item 1: Partial Wrap - Ford F150 (Category: PARTIAL_WRAP)
│  └─ Auto-generates 10 tasks: Verify → Design → Print → ... → Pickup
├─ Line Item 2: Partial Wrap - Honda Civic (Category: PARTIAL_WRAP)
│  └─ Auto-generates 10 tasks: Verify → Design → Print → ... → Pickup
└─ Line Item 3: PPF - F150 Hood (Category: PPF)
   └─ Auto-generates 6 tasks: Verify → Template → Prep → Install → QC → Pickup

Result: 26 total tasks in Production Flow, grouped by line item
```

### Tech Stack Migration
- **FROM:** Google Apps Script + Google Sheets
- **TO:** Next.js 14 + Supabase + TypeScript + React

---

## 🗄️ Legacy System Architecture

### Google Sheets Structure

The legacy system uses **3 primary Google Sheets**:

#### 1. SPEC SHEET (`1RvRIcNDsYGvx2to302lzDs3nmFQXHETYNZzMWoyFnhE`)

**Purpose:** Configuration database for all system settings

| Sheet Name | Purpose | Key Columns | Migration Status |
|------------|---------|-------------|------------------|
| **ProjectTemplates** | Workflow templates per category | `template_key`, `category_key`, `label`, `description`, `active`, `sort_order` | ❌ Not in Supabase |
| **TemplateTasks** | Task steps within each template | `template_key`, `task_key`, `label`, `default_priority`, `sort_order`, `active` | ❌ Not in Supabase |
| **TaskStatuses** | Available task statuses | `status_key`, `label`, `color`, `is_complete`, `sort_order`, `active` | ⚠️ Hardcoded in new system |
| **TaskPriorities** | Priority levels | `priority_key`, `label`, `color`, `sort_order`, `active` | ⚠️ Hardcoded in new system |
| **InvoiceStatuses** | Invoice status options | `status_key`, `label`, `color`, `triggers_production`, `sort_order`, `active` | ❌ Not implemented |
| **Automations** | Automation rules | `automation_key`, `trigger_field`, `trigger_condition`, `action_type`, `action_value` | ❌ Future feature |
| **Categories** | Job categories (PPF, TINT, etc.) | `category_key`, `label`, `calendar_color`, `line_template`, `default_rate`, `active` | ✅ In Supabase |
| **LineItemTemplates** | Column definitions for line items | `template_key`, `column_1_key` through `column_6_key` (+ `_label`, `_type`) | ⚠️ Logic exists in code |
| **Packages** | Predefined service bundles | `package_key`, `category_key`, `label`, `base_price`, `sqft_estimate`, `coverage_areas` | ⚠️ May exist in Supabase |
| **LineItemTypes** | Film/material types per category | `type_key`, `category_key`, `label`, `sort_order` | ⚠️ Unknown status |
| **MaterialCost** | Materials/films database | `material_key`, `label`, `cost_per_unit`, `markup` | ⚠️ Likely exists as `materials` |
| **Buckets** | Pipeline stages | `bucket_key`, `label`, `color`, `is_active`, `is_archived`, `sort_order` | ⚠️ May exist |
| **HELPERS** | System counters/settings | `key`, `value` | ❌ Not used in new system |

#### 2. OPS SHEET (`1Pyh1w6Gsx7pkZd9uRwB4YhGQfb0VWHzIE_qzcSO39lw`)

**Purpose:** Operational data

| Sheet Name | Migration Status |
|------------|------------------|
| Documents | ✅ Migrated to `documents` table |
| QuoteLineItems / InvoiceLineItems | ✅ Migrated to `line_items` table |
| Tasks | ✅ Migrated to `tasks` table |
| Customers | ✅ Migrated (1200+ records) |
| Submissions | ✅ Migrated to `submissions` |
| Payments | ✅ Migrated to `payments` |
| Messages | ✅ Migrated to `messages` |

#### 3. FINANCIAL CORE (`1dK9v4XosHHHs6eJWHBhhBVtSQKS8_hcZa2uelp3ErBc`)

**Purpose:** Revenue tracking for Command Center metrics

- **TRANSACTIONS** sheet → MTD/YTD revenue, category breakdown, bonus calculations
- **Status:** Still fetched via Google Sheets API in new system (`app/lib/googleSheets.ts`)

---

## 💾 Database Schema

### New Tables Required (Phase 1)

```sql
-- ============================================================================
-- 1. PROJECT TEMPLATES (Workflows)
-- ============================================================================
CREATE TABLE project_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT UNIQUE NOT NULL,
  category_key TEXT REFERENCES categories(category_key) ON UPDATE CASCADE,
  label TEXT NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_project_templates_category ON project_templates(category_key);
CREATE INDEX idx_project_templates_active ON project_templates(active) WHERE active = true;

-- ============================================================================
-- 2. TEMPLATE TASKS (Workflow Steps)
-- ============================================================================
CREATE TABLE template_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL REFERENCES project_templates(template_key) ON DELETE CASCADE ON UPDATE CASCADE,
  task_key TEXT NOT NULL,
  label TEXT NOT NULL,
  default_priority TEXT DEFAULT 'MEDIUM',
  sort_order INTEGER NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(template_key, task_key)
);

CREATE INDEX idx_template_tasks_template ON template_tasks(template_key);
CREATE INDEX idx_template_tasks_active ON template_tasks(active) WHERE active = true;

-- ============================================================================
-- 3. TASK STATUSES (Configurable)
-- ============================================================================
CREATE TABLE task_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status_key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  color TEXT DEFAULT '#64748b',
  is_complete BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 10,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default statuses
INSERT INTO task_statuses (status_key, label, color, is_complete, sort_order) VALUES
  ('TODO', 'To Do', '#64748b', false, 1),
  ('IN_PROGRESS', 'In Progress', '#3b82f6', false, 2),
  ('COMPLETED', 'Completed', '#22c55e', true, 3);

-- ============================================================================
-- 4. TASK PRIORITIES (Configurable)
-- ============================================================================
CREATE TABLE task_priorities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  priority_key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  color TEXT DEFAULT '#64748b',
  sort_order INTEGER DEFAULT 10,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default priorities
INSERT INTO task_priorities (priority_key, label, color, sort_order) VALUES
  ('URGENT', 'Urgent', '#ef4444', 1),
  ('HIGH', 'High', '#f97316', 2),
  ('MEDIUM', 'Medium', '#eab308', 3),
  ('LOW', 'Low', '#6b7280', 4);

-- ============================================================================
-- 5. INVOICE STATUSES (Optional - for future automation)
-- ============================================================================
CREATE TABLE invoice_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status_key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  color TEXT DEFAULT '#64748b',
  triggers_production BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 10,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 6. UPDATE EXISTING TABLES
-- ============================================================================

-- Add columns to tasks table
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS line_item_id UUID REFERENCES line_items(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS template_task_key TEXT;

CREATE INDEX idx_tasks_line_item ON tasks(line_item_id);
CREATE INDEX idx_tasks_auto_generated ON tasks(auto_generated) WHERE auto_generated = true;

-- Add template reference to categories (if not already present)
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS template_key TEXT REFERENCES project_templates(template_key);
```

### Updated Tasks Table Structure

```typescript
type Task = {
  id: string                    // UUID
  title: string                 // Task label
  description: string | null    // Optional details
  status: string                // References task_statuses.status_key
  priority: string              // References task_priorities.priority_key
  due_date: string | null       // Optional deadline
  created_at: string            // Timestamp

  // Relationships
  invoice_id: string | null     // Parent invoice
  line_item_id: string | null   // 🆕 CRITICAL: Links to specific line item
  submission_id: string | null  // Optional link to submission
  quote_id: string | null       // Optional link to quote

  // Production workflow metadata
  auto_generated: boolean       // 🆕 True if created from template
  sort_order: number            // 🆕 Order within line item workflow
  template_task_key: string     // 🆕 References template_tasks.task_key

  // Additional fields
  notes: string | null          // Optional notes
}
```

---

## ⚙️ Production Flow Logic

### Workflow: From Payment to Production Tasks

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. INVOICE PAYMENT / MANUAL PRODUCTION MOVE                         │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 2. TRIGGER: generateProductionTasks(invoiceId)                      │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 3. QUERY: Get all line items for invoice                            │
│    SELECT * FROM line_items WHERE invoice_id = $1                   │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 4. FOR EACH LINE ITEM:                                              │
│    ┌──────────────────────────────────────────────────────────┐    │
│    │ 4a. Get line item category                               │    │
│    │     category = lineItem.category_key                     │    │
│    └──────────────────────────────────────────────────────────┘    │
│                              ↓                                       │
│    ┌──────────────────────────────────────────────────────────┐    │
│    │ 4b. Find template for category                           │    │
│    │     SELECT * FROM project_templates                      │    │
│    │     WHERE category_key = $category AND active = true     │    │
│    └──────────────────────────────────────────────────────────┘    │
│                              ↓                                       │
│    ┌──────────────────────────────────────────────────────────┐    │
│    │ 4c. Get template tasks                                   │    │
│    │     SELECT * FROM template_tasks                         │    │
│    │     WHERE template_key = $templateKey                    │    │
│    │     AND active = true                                    │    │
│    │     ORDER BY sort_order ASC                              │    │
│    └──────────────────────────────────────────────────────────┘    │
│                              ↓                                       │
│    ┌──────────────────────────────────────────────────────────┐    │
│    │ 4d. Create tasks for THIS line item                      │    │
│    │     FOR EACH template_task:                              │    │
│    │       INSERT INTO tasks (                                │    │
│    │         title: templateTask.label,                       │    │
│    │         invoice_id: invoiceId,                           │    │
│    │         line_item_id: lineItem.id,  ← CRITICAL!          │    │
│    │         status: 'TODO',                                  │    │
│    │         priority: templateTask.default_priority,         │    │
│    │         auto_generated: true,                            │    │
│    │         sort_order: templateTask.sort_order,             │    │
│    │         template_task_key: templateTask.task_key         │    │
│    │       )                                                   │    │
│    └──────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 5. RESULT: Tasks appear in Production Flow, grouped by line item    │
└─────────────────────────────────────────────────────────────────────┘
```

### Example Template: FULL_WRAP_WORKFLOW

Based on production flow screenshot, a typical Full Wrap template contains:

```typescript
ProjectTemplate {
  template_key: "FULL_WRAP_WORKFLOW",
  category_key: "FULL_WRAP",
  label: "Full Wrap Production",
  description: "Standard workflow for full vehicle wraps",
  active: true
}

TemplateTasks: [
  { sort_order: 1,  task_key: "VERIFY",      label: "Verify Measurements",        priority: "HIGH" },
  { sort_order: 2,  task_key: "DESIGN",      label: "Finalize Artwork/Design",    priority: "MEDIUM" },
  { sort_order: 3,  task_key: "PRINT",       label: "Print Wrap",                 priority: "MEDIUM" },
  { sort_order: 4,  task_key: "OUTGAS",      label: "Outgas (overnight minimum)", priority: "LOW" },
  { sort_order: 5,  task_key: "LAMINATE",    label: "Laminate",                   priority: "MEDIUM" },
  { sort_order: 6,  task_key: "CUT",         label: "Cutdown",                    priority: "MEDIUM" },
  { sort_order: 7,  task_key: "PREP",        label: "Prep Vehicle",               priority: "HIGH" },
  { sort_order: 8,  task_key: "INSTALL",     label: "Install Wrap",               priority: "HIGH" },
  { sort_order: 9,  task_key: "QC",          label: "Quality Check",              priority: "HIGH" },
  { sort_order: 10, task_key: "PICKUP",      label: "Customer Pickup",            priority: "MEDIUM" }
]
```

### Example Template: PPF_WORKFLOW

```typescript
ProjectTemplate {
  template_key: "PPF_WORKFLOW",
  category_key: "PPF",
  label: "Paint Protection Film",
  description: "Standard workflow for PPF installation"
}

TemplateTasks: [
  { sort_order: 1, task_key: "VERIFY",        label: "Verify Measurements",     priority: "HIGH" },
  { sort_order: 2, task_key: "TEMPLATE",      label: "Select Film Template",    priority: "MEDIUM" },
  { sort_order: 3, task_key: "CUT_FILM",      label: "Cut Film",                priority: "MEDIUM" },
  { sort_order: 4, task_key: "PREP",          label: "Prep Vehicle",            priority: "HIGH" },
  { sort_order: 5, task_key: "INSTALL",       label: "Install PPF",             priority: "HIGH" },
  { sort_order: 6, task_key: "QC",            label: "Quality Check",           priority: "HIGH" },
  { sort_order: 7, task_key: "PICKUP",        label: "Customer Pickup",         priority: "MEDIUM" }
]
```

### Example Template: TINT_WORKFLOW

```typescript
ProjectTemplate {
  template_key: "TINT_WORKFLOW",
  category_key: "TINT",
  label: "Window Tint",
  description: "Standard workflow for window tinting"
}

TemplateTasks: [
  { sort_order: 1, task_key: "VERIFY",      label: "Verify Film Selection",  priority: "MEDIUM" },
  { sort_order: 2, task_key: "PREP",        label: "Prep Windows",           priority: "HIGH" },
  { sort_order: 3, task_key: "CUT",         label: "Cut Film",               priority: "MEDIUM" },
  { sort_order: 4, task_key: "INSTALL",     label: "Install Tint",           priority: "HIGH" },
  { sort_order: 5, task_key: "QC",          label: "Quality Check",          priority: "HIGH" },
  { sort_order: 6, task_key: "PICKUP",      label: "Customer Pickup",        priority: "MEDIUM" }
]
```

---

## 📅 Implementation Phases

### ✅ Phase 0: Preparation & Documentation
- [x] Deep dive review of legacy system
- [x] Map Google Sheets to Supabase schema
- [x] Document production flow logic
- [x] Create implementation specification
- [x] Get client approval to proceed

---

### ✅ Phase 1: Database Foundation (COMPLETED)

**Objective:** Create Supabase tables and migrate configuration data

#### Phase 1.1: Schema Creation ✅
- [x] Create migration file: `001_production_workflow_tables.sql`
- [x] Run migration to create all new tables
- [x] Verify indexes and foreign keys
- [x] Test RLS policies (if applicable)

#### Phase 1.2: Data Migration ✅
- [x] Created SQL inserts for production templates
- [x] ProjectTemplates → `project_templates` (8 templates)
- [x] TemplateTasks → `template_tasks` (Vinyl Wrap, PPF, Window Tint, Signage, Decals, Ceramic Coating, Detailing, Apparel)
- [x] Validate data integrity
- [x] Log migration results

#### Phase 1.3: Update Existing Categories ✅
- [x] Link categories to project templates
- [x] Update categories table with `template_key` references
- [x] Verify all active categories have templates

**Files Created:**
- ✅ Database tables via SQL
- ✅ Template data via SQL inserts
- ✅ TypeScript types in components

**Completion Criteria:**
- ✅ All configuration tables exist in Supabase
- ✅ 8 production templates with 55+ tasks created
- ✅ Categories linked to templates
- ✅ System tested and working

---

### ✅ Phase 2: Production Task Auto-Generation (COMPLETED)

**Objective:** Implement template-based task creation per line item

#### Phase 2.1: Core Logic Library ✅
- [x] Create `app/lib/production/taskGenerator.ts`
  - [x] `generateTasksForInvoice(invoiceId: string)` - Generates tasks for all line items
    - [x] Get all line items for invoice
    - [x] For each line item:
      - [x] Determine category
      - [x] Find ProjectTemplate via category mapping
      - [x] Get TemplateTasks
      - [x] Create tasks in `tasks` table with `line_item_id`
    - [x] Return summary: `{ success, lineItemsProcessed, totalTasksCreated, errors }`
  - [x] `regenerateTasksForLineItem(invoiceId, lineItemId)` - Manual re-generation
  - [x] Idempotent checks to prevent duplicate task creation

#### Phase 2.2: API Endpoints ✅
- [x] Create `/app/api/production/generate-tasks/route.ts`
  - [x] POST endpoint
  - [x] Body: `{ invoiceId: string }`
  - [x] Calls `generateTasksForInvoice()`
  - [x] Returns: `{ success, totalTasksCreated, lineItemsProcessed, message }`

- [x] Create `/app/api/production/regenerate-line-item/route.ts`
  - [x] POST endpoint
  - [x] Body: `{ invoiceId: string, lineItemId: string }`
  - [x] Deletes old auto-generated tasks
  - [x] Generates fresh tasks
  - [x] Returns: `{ success, totalTasksCreated, message }`

#### Phase 2.3: Document Detail Integration ✅
- [x] Update `app/(dashboard)/documents/[id]/DocumentDetail.tsx`
  - [x] Add "Move to Production" button
  - [x] Button calls `/api/production/generate-tasks`
  - [x] Show success toast with task count
  - [x] Updates document bucket to IN_PRODUCTION
  - [x] Handles partial success with error messages

#### Phase 2.4: Payment Webhook Integration ⚠️
- [ ] Auto-trigger on payment webhook
  - **Status:** NOT IMPLEMENTED - Manual "Move to Production" button used instead
  - **Reason:** User prefers manual control over production workflow initiation

#### Phase 2.5: Testing ✅
- [x] Tested with multiple line items across different categories
- [x] Verified each line item gets correct task set
- [x] Verified tasks have correct `line_item_id` linkage
- [x] Verified tasks appear in Production Flow
- [x] Tested regeneration functionality

**Files Created:**
- ✅ `/app/lib/production/taskGenerator.ts`
- ✅ `/app/api/production/generate-tasks/route.ts`
- ✅ `/app/api/production/regenerate-line-item/route.ts`

**Files Modified:**
- ✅ `/app/(dashboard)/documents/[id]/DocumentDetail.tsx`

**Completion Criteria:**
- ✅ Each line item gets its own task set
- ✅ Tasks have correct `line_item_id` linkage
- ✅ Manual "Move to Production" button works
- ✅ Can regenerate tasks if needed
- ✅ Command Center filters out auto-generated tasks

---

### ⚡ Phase 3: System Settings UI (PARTIALLY COMPLETE)

**Objective:** Build comprehensive configuration management in System Settings

#### Phase 3.1: Task Statuses Tab ❌
- [ ] Create dedicated Task Statuses tab
  - **Status:** NOT IMPLEMENTED
  - **Note:** Currently hardcoded as TODO, IN_PROGRESS, COMPLETED

#### Phase 3.2: Task Priorities Tab ❌
- [ ] Create dedicated Task Priorities tab
  - **Status:** NOT IMPLEMENTED
  - **Note:** Currently hardcoded as HIGH, MEDIUM, LOW

#### Phase 3.3: Production Templates Tab ✅
- [x] Create "Production Templates" tab in Settings
  - [x] **Main View:**
    - [x] List all ProjectTemplates from database
    - [x] Each template shows:
      - [x] Label, Category Key, # of tasks, Active status
    - [x] Expandable accordion per template (click to expand/collapse)
    - [x] Task count badge

  - [x] **Expanded Template View:**
    - [x] Shows all TemplateTasks for that template
    - [x] Tasks display with numbered badges
    - [x] Task key, label, and priority visible
    - [x] "Add Task" button
    - [x] Edit/Delete buttons per task

  - [x] **Task Modal (Add/Edit Template Task):**
    - [x] Task Key input (auto-converted to UPPERCASE)
    - [x] Label input
    - [x] Priority dropdown (HIGH, MEDIUM, LOW)
    - [x] Auto-increment sort order
    - [x] Direct Supabase integration (no API routes needed)

**Implemented Features:**
- ✅ Production Templates management UI
- ✅ Add new tasks to any template
- ✅ Edit existing task labels and priorities
- ✅ Delete tasks from templates
- ✅ Real-time updates via Supabase
- ✅ Color-coded priority badges (Red=High, Orange=Medium, Gray=Low)

**Files Created:**
- ✅ Integrated into `/app/(dashboard)/settings/SettingsView.tsx` (inline Production Templates tab)

**Files Modified:**
- ✅ `/app/(dashboard)/settings/SettingsView.tsx` - Added Production Templates tab with full CRUD
- ✅ `/app/(dashboard)/settings/page.tsx` - Added template data fetching

**Completion Criteria:**
- ⚠️ Task Statuses management - NOT IMPLEMENTED (future enhancement)
- ⚠️ Task Priorities management - NOT IMPLEMENTED (future enhancement)
- ✅ Production Templates management - FULLY IMPLEMENTED
- ✅ Add/edit/delete tasks within workflows - FULLY IMPLEMENTED
- ✅ Changes immediately reflect in production task generation - VERIFIED

---

### ✅ Phase 4: Production Flow Enhancements (COMPLETED)

**Objective:** Update Production Flow page to be fully dynamic and line-item-aware

#### Phase 4.1: Data Fetching Updates ✅
- [x] Update `app/(dashboard)/production/page.tsx`
  - [x] Fetch jobs (invoices with in_production = true)
  - [x] Fetch ALL tasks for production jobs
  - [x] Pass data to ProductionFlow component
  - [x] Group tasks by line item in client component

#### Phase 4.2: UI Component Updates ✅
- [x] Update `app/(dashboard)/production/ProductionFlow.tsx`
  - [x] **Job Card Structure:** ✅
    ```
    Invoice #1005 - Customer Name - Vehicle
    ├─ Line Item 1: PPF - Front Bumper (8 tasks)
    │  ├─ Progress: 60% complete (circular ring)
    │  ├─ Category badge with calendar color
    │  ├─ Collapsible section (click chevron)
    │  ├─ Drag-and-drop reordering
    │  └─ Task checklist with checkboxes
    │
    └─ Line Item 2: Vinyl Wrap - Hood (10 tasks)
       ├─ Progress: 30% complete (circular ring)
       └─ ...confetti animation on 100% completion
    ```

  - [x] Each line item is its own collapsible section
  - [x] Tasks dynamically generated from templates
  - [x] Circular progress ring per line item (category-colored)
  - [x] Category badges with matching calendar colors
  - [x] **Enhanced Features:**
    - [x] Collapsible line item sections (▶/▼ chevron)
    - [x] Drag-and-drop reordering of line items
    - [x] Category-specific colored progress rings
    - [x] Colored left border matching category
    - [x] Glow effect on progress rings
    - [x] Confetti celebration on task completion
    - [x] Visual separation with 2px borders

#### Phase 4.3: Task Interaction ✅
- [x] Click task checkbox → Toggle status (TODO → COMPLETED)
- [x] Save to Supabase directly (no API route)
- [x] Real-time progress ring updates
- [x] Confetti animation on line item completion
- [x] Visual indicators:
  - [x] Completed tasks: Checkmark visible
  - [x] Pending tasks: Empty checkbox
  - [x] Progress percentage displayed in ring

#### Phase 4.4: Filtering & Sorting ✅
- [x] Filter by category (dropdown selector)
- [x] Filter by customer name / vehicle / invoice number (search input)
- [x] Filter by status (Not Started / In Progress / Completed)
- [x] Sort by invoice number (Newest/Oldest)
- [x] Sort by customer name (A-Z / Z-A)
- [x] Sort by category (A-Z / Z-A)
- [x] Sort by progress percentage (Low-High / High-Low)
- [x] Clear Filters button (appears when filters active)
- [x] Smart empty state (shows different message when filters active)
  - **Status:** ✅ COMPLETED
  - **Completed:** 2026-02-05

**Files Modified:**
- ✅ `/app/(dashboard)/production/page.tsx` - Data fetching
- ✅ `/app/(dashboard)/production/ProductionFlow.tsx` - Full UI implementation with:
  - Collapsible sections
  - Drag-and-drop reordering
  - Category-colored progress rings
  - Confetti animations
  - Real-time task updates

**Completion Criteria:**
- ✅ Production Flow shows all line items separately
- ✅ Each line item has its own task checklist
- ✅ Progress calculated per line item with circular rings
- ✅ Tasks update in real-time via Supabase
- ✅ Filtering and sorting fully implemented
- ✅ Visual design polished and production-ready

**Additional Features Implemented:**
- ✅ Color mapping from calendar categories
- ✅ Collapsible/expandable line item sections
- ✅ Drag-and-drop section reordering (memory-only, not persisted)
- ✅ Confetti particle system on completion
- ✅ Debug info removed from production page
- ✅ Command Center excludes auto-generated tasks

---

### 🎯 Phase 5: Advanced Features (Future)

**Note:** These are post-MVP enhancements

#### Phase 5.1: Automations Engine
- [ ] Create `automations` table
- [ ] Build automation trigger system
- [ ] Example: "When invoice status → Paid, auto-generate tasks"
- [ ] Example: "When all tasks → Completed, send customer pickup notification"

#### Phase 5.2: Task Dependencies
- [ ] Add `depends_on_task_id` to tasks table
- [ ] UI to define dependencies in workflow editor
- [ ] Auto-lock dependent tasks until prerequisite is complete
- [ ] Example: "Install" cannot start until "Print" is completed

#### Phase 5.3: Time Tracking
- [ ] Add `started_at`, `completed_at`, `time_spent_minutes` to tasks
- [ ] Start/stop timer per task
- [ ] Track actual vs. estimated time
- [ ] Production efficiency reports

#### Phase 5.4: Production Analytics Dashboard
- [ ] Average time per workflow type
- [ ] Bottleneck identification (which task takes longest?)
- [ ] Employee performance (if assigned_to is tracked)
- [ ] Category-based production metrics
- [ ] Revenue per production hour

---

## 📊 Current Status

### ✅ Completed (Production-Ready)
- **Phase 0:** Legacy system deep dive and documentation
- **Phase 1:** Database schema created and populated with 8 production templates
- **Phase 2:** Auto-generation logic implemented - tasks create per line item on "Move to Production"
- **Phase 3:** Production workflow configuration UIs in Settings
  - **Phase 3.0:** Production Templates management (add/edit/delete template tasks)
  - **Phase 3.1:** Task Statuses management (add/edit/delete status options)
  - **Phase 3.2:** Task Priorities management (add/edit/delete priority levels)
- **Phase 4:** Production Flow page with full functionality
  - **Phase 4.1-4.3:** Line-item tracking, collapsible sections, drag-drop, colored rings, confetti
  - **Phase 4.4:** Filtering & sorting (category, status, customer, sort options)

**Key Achievements:**
- ✅ 8 production workflow templates with 55+ tasks
- ✅ Line-item-level task tracking
- ✅ Category-to-template mapping
- ✅ Auto-task generation on production move
- ✅ Real-time task updates via Supabase
- ✅ Production Templates management in Settings
- ✅ Task Statuses and Priorities management in Settings
- ✅ Colored progress rings matching calendar
- ✅ Collapsible and reorderable line items
- ✅ Confetti celebrations on completion
- ✅ Advanced filtering and sorting in Production Flow
- ✅ Command Center filters out production tasks
- ✅ Comprehensive documentation (PRODUCTION_FLOW.md)

### 🚧 In Progress
- None - Core system is complete and deployed

### ⏳ Deferred for Future Enhancement
- **Phase 2.4:** Payment webhook auto-trigger (manual "Move to Production" preferred)
- **Phase 5:** Advanced features (automations, dependencies, time tracking, analytics)

### 🔴 Blockers
- None

### 📝 Recent Changes (2026-02-05)
- **Phase 3.1 & 3.2:** Added Task Statuses and Task Priorities management tabs in Settings
  - Full CRUD operations for statuses (with is_complete flag)
  - Full CRUD operations for priorities
  - Color customization and sort order management
- **Phase 4.4:** Implemented complete filtering and sorting in Production Flow
  - Status filter (Not Started / In Progress / Completed)
  - Enhanced search (customer, vehicle, invoice number)
  - 8 sort options (invoice, customer, category, progress - ascending/descending)
  - Clear Filters button with smart empty state
- Updated PRODUCTION_FLOW_IMPLEMENTATION_SPEC.md to mark Phases 3.1, 3.2, and 4.4 as complete

---

## 🔧 Technical Details

### Key Legacy Functions (Reference)

#### From `FWG_Ops_Main`

```javascript
// Line 2774: Generate production tasks for an invoice
function generateTasksForInvoice(invoiceId) {
  // 1. Get invoice from Documents sheet
  // 2. Extract category from invoice
  // 3. Find ProjectTemplate for category
  // 4. Get TemplateTasks for template
  // 5. Create tasks in Tasks sheet
  // 6. Return { ok, tasksCreated, templateUsed }
}

// Line 563: Get Command Center metrics
function getCommandCenterMetrics() {
  // Fetches FWG revenue from Financial Core TRANSACTIONS
  // Calculates MTD/YTD totals, category breakdown
  // Calculates 2.5% bonus for Diogo/Mason
  // Returns metrics object
}

// Line 1821: Get system settings (task config)
function getSystemSettings() {
  // Fetches from Spec sheet:
  // - TaskStatuses
  // - TaskPriorities
  // - ProjectTemplates (with nested TemplateTasks)
  // - Automations
  // - InvoiceStatuses
}
```

### Category Revenue Mapping

From legacy code (FWG_Ops_Main lines 571-595):

```javascript
const BONUS_CATEGORIES = [
  'PPF Revenue',
  'Full Wrap Revenue',
  'Partial Wrap Revenue',
  'Vinyl Lettering Revenue',
  'Vinyl Graphics Revenue'
]

const CATEGORY_DISPLAY = {
  'PPF Revenue': 'PPF',
  'Full Wrap Revenue': 'Full Wrap',
  'Partial Wrap Revenue': 'Partial Wrap',
  'Vinyl Lettering Revenue': 'Vinyl Lettering',
  'Vinyl Graphics Revenue': 'Vinyl Graphics',
  'Apparel Revenue': 'Apparel',
  'Embroidery Revenue': 'Embroidery',
  'Signage Revenue': 'Signage',
  'Stickers Revenue': 'Stickers',
  'Labels Revenue': 'Labels',
  'Design Fee Revenue': 'Design Fee',
  'DTF Transfer Revenue': 'DTF Transfer',
  'Window Graphics Revenue': 'Window Graphics',
  'Other Revenue': 'Other'
}
```

### Task Status Transitions

```
TODO → IN_PROGRESS → COMPLETED
  ↑                      ↓
  └──────────────────────┘
  (Can toggle back from COMPLETED to IN_PROGRESS)
```

### Production Pipeline Visual Stages

Based on screenshot analysis:

```
VERIFY → DESIGN → PRINT → OUTGAS → LAMINATE → CUT → PREP → INSTALL → QC → PICKUP
```

These are NOT hardcoded - they're dynamically generated from TemplateTasks!

---

## 📁 Key Files Reference

### New System (Next.js)

#### Production Flow
- `/app/(dashboard)/production/page.tsx` - Production Flow page (server component)
- `/app/(dashboard)/production/ProductionFlow.tsx` - Main UI component

#### Task Management
- `/app/(dashboard)/tasks/page.tsx` - Task Board page
- `/app/(dashboard)/tasks/TaskBoard.tsx` - Kanban/List view component

#### Settings
- `/app/(dashboard)/settings/page.tsx` - Settings page
- `/app/(dashboard)/settings/SettingsView.tsx` - Settings UI

#### Document Management
- `/app/(dashboard)/documents/[id]/DocumentDetail.tsx` - Quote/Invoice editor
- `/app/(dashboard)/documents/[id]/page.tsx` - Server component wrapper

#### API Routes
- `/app/api/tasks/create/route.ts` - Create task
- `/app/api/tasks/update/route.ts` - Update task status/details
- `/app/api/tasks/delete/route.ts` - Delete task
- `/app/api/payment/route.ts` - Payment processing (webhook)

#### Libraries
- `/app/lib/googleSheets.ts` - Google Sheets API integration (legacy data fetch)
- `/app/lib/supabase.ts` - Supabase client initialization
- `/app/lib/types/` - TypeScript type definitions

### Legacy System (Google Apps Script)

#### Core Files
- `/legacy-appscript/FWG_Ops_Main` - Main entry point, routing, configuration (8,274 lines)
- `/legacy-appscript/FWG_Ops_DocumentDetail` - Quote/Invoice editor (6,993 lines)
- `/legacy-appscript/FWG_Ops_Dashboard` - Dashboard view (5,919 lines)
- `/legacy-appscript/FWG_Ops_SystemSet` - System Settings UI (2,597 lines)
- `/legacy-appscript/FWG_Ops_TaskBoard` - Task management (1,470 lines)

#### Google Sheets
- **Spec Sheet ID:** `1RvRIcNDsYGvx2to302lzDs3nmFQXHETYNZzMWoyFnhE`
- **Ops Sheet ID:** `1Pyh1w6Gsx7pkZd9uRwB4YhGQfb0VWHzIE_qzcSO39lw`
- **Financial Core ID:** `1dK9v4XosHHHs6eJWHBhhBVtSQKS8_hcZa2uelp3ErBc`

---

## 🎉 Implementation Summary

### System Overview
The FWG Production Flow System is **COMPLETE and PRODUCTION-READY**. The system successfully migrated from Google Sheets to a modern, real-time Supabase-powered workflow with template-based task automation.

### What Was Built

**1. Database Foundation**
- Created `project_templates` table with 8 workflow templates
- Created `template_tasks` table with 55+ task definitions
- Updated `tasks` table with `line_item_id`, `auto_generated`, `sort_order`, `template_task_key` columns
- Linked categories to templates via `template_key` foreign key

**2. Auto-Generation System**
- `taskGenerator.ts` - Core logic for generating tasks from templates
- `/api/production/generate-tasks` - Generates tasks for entire invoice
- `/api/production/regenerate-line-item` - Regenerates tasks for single line item
- Idempotent checks prevent duplicate task creation
- Each line item gets its own task set based on category

**3. Production Flow UI**
- Line-item-grouped task display
- Circular progress rings per line item (category-colored)
- Collapsible sections with chevron toggle
- Drag-and-drop reordering of line items
- Real-time task checkbox updates
- Confetti particle animation on completion
- Category badges with calendar color matching
- 2px borders for visual separation
- Colored left borders with glow effects

**4. Settings Management**
- Production Templates tab in System Settings
- View all templates with expandable task lists
- Add new tasks to any template
- Edit task labels and priorities
- Delete tasks from templates
- Direct Supabase integration (no API middleware)
- Real-time updates reflected in production

**5. Document Integration**
- "Move to Production" button on invoice detail page
- Calls task generation API
- Updates document bucket to IN_PRODUCTION
- Shows success toast with task count
- Handles partial success with error reporting

**6. Command Center Integration**
- Filters out auto-generated tasks (`.neq('auto_generated', true)`)
- Keeps dashboard focused on manual/priority tasks
- Production tasks isolated to Production Flow page

### Production Templates Created

| Template | Category | Tasks | Description |
|----------|----------|-------|-------------|
| Vinyl Wrap Workflow | VINYL_WRAP | 10 | Strip/Prep → Design → Print → Outgas → Laminate → Cut → Test Fit → Install → Squeegee → Final Inspection → Pickup |
| PPF Workflow | PPF | 8 | Wash → Decontaminate → Measure → Prep → Apply → Trim → Final Inspection → Pickup |
| Window Tint Workflow | WINDOW_TINT | 6 | Measure → Clean → Cut → Install → QC → Pickup |
| Signage Workflow | SIGNAGE | 6 | Design Approval → Fabricate → Prep → Install → QC → Complete |
| Decals Workflow | DECALS | 6 | Design Approval → Print → Laminate → Cut → Install → Pickup |
| Ceramic Coating Workflow | CERAMIC_COATING | 8 | Wash → Decontaminate → Polish → Prep → Apply → Cure → QC → Pickup |
| Detailing Workflow | DETAILING | 6 | Exterior Wash → Interior → Polish → Protect → QC → Pickup |
| Apparel Workflow | APPAREL | 5 | Design Approval → Order → Production → QC → Pickup |

### Files Created/Modified

**New Files:**
- `/app/lib/production/taskGenerator.ts` - Core task generation logic
- `/app/api/production/generate-tasks/route.ts` - API endpoint for full invoice
- `/app/api/production/regenerate-line-item/route.ts` - API endpoint for single line item
- `/PRODUCTION_FLOW.md` - Comprehensive system documentation

**Modified Files:**
- `/app/(dashboard)/production/page.tsx` - Data fetching for production jobs
- `/app/(dashboard)/production/ProductionFlow.tsx` - Complete UI overhaul with all enhancements
- `/app/(dashboard)/documents/[id]/DocumentDetail.tsx` - Added "Move to Production" button
- `/app/(dashboard)/page.tsx` - Excluded auto-generated tasks from Command Center
- `/app/(dashboard)/settings/page.tsx` - Added template data fetching
- `/app/(dashboard)/settings/SettingsView.tsx` - Added Production Templates tab with full CRUD

### Technical Achievements
- ✅ Zero Google Sheets dependencies for production workflows
- ✅ Real-time task updates via Supabase subscriptions
- ✅ Idempotent task generation (safe to retry)
- ✅ Line-item-level tracking (not just invoice-level)
- ✅ Template-based configuration (no hardcoded workflows)
- ✅ Category color mapping from calendar system
- ✅ Drag-and-drop UI enhancements
- ✅ Confetti particle animations
- ✅ Comprehensive error handling
- ✅ TypeScript type safety throughout

### User Experience Wins
- 🎯 **Clear visual hierarchy:** Each line item is clearly separated
- 🎨 **Category colors:** Instant recognition via calendar color matching
- 📊 **Progress tracking:** Circular rings show completion at a glance
- 🎊 **Celebrations:** Confetti rewards task completion
- 🔄 **Real-time updates:** No page refreshes needed
- ⚡ **Fast interactions:** Direct Supabase updates, no API latency
- 🎛️ **Configurable:** Workflows editable via Settings UI
- 📱 **Responsive:** Works on desktop and tablet

### What's Next (Future Enhancements)
While the core system is complete, these optional enhancements could be added:

**Phase 3 Completions:**
- Task Statuses management UI (currently hardcoded)
- Task Priorities management UI (currently hardcoded)

**Phase 4 Enhancements:**
- Advanced filtering (by category, customer, status)
- Sorting options (by invoice #, date, priority)

**Phase 5 Advanced Features:**
- Automation engine (trigger tasks on events)
- Task dependencies (sequential task locking)
- Time tracking (start/stop timers per task)
- Production analytics dashboard
- Team member assignment per task
- Calendar integration for scheduling
- SMS/email notifications

---

## 🎯 How to Use This Document

### Starting Fresh Conversation

When starting a new chat session, paste this entire document and say:

```
"I'm working on the FWG Ops production flow system migration. I've attached
the implementation spec. I'm currently on Phase [X.Y]. Please review the
document and let me know when you're ready to proceed with the next task."
```

### Updating Progress

After completing a task:
1. Mark the checkbox in the relevant phase section
2. Update "Current Status" section
3. Note any blockers or issues
4. Save document for next session

### Phase Completion

When a full phase is complete:
- Move it to "Completed" in Current Status
- Update "In Progress" to next phase
- Create a git commit with phase completion message

---

## 📝 Notes & Decisions

### Key Architectural Decisions

1. **Line Item Linkage:** Tasks are linked to `line_item_id`, not just `invoice_id`
   - **Reason:** Invoices can have multiple line items; each needs separate tracking
   - **Impact:** Production Flow must group tasks by line item

2. **Template-First Approach:** All workflows defined in database, not code
   - **Reason:** Allow non-technical users to modify workflows via Settings UI
   - **Impact:** Settings UI must be robust and user-friendly

3. **Auto-Generated Flag:** Tasks track whether they were template-generated
   - **Reason:** Allows distinction between auto and manual tasks
   - **Impact:** Can filter, regenerate, or bulk-delete auto-generated tasks

4. **Google Sheets Migration:** Move all config to Supabase
   - **Reason:** Eliminate latency issues, enable real-time updates
   - **Impact:** Financial Core TRANSACTIONS still uses Sheets API (separate concern)

### Open Questions
- None currently

### Future Considerations
- Task assignment (assign specific team members to tasks)
- Task notifications (SMS/email when task is ready or overdue)
- Calendar integration (schedule install dates, pickup dates)
- Material tracking (link tasks to inventory consumption)

---

## 🔗 Related Documentation

- `GOOGLE_SHEETS_SETUP.md` - Google Sheets API integration guide
- `FEATURE_AUDIT.md` - Comprehensive feature checklist for new system
- Legacy AppScript files in `/legacy-appscript/` directory

---

**End of Document**

*This document should be version-controlled and updated as implementation progresses. Treat it as the single source of truth for the production flow migration project.*
