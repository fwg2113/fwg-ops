# FWG Ops - Production Flow System Implementation Specification

**Document Version:** 2.0
**Last Updated:** 2026-02-04
**Status:** In Progress - Phase 1 Planning

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
- [ ] Get client approval to proceed

---

### 🎯 Phase 1: Database Foundation

**Objective:** Create Supabase tables and migrate configuration data

#### Phase 1.1: Schema Creation
- [ ] Create migration file: `001_production_workflow_tables.sql`
- [ ] Run migration to create all new tables
- [ ] Verify indexes and foreign keys
- [ ] Test RLS policies (if applicable)

#### Phase 1.2: Data Migration Script
- [ ] Create `app/scripts/migrate-legacy-config.ts`
- [ ] Fetch data from Google Sheets Spec
  - [ ] ProjectTemplates → `project_templates`
  - [ ] TemplateTasks → `template_tasks`
  - [ ] TaskStatuses → `task_statuses`
  - [ ] TaskPriorities → `task_priorities`
- [ ] Validate data integrity
- [ ] Log migration results

#### Phase 1.3: Update Existing Categories
- [ ] Link categories to project templates
- [ ] Update categories table with `template_key` references
- [ ] Verify all active categories have templates

**Files to Create:**
- `/supabase/migrations/001_production_workflow_tables.sql`
- `/app/scripts/migrate-legacy-config.ts`
- `/app/lib/types/production.ts` (TypeScript types)

**Completion Criteria:**
- ✅ All configuration tables exist in Supabase
- ✅ Data migrated from Google Sheets
- ✅ Categories linked to templates
- ✅ Zero errors in migration logs

---

### 🎯 Phase 2: Production Task Auto-Generation

**Objective:** Implement template-based task creation per line item

#### Phase 2.1: Core Logic Library
- [ ] Create `app/lib/production/taskGenerator.ts`
  - [ ] `generateProductionTasks(invoiceId: string)`
    - [ ] Get all line items for invoice
    - [ ] For each line item:
      - [ ] Determine category
      - [ ] Find ProjectTemplate
      - [ ] Get TemplateTasks
      - [ ] Create tasks in `tasks` table with `line_item_id`
    - [ ] Return summary: `{ lineItemsProcessed, totalTasksCreated }`
  - [ ] `regenerateTasksForLineItem(lineItemId: string)` (for manual re-generation)
  - [ ] `deleteAutoGeneratedTasks(lineItemId: string)` (cleanup utility)

#### Phase 2.2: API Endpoints
- [ ] Create `/app/api/production/generate-tasks/route.ts`
  - [ ] POST endpoint
  - [ ] Body: `{ invoiceId: string }`
  - [ ] Calls `generateProductionTasks()`
  - [ ] Returns: `{ success, tasksCreated, lineItems }`

- [ ] Create `/app/api/production/regenerate-line-item/route.ts`
  - [ ] POST endpoint
  - [ ] Body: `{ lineItemId: string }`
  - [ ] Deletes old auto-generated tasks
  - [ ] Generates fresh tasks
  - [ ] Returns: `{ success, tasksCreated }`

#### Phase 2.3: Document Detail Integration
- [ ] Update `app/(dashboard)/documents/[id]/DocumentDetail.tsx`
  - [ ] Add "Move to Production" button (if not exists)
  - [ ] Button calls `/api/production/generate-tasks`
  - [ ] Show success toast: "Generated 26 tasks across 3 line items"
  - [ ] Disable button if tasks already exist (show "View Production" instead)
  - [ ] Link to Production Flow page

#### Phase 2.4: Payment Webhook Integration
- [ ] Update `app/api/payment/route.ts` or payment webhook handler
  - [ ] When invoice is marked as paid
  - [ ] Auto-trigger `generateProductionTasks(invoiceId)`
  - [ ] Log success/failure

#### Phase 2.5: Testing
- [ ] Create test invoice with 3 line items (different categories)
- [ ] Mark as paid → verify 3 sets of tasks created
- [ ] Verify each task has correct `line_item_id`
- [ ] Verify tasks appear in Production Flow
- [ ] Test regeneration (delete + recreate)

**Files to Create:**
- `/app/lib/production/taskGenerator.ts`
- `/app/api/production/generate-tasks/route.ts`
- `/app/api/production/regenerate-line-item/route.ts`

**Files to Modify:**
- `/app/(dashboard)/documents/[id]/DocumentDetail.tsx`
- `/app/api/payment/route.ts` (or webhook handler)

**Completion Criteria:**
- ✅ Tasks auto-generate on payment
- ✅ Each line item gets its own task set
- ✅ Tasks have correct `line_item_id` linkage
- ✅ Manual "Move to Production" button works
- ✅ Can regenerate tasks if needed

---

### 🎯 Phase 3: System Settings UI

**Objective:** Build comprehensive configuration management in System Settings

#### Phase 3.1: Task Statuses Tab
- [ ] Create `app/(dashboard)/settings/tabs/TaskStatusesTab.tsx`
  - [ ] List all task statuses from `task_statuses` table
  - [ ] Add/Edit/Delete modal
  - [ ] Drag-and-drop reordering (update `sort_order`)
  - [ ] Color picker for each status
  - [ ] "Is Complete" checkbox
  - [ ] Active/Inactive toggle

#### Phase 3.2: Task Priorities Tab
- [ ] Create `app/(dashboard)/settings/tabs/TaskPrioritiesTab.tsx`
  - [ ] List all priorities from `task_priorities` table
  - [ ] Add/Edit/Delete modal
  - [ ] Drag-and-drop reordering
  - [ ] Color picker
  - [ ] Active/Inactive toggle

