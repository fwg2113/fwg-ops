# Production Flow System

## Overview

The Production Flow system is an automated task management workflow that generates job-specific tasks when invoices are moved to production. Each line item on an invoice automatically creates its own set of tasks based on pre-configured templates for different service categories.

## Key Features

- **Automatic Task Generation**: When an invoice moves to production, tasks are automatically created for each line item
- **Template-Based Workflows**: Each service category (PPF, Vinyl Wrap, Window Tint, etc.) has its own template with predefined tasks
- **Line Item Tracking**: Each line item gets its own progress ring, task list, and completion celebration
- **Visual Progress Tracking**: Color-coded progress rings match calendar category colors
- **Collapsible Sections**: Expand/collapse individual line items to manage screen space
- **Drag-and-Drop Reordering**: Reorder line item sections within a job
- **Confetti Celebrations**: Visual feedback when all tasks for a line item are completed

## How It Works

### 1. Moving an Invoice to Production

**Location**: Invoice Detail Page (`/documents/[id]`)

1. Open any invoice from the pipeline
2. Click the "Move to Production" button
3. Confirm the action
4. System automatically:
   - Generates tasks for each line item based on its category
   - Moves invoice to "IN_PRODUCTION" bucket
   - Creates production job entry

### 2. Viewing Production Jobs

**Location**: Production Page (`/production`)

The production page displays all active jobs with:
- Job header showing customer name, vehicle info, and total line items
- Collapsible sections for each line item
- Progress rings for each line item showing completion percentage
- Task lists with checkboxes
- Confetti animation when line item completes

**Visual Elements**:
- **Progress Ring**: Circle showing completion % with category-specific color
- **Step Line**: Numbered steps for task progress
- **Category Badge**: Shows service type (PPF, Vinyl Wrap, etc.)
- **Colored Border**: Left border matches category color from calendar

### 3. Managing Tasks

**Checking Off Tasks**:
- Click checkbox next to any task to mark complete
- Progress ring updates in real-time
- When all tasks complete, confetti animation plays

**Collapsing/Expanding**:
- Click chevron icon (▼/▶) to collapse/expand line item section
- Helps manage screen space when multiple jobs are active

**Reordering Sections**:
- Drag line item sections up/down to reorder within a job
- Only reorders sections, not individual tasks
- Order stored in browser (not persisted to database)

## Production Templates

### Location
**Settings → Production Templates** (`/settings` → Production Templates tab)

### Available Templates

1. **Vinyl Wrap Workflow** (10 tasks)
   - Strip & Prep → Clean → Design Mockup → Print → Laminate → Cut → Test Fit → Install → Squeegee → Final Inspection → Pickup

2. **PPF Workflow** (8 tasks)
   - Wash Vehicle → Decontaminate → Measure & Cut → Prep Surface → Apply Film → Trim Edges → Final Inspection → Pickup

3. **Window Tint Workflow** (6 tasks)
   - Measure Windows → Clean & Prep Windows → Cut Film → Install Tint → Quality Check → Customer Pickup

4. **Signage Workflow** (6 tasks)
   - Design Approval → Fabricate → Prep Install Site → Install Signage → Quality Check → Complete

5. **Decals Workflow** (6 tasks)
   - Design Approval → Print Decals → Laminate → Cut to Size → Install → Customer Pickup

6. **Ceramic Coating Workflow** (8 tasks)
   - Wash Vehicle → Decontaminate → Polish → Prep Surface → Apply Coating → Cure → Quality Check → Customer Pickup

7. **Detailing Workflow** (6 tasks)
   - Exterior Wash → Interior Cleaning → Polish/Wax → Protect Surfaces → Quality Check → Customer Pickup

8. **Apparel Workflow** (5 tasks)
   - Design Approval → Order Materials → Production → Quality Check → Customer Pickup

### Managing Templates

**Viewing Templates**:
1. Go to Settings → Production Templates
2. Click any template to expand and see its tasks
3. Tasks are shown in execution order with priority badges

**Adding Tasks**:
1. Expand a template
2. Click "+ Add Task" button
3. Enter:
   - **Task Key**: Unique identifier (auto-converted to UPPERCASE)
   - **Label**: Display name for the task
   - **Priority**: High, Medium, or Low
4. Click "Add Task"

**Editing Tasks**:
1. Click "Edit" button on any task
2. Modify label or priority
3. Click "Save Changes"
4. Note: Task key cannot be changed after creation

**Deleting Tasks**:
1. Click "Delete" button on any task
2. Confirm deletion
3. Task is permanently removed from template

## Database Schema

### Tables

**project_templates**
- `id`: UUID primary key
- `template_key`: Unique identifier (e.g., 'VINYL_WRAP_WORKFLOW')
- `category_key`: Links to categories table
- `label`: Display name
- `description`: Template description
- `active`: Boolean flag
- `sort_order`: Display order

**template_tasks**
- `id`: UUID primary key
- `template_key`: Links to project_templates
- `task_key`: Unique task identifier
- `label`: Task display name
- `default_priority`: HIGH, MEDIUM, or LOW
- `sort_order`: Execution order
- `active`: Boolean flag

**tasks** (generated from templates)
- `id`: UUID primary key
- `title`: Task name (from template_task.label)
- `description`: Task description
- `status`: TODO, IN_PROGRESS, or COMPLETED
- `priority`: HIGH, MEDIUM, or LOW
- `document_id`: Links to invoice/document
- `line_item_id`: Links to specific line item
- `auto_generated`: Boolean flag (true for production tasks)
- `template_task_key`: Reference to source template task
- `sort_order`: Task order

## Category Color Mapping

Each service category has a specific color used throughout the system:

