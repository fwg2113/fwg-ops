# Database Migrations

This directory contains SQL migrations for the FWG Ops production workflow system.

## Migration Files

### `20260204_production_workflow_tables.sql`
**Phase 1.1 - Database Foundation**

Creates all tables needed for the production workflow system:
- `project_templates` - Workflow templates per category
- `template_tasks` - Task steps within each template
- `task_statuses` - Configurable task statuses
- `task_priorities` - Configurable priority levels
- `invoice_statuses` - Invoice status options (future automation)
- Updates to existing `tasks` table with new columns

## How to Run Migrations

### Option 1: Using Supabase Dashboard (Recommended for first-time)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the contents of `20260204_production_workflow_tables.sql`
5. Paste into the SQL editor
6. Click **Run** (or press Cmd/Ctrl + Enter)
7. Verify all statements executed successfully

### Option 2: Using Supabase CLI

If you have Supabase CLI installed:

```bash
# Make sure you're in the project root
cd /home/user/fwg-ops

# Link to your Supabase project (first time only)
supabase link --project-ref YOUR_PROJECT_REF

# Run the migration
supabase db push
```

### Option 3: Using psql (Direct Database Connection)

If you have direct database access:

```bash
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres" \
  -f supabase/migrations/20260204_production_workflow_tables.sql
```

## Verification

After running the migration, verify it worked:

### Check Tables Exist

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'project_templates',
    'template_tasks',
    'task_statuses',
    'task_priorities',
    'invoice_statuses'
  )
ORDER BY table_name;
```

Should return 5 rows.

### Check Seed Data

```sql
-- Task statuses (should have 3)
SELECT status_key, label, color FROM task_statuses ORDER BY sort_order;

-- Task priorities (should have 4)
SELECT priority_key, label, color FROM task_priorities ORDER BY sort_order;
```

### Check Tasks Table Columns

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'tasks'
  AND column_name IN ('line_item_id', 'auto_generated', 'sort_order', 'template_task_key')
ORDER BY column_name;
```

Should return 4 rows.

## Rollback (if needed)

If you need to undo this migration:

```sql
-- Drop new tables (cascades to foreign keys)
DROP TABLE IF EXISTS template_tasks CASCADE;
DROP TABLE IF EXISTS project_templates CASCADE;
DROP TABLE IF EXISTS task_statuses CASCADE;
DROP TABLE IF EXISTS task_priorities CASCADE;
DROP TABLE IF EXISTS invoice_statuses CASCADE;

-- Remove columns from tasks table
ALTER TABLE tasks
  DROP COLUMN IF EXISTS line_item_id,
  DROP COLUMN IF EXISTS auto_generated,
  DROP COLUMN IF EXISTS sort_order,
  DROP COLUMN IF EXISTS template_task_key;

-- Remove column from categories table
ALTER TABLE categories
  DROP COLUMN IF EXISTS template_key;
```

## Next Steps

After successfully running this migration:

1. ✅ Mark Phase 1.1 as complete
2. 📋 Proceed to **Phase 1.2**: Data Migration Script
   - Create script to migrate Google Sheets data to Supabase
3. 📋 Proceed to **Phase 1.3**: Link categories to templates

## Troubleshooting

### Error: "relation already exists"

This is safe to ignore if you've run the migration before. All CREATE statements use `IF NOT EXISTS`.

### Error: "column already exists"

This is safe to ignore. The migration uses `DO $$ ... END $$` blocks to check for existing columns before adding them.

### Error: "foreign key constraint"

Make sure the referenced tables exist:
- `line_items` table must exist before linking `tasks.line_item_id`
- `categories` table must exist before linking `categories.template_key`

If these tables don't exist, the migration will skip those foreign keys.

## Support

For issues or questions, refer to:
- Main spec: `/PRODUCTION_FLOW_IMPLEMENTATION_SPEC.md`
- Phase 1 details: Section "Phase 1: Database Foundation"