#### Phase 3.3: Workflows Tab (Most Complex)
- [ ] Create `app/(dashboard)/settings/tabs/WorkflowsTab.tsx`
  - [ ] **Main View:**
    - [ ] List all ProjectTemplates
    - [ ] Each template shows:
      - Label, Category, # of tasks, Active status
    - [ ] "Add Workflow" button
    - [ ] Expandable accordion per template

  - [ ] **Expanded Template View:**
    - [ ] Shows all TemplateTasks for that template
    - [ ] Drag-and-drop task reordering
    - [ ] "Add Task" button (adds to this template)
    - [ ] Edit/Delete buttons per task

  - [ ] **Workflow Modal (Add/Edit Template):**
    - [ ] Template Key (auto-generate or manual)
    - [ ] Label
    - [ ] Category dropdown (from `categories` table)
    - [ ] Description
    - [ ] Active toggle
    - [ ] Sort order

  - [ ] **Task Modal (Add/Edit Template Task):**
    - [ ] Hidden: template_key
    - [ ] Task Key (auto-generate or manual)
    - [ ] Label
    - [ ] Default Priority (dropdown from `task_priorities`)
    - [ ] Sort Order (auto-increment or manual)
    - [ ] Active toggle

#### Phase 3.4: API Endpoints for Settings
- [ ] `/app/api/settings/task-statuses/route.ts` (GET, POST, DELETE)
- [ ] `/app/api/settings/task-priorities/route.ts` (GET, POST, DELETE)
- [ ] `/app/api/settings/project-templates/route.ts` (GET, POST, DELETE)
- [ ] `/app/api/settings/template-tasks/route.ts` (GET, POST, DELETE)

#### Phase 3.5: Update Settings Navigation
- [ ] Add new tabs to `app/(dashboard)/settings/SettingsView.tsx`:
  - Task Statuses
  - Task Priorities
  - Workflows

**Files to Create:**
- `/app/(dashboard)/settings/tabs/TaskStatusesTab.tsx`
- `/app/(dashboard)/settings/tabs/TaskPrioritiesTab.tsx`
- `/app/(dashboard)/settings/tabs/WorkflowsTab.tsx`
- `/app/api/settings/task-statuses/route.ts`
- `/app/api/settings/task-priorities/route.ts`
- `/app/api/settings/project-templates/route.ts`
- `/app/api/settings/template-tasks/route.ts`

**Files to Modify:**
- `/app/(dashboard)/settings/SettingsView.tsx`

**Completion Criteria:**
- ✅ Can create/edit/delete task statuses
- ✅ Can create/edit/delete priorities
- ✅ Can create/edit/delete workflows
- ✅ Can add/edit/delete tasks within workflows
- ✅ Drag-and-drop reordering works
- ✅ Changes immediately reflect in production task generation

---

### 🎯 Phase 4: Production Flow Enhancements

**Objective:** Update Production Flow page to be fully dynamic and line-item-aware

#### Phase 4.1: Data Fetching Updates
- [ ] Update `app/(dashboard)/production/page.tsx`
  - [ ] Fetch jobs (invoices in production)
  - [ ] For each job, fetch ALL line items
  - [ ] For each line item, fetch tasks (filtered by `line_item_id`)
  - [ ] Group tasks by line item

#### Phase 4.2: UI Component Updates
- [ ] Update `app/(dashboard)/production/ProductionFlow.tsx`
  - [ ] **Job Card Structure:**
    ```
    Invoice #1005 - Customer Name
    ├─ Line Item 1: Partial Wrap - Ford F150
    │  ├─ Progress: 6/10 tasks (60%)
    │  └─ Pipeline: [✓ Verify] [✓ Design] [⬤ Print] [ Outgas] ...
    │
    ├─ Line Item 2: Partial Wrap - Honda Civic
    │  ├─ Progress: 3/10 tasks (30%)
    │  └─ Pipeline: [✓ Verify] [⬤ Design] [ Print] [ Outgas] ...
    │
    └─ Line Item 3: PPF - F150 Hood
       ├─ Progress: 2/6 tasks (33%)
       └─ Pipeline: [✓ Verify] [⬤ Template] [ Cut] [ Install] ...
    ```

  - [ ] Each line item is its own expandable section
  - [ ] Pipeline stages dynamically generated from template tasks
  - [ ] Progress ring shows completion per line item
  - [ ] Category badge per line item

#### Phase 4.3: Task Interaction
- [ ] Click task checkbox → Toggle status (TODO ↔ IN_PROGRESS ↔ COMPLETED)
- [ ] Save to Supabase via `/api/tasks/update`
- [ ] Real-time progress updates
- [ ] Visual indicators:
  - [ ] Completed tasks: Green with checkmark
  - [ ] Current/next task: Blue with pulse
  - [ ] Future tasks: Gray

#### Phase 4.4: Filtering & Sorting
- [ ] Filter by category (PPF, TINT, FULL_WRAP, etc.)
- [ ] Filter by customer name / vehicle
- [ ] Filter by status (Not Started, In Progress, Completed)
- [ ] Sort by invoice number, date, priority

**Files to Modify:**
- `/app/(dashboard)/production/page.tsx`
- `/app/(dashboard)/production/ProductionFlow.tsx`

**Completion Criteria:**
- ✅ Production Flow shows all line items separately
- ✅ Each line item has its own task pipeline
- ✅ Progress calculated per line item
- ✅ Tasks update in real-time
- ✅ Filtering and sorting work correctly
- ✅ Visual design matches screenshot aesthetic

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

### ✅ Completed
- Legacy system deep dive and documentation
- Database schema design
- Production flow logic mapping
- Implementation plan creation

### 🚧 In Progress
- **PHASE 1.1:** Awaiting approval to create database schema

### ⏳ Pending
- Phases 1.2 through 5.4

### 🔴 Blockers
- None currently

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
