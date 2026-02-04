# Phase 1.2 Quick Start Guide

## Data Migration: Google Sheets → Supabase

This guide walks you through migrating your production workflow configuration from Google Sheets to Supabase.

---

## ⚡ Quick Steps

### 1. Install Dependencies (2 minutes)

```bash
npm install
```

This installs `tsx` (TypeScript executor) needed to run the migration script.

---

### 2. Verify Environment Variables (3 minutes)

Make sure your `.env.local` file has:

```env
# Google Sheets Service Account (single line JSON string)
GOOGLE_SHEETS_CREDENTIALS='{"type":"service_account","project_id":"your-project","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"your-service-account@your-project.iam.gserviceaccount.com"}'

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Don't have `GOOGLE_SHEETS_CREDENTIALS` yet?**
- See section "Setting Up Google Sheets Access" below
- Or skip to Phase 1.3 and come back (you can use existing Google Sheets directly for now)

---

### 3. Run the Migration (1 minute)

```bash
npm run migrate:legacy
```

---

### 4. Verify Success (2 minutes)

You should see output like:

```
✓ Project Templates: 8 inserted
✓ Template Tasks: 64 inserted
```

Then verify in Supabase SQL Editor:

```sql
SELECT COUNT(*) FROM project_templates;
SELECT COUNT(*) FROM template_tasks;
```

---

## 🔑 Setting Up Google Sheets Access (First Time Only)

If you don't have `GOOGLE_SHEETS_CREDENTIALS` set up yet:

### Option A: Quick Setup (5 minutes)

1. **Go to Google Cloud Console:** https://console.cloud.google.com
2. **Create/Select Project:** Click project dropdown → "New Project"
3. **Enable Sheets API:**
   - Search "Google Sheets API"
   - Click "Enable"
4. **Create Service Account:**
   - Navigation menu → "IAM & Admin" → "Service Accounts"
   - Click "Create Service Account"
   - Name: `fwg-ops-sheets-reader`
   - Role: None needed (read-only)
   - Click "Done"
5. **Create Key:**
   - Click on the service account you just created
   - Keys tab → "Add Key" → "Create New Key"
   - Type: JSON
   - Click "Create" (downloads a JSON file)
6. **Copy JSON to .env.local:**
   - Open the downloaded JSON file
   - Copy the entire contents (must be single line)
   - Paste into `.env.local` as `GOOGLE_SHEETS_CREDENTIALS='...'`
7. **Grant Sheet Access:**
   - Open your Spec Sheet: https://docs.google.com/spreadsheets/d/1RvRIcNDsYGvx2to302lzDs3nmFQXHETYNZzMWoyFnhE
   - Click "Share"
   - Add the service account email (from JSON: `client_email`)
   - Grant "Viewer" permission
   - Click "Send"

### Option B: Ask Your Team

If someone else has already set this up, ask them for:
- The `GOOGLE_SHEETS_CREDENTIALS` JSON string
- Copy it to your `.env.local`

---

## 📊 What Gets Migrated

The script fetches from your Google Sheets Spec and creates records in Supabase:

| Google Sheet Tab | → | Supabase Table |
|------------------|---|----------------|
| ProjectTemplates | → | `project_templates` |
| TemplateTasks | → | `template_tasks` |

**Example:** If you have a "FULL_WRAP_WORKFLOW" template with 10 tasks in Google Sheets, you'll get:
- 1 record in `project_templates` (the workflow)
- 10 records in `template_tasks` (the steps: Verify, Design, Print, etc.)

---

## 🔍 Troubleshooting

### "GOOGLE_SHEETS_CREDENTIALS environment variable not set"
- Check your `.env.local` file exists
- Make sure the entire JSON is on one line
- Restart your terminal/IDE after adding env vars

### "The caller does not have permission"
- Grant your service account "Viewer" access to the Spec Sheet (see step 7 above)

### "relation 'project_templates' does not exist"
- Run Phase 1.1 migration first (create the database tables)

### "No templates found!"
- Verify the Spec Sheet ID is correct
- Make sure the `ProjectTemplates` tab exists and has data
- Check that row 1 is headers and data starts at row 2

---

## ✅ Success Criteria

After running the migration, you should be able to:

1. **See templates in Supabase:**
   ```sql
   SELECT * FROM project_templates ORDER BY sort_order;
   ```

2. **See tasks for each template:**
   ```sql
   SELECT pt.label as template, tt.label as task, tt.sort_order
   FROM template_tasks tt
   JOIN project_templates pt ON pt.template_key = tt.template_key
   ORDER BY pt.label, tt.sort_order;
   ```

3. **Count matches Google Sheets:**
   - Number of templates in Supabase = Number of rows in ProjectTemplates sheet
   - Number of tasks in Supabase = Number of rows in TemplateTasks sheet

---

## 🎯 Next Steps

Once migration succeeds:

1. ✅ Mark Phase 1.2 as complete
2. 📋 Proceed to **Phase 1.3**: Link categories to templates
   - This connects each job category (PPF, TINT, etc.) to its production template
3. 📋 Then move to **Phase 2**: Production task auto-generation
   - This is where the magic happens - tasks auto-create when invoices are paid!

---

## 💡 Pro Tips

- **Re-running is safe:** The script uses `upsert` - it updates existing records instead of creating duplicates
- **Test with one template:** Temporarily delete all but one row in your Google Sheets to test
- **Dry run:** Review the script code to see exactly what it does before running
- **Logs are your friend:** The script outputs detailed logs for debugging

---

## 📚 More Documentation

- **Detailed instructions:** `app/scripts/README.md`
- **Script source code:** `app/scripts/migrate-legacy-config.ts`
- **Type definitions:** `app/lib/types/production.ts`
- **Overall architecture:** `PRODUCTION_FLOW_IMPLEMENTATION_SPEC.md`

---

**Ready?** Run: `npm run migrate:legacy` 🚀