| Category | Color | Hex Code |
|----------|-------|----------|
| PPF / Full PPF / Partial PPF | Pink | #ec4899 |
| Vinyl Wrap / Full Wrap / Chrome Delete / Color Change / Commercial Wrap | Purple | #a855f7 |
| Window Tint / Residential Tint / Commercial Tint / Tint | Orange | #f59e0b |
| Signage / Channel Letters / Monument Sign | Teal | #14b8a6 |
| Apparel | Blue | #3b82f6 |
| Ceramic Coating | Green | #22c55e |
| Detailing | Green | #22c55e |

Colors are used for:
- Progress ring stroke
- Left border on line item cards
- Glow effect on progress rings
- Calendar event colors

## API Endpoints

### Generate Tasks for Invoice
**POST** `/api/production/generate-tasks`

Generates tasks for all line items on an invoice.

```json
{
  "invoiceId": "uuid"
}
```

**Response**:
```json
{
  "success": true,
  "totalTasksCreated": 15,
  "lineItemsProcessed": 3,
  "message": "Generated 15 tasks across 3 line items"
}
```

### Regenerate Tasks for Line Item
**POST** `/api/production/regenerate-line-item`

Deletes existing tasks and regenerates fresh tasks for a specific line item.

```json
{
  "invoiceId": "uuid",
  "lineItemId": "uuid"
}
```

**Response**:
```json
{
  "success": true,
  "totalTasksCreated": 5,
  "message": "Regenerated 5 tasks for line item"
}
```

## File Structure

```
app/
├── (dashboard)/
│   ├── production/
│   │   ├── page.tsx              # Server component - fetches jobs/tasks
│   │   └── ProductionFlow.tsx    # Client component - UI & interactions
│   └── settings/
│       ├── page.tsx              # Server component - fetches templates
│       └── SettingsView.tsx      # Client component - template management
├── api/
│   └── production/
│       ├── generate-tasks/
│       │   └── route.ts          # Generate tasks for invoice
│       └── regenerate-line-item/
│           └── route.ts          # Regenerate tasks for line item
└── lib/
    └── production/
        └── taskGenerator.ts      # Core task generation logic
```

## Key Functions

### taskGenerator.ts

**generateTasksForInvoice(invoiceId: string)**
- Fetches all line items for an invoice
- For each line item:
  - Looks up category's template
  - Checks for existing auto-generated tasks
  - Creates new tasks from template if none exist
- Returns summary of created tasks

**regenerateTasksForLineItem(invoiceId: string, lineItemId: string)**
- Deletes existing auto-generated tasks for line item
- Generates fresh tasks from current template
- Used when template changes or tasks need to be reset

### ProductionFlow.tsx

**Key State**:
- `expandedJobs`: Set of job IDs that are expanded
- `tasks`: Array of all production tasks with real-time updates
- `collapsedSections`: Set of collapsed line item IDs
- `lineItemOrder`: Custom drag-and-drop order per job
- `draggedItem`: Currently dragged line item ID

**Key Functions**:
- `handleTaskUpdate()`: Updates task status and triggers confetti
- `handleDragStart()`, `handleDrop()`: Drag-and-drop reordering
- `toggleCollapse()`: Collapse/expand line items
- `getCategoryColor()`: Maps category to color code
- `triggerConfetti()`: Canvas-based confetti animation

## Command Center Integration

Production tasks are **excluded** from the Command Center dashboard to avoid clutter. The Command Center only shows manual tasks and non-production work.

**Filter Applied**:
```typescript
.neq('auto_generated', true)  // Excludes production tasks
```

## Best Practices

### For Shop Staff

1. **Moving to Production**:
   - Review invoice line items before moving to production
   - Ensure categories are correctly assigned
   - Confirm all required information is present

2. **Managing Tasks**:
   - Check off tasks as they're completed
   - Collapse completed line items to reduce clutter
   - Use drag-and-drop to prioritize urgent items

3. **Screen Management**:
   - Keep only active jobs expanded
   - Collapse completed sections
   - Reorder sections by priority or shop flow

### For Administrators

1. **Template Management**:
   - Keep task lists concise (5-10 tasks ideal)
   - Use clear, action-oriented task names
   - Set appropriate priorities for critical steps
   - Review and refine templates based on actual workflow

2. **Category Assignment**:
   - Ensure all categories have associated templates
   - Map subcategories to main workflows
   - Update templates when processes change

3. **System Maintenance**:
   - Periodically review completed jobs
   - Archive old production data
   - Monitor task completion rates
   - Gather staff feedback on workflows

## Troubleshooting

**Tasks Not Generating**:
- Check if category has an associated template (Settings → Categories)
- Verify template has active tasks
- Check browser console for errors
- Confirm invoice has line items with categories

**Wrong Tasks Generated**:
- Check category-to-template mapping
- Verify correct category assigned to line item
- Use "Regenerate Tasks" if template was updated

**Progress Ring Not Updating**:
- Refresh the page
- Check browser console for errors
- Verify task status is saving (check database)

**Confetti Not Playing**:
- Ensure all tasks are checked (no unchecked tasks)
- Check if line item has any tasks at all
- Browser may block canvas animations - check console

**Drag-and-Drop Not Working**:
- Try refreshing the page
- Ensure you're dragging the entire line item section
- Check that you're dragging within the same job

## Future Enhancements

Potential improvements to consider:

- [ ] Persist drag-and-drop order to database
- [ ] Add task time estimates and tracking
- [ ] Team member assignment per task
- [ ] Task dependencies (complete X before Y)
- [ ] Email notifications for completed milestones
- [ ] Print production worksheets
- [ ] Mobile-optimized production view
- [ ] Real-time collaboration indicators
- [ ] Custom fields per template
- [ ] Task comments and attachments
