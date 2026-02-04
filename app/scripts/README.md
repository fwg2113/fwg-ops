# Migration Scripts

This directory contains data migration scripts for the FWG Ops production workflow system.

## Scripts

### `migrate-legacy-config.ts`
**Phase 1.2 - Data Migration**

Migrates production workflow configuration from Google Sheets Spec to Supabase.

**What it does:**
- Fetches `ProjectTemplates` from Google Sheets
- Fetches `TemplateTasks` from Google Sheets
- Transforms data to match Supabase schema
- Inserts/updates records in Supabase
- Logs all operations with color-coded output

---

## Prerequisites

Before running the migration:

### 1. Phase 1.1 Must Be Complete
Verify these tables exist in your Supabase database:
- `project_templates`
- `template_tasks`

**Quick check:**
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('project_templates', 'template_tasks');
```

### 2. Environment Variables

Make sure these are set in your `.env.local` file:

```env
# Google Sheets API (Service Account JSON)
GOOGLE_SHEETS_CREDENTIALS='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Where to get `GOOGLE_SHEETS_CREDENTIALS`:**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create/select a project
3. Enable Google Sheets API
4. Create Service Account credentials
5. Download JSON key file
6. Copy entire JSON content and set as env variable (must be single-line JSON string)

**Where to get Supabase keys:**
- Go to your Supabase project dashboard
- Settings → API
- Copy Project URL and `anon` public key

### 3. Google Sheets Access

Your service account must have access to the Spec Sheet:

**Sheet ID:** `1RvRIcNDsYGvx2to302lzDs3nmFQXHETYNZzMWoyFnhE`

**How to grant access:**
1. Open the Google Sheet
2. Click "Share"
3. Add your service account email (e.g., `your-service@project.iam.gserviceaccount.com`)
4. Grant "Viewer" permissions

### 4. Install Dependencies

```bash
npm install
```

---

## How to Run

### Method 1: Using npx tsx (Recommended)

```bash
# From project root
npx tsx app/scripts/migrate-legacy-config.ts
```

### Method 2: Using ts-node

```bash
# Install ts-node if not already installed
npm install -D ts-node

# Run the script
npx ts-node app/scripts/migrate-legacy-config.ts
```

### Method 3: Using npm script (if added to package.json)

```bash
npm run migrate:legacy
```

---

## What to Expect

### Successful Migration Output

```
================================================================================
FWG Ops - Legacy Configuration Migration
Phase 1.2 - Google Sheets → Supabase
================================================================================

[INFO] Step 1: Fetching data from Google Sheets Spec...
[INFO] Fetching ProjectTemplates from Google Sheets...
[INFO] Found 8 template rows
[INFO] Successfully parsed 8 valid templates
[INFO] Fetching TemplateTasks from Google Sheets...
[INFO] Found 64 task rows
[INFO] Successfully parsed 64 valid tasks
[INFO] Step 2: Inserting data into Supabase...
[INFO] Inserting 8 project templates into Supabase...
[INFO] ✓ Inserted template: FULL_WRAP_WORKFLOW (Full Wrap Production)
[INFO] ✓ Inserted template: PPF_WORKFLOW (Paint Protection Film)
...
[INFO] Project templates: 8 succeeded, 0 failed
[INFO] Inserting 64 template tasks into Supabase...
[INFO] ✓ Inserted task: FULL_WRAP_WORKFLOW.VERIFY - Verify Measurements
[INFO] ✓ Inserted task: FULL_WRAP_WORKFLOW.DESIGN - Finalize Artwork/Design
...
[INFO] Template tasks: 64 succeeded, 0 failed

================================================================================
MIGRATION COMPLETE
================================================================================
✓ Project Templates: 8 inserted
✓ Template Tasks: 64 inserted

Next Steps:
1. Verify data in Supabase dashboard
2. Proceed to Phase 1.3: Link categories to templates
================================================================================
```

### If There Are Errors

The script continues even if some rows fail. Example:

```
[WARNING] Skipping template row - missing required fields
  { row: [...] }

[ERROR] Failed to insert template: CUSTOM_WORKFLOW
  { error: "duplicate key value violates unique constraint" }
```

**Common errors:**
- **Missing required fields** - Check your Google Sheets has all columns filled
- **Duplicate key constraint** - Template already exists (this is safe - it will update)
- **Foreign key constraint** - Template references a category that doesn't exist yet

---

## Verification

After migration, verify the data was inserted correctly:

### 1. Check Template Count

```sql
SELECT COUNT(*) as template_count FROM project_templates WHERE active = true;
```

### 2. Check Task Count

```sql
SELECT COUNT(*) as task_count FROM template_tasks WHERE active = true;
```

### 3. View Templates with Task Counts

```sql
SELECT
  pt.template_key,
  pt.label as template_name,
  pt.category_key,
  COUNT(tt.id) as task_count
FROM project_templates pt
LEFT JOIN template_tasks tt ON tt.template_key = pt.template_key
WHERE pt.active = true
GROUP BY pt.template_key, pt.label, pt.category_key
ORDER BY pt.template_key;
```

Expected output (example):
```
template_key         | template_name              | category_key  | task_count
---------------------|----------------------------|---------------|------------
FULL_WRAP_WORKFLOW   | Full Wrap Production       | FULL_WRAP     | 10
PPF_WORKFLOW         | Paint Protection Film      | PPF           | 7
TINT_WORKFLOW        | Window Tint               | TINT          | 6
```

### 4. View All Tasks for a Template

```sql
SELECT
  task_key,
  label,
  default_priority,
  sort_order
FROM template_tasks
WHERE template_key = 'FULL_WRAP_WORKFLOW'
  AND active = true
ORDER BY sort_order;
```

---

## Troubleshooting

### Error: "GOOGLE_SHEETS_CREDENTIALS environment variable not set"

**Fix:**
```bash
# Make sure .env.local exists and contains the credentials
cat .env.local | grep GOOGLE_SHEETS_CREDENTIALS
```

### Error: "The caller does not have permission"

**Fix:** Grant your service account access to the Google Sheet (see Prerequisites #3)

### Error: "relation 'project_templates' does not exist"

**Fix:** Run Phase 1.1 migration first (create the tables)

### Error: "Cannot find module 'googleapis'"

**Fix:**
```bash
npm install googleapis @supabase/supabase-js
```

### Warning: "No templates found!"

**Fix:** Check that:
1. The Spec Sheet ID is correct (`1RvRIcNDsYGvx2to302lzDs3nmFQXHETYNZzMWoyFnhE`)
2. The sheet has a tab named exactly `ProjectTemplates`
3. The tab has data starting from row 2 (row 1 should be headers)
4. Your service account has access to the sheet

---

## Re-running the Migration

The script is **idempotent** - safe to run multiple times.

- Uses `upsert` operation (insert or update)
- Updates existing records based on unique keys
- Useful for syncing changes from Google Sheets

**Example use cases:**
- You added new templates to Google Sheets
- You modified task labels or sort orders
- You want to refresh the data

---

## Next Steps

After successful migration:

1. ✅ Verify data in Supabase (see Verification section)
2. 📋 Proceed to **Phase 1.3**: Link categories to templates
3. 📋 Then move to **Phase 2**: Production task auto-generation

---

## Support

For issues or questions:
- Check the troubleshooting section above
- Review logs for specific error messages
- Refer to `/PRODUCTION_FLOW_IMPLEMENTATION_SPEC.md` for overall architecture
