/**
 * ============================================================================
 * FWG Ops - Legacy Configuration Migration Script
 * Phase 1.2 - Data Migration
 * ============================================================================
 *
 * Migrates production workflow configuration from Google Sheets to Supabase:
 * - ProjectTemplates → project_templates table
 * - TemplateTasks → template_tasks table
 *
 * Usage:
 *   npx tsx app/scripts/migrate-legacy-config.ts
 *
 * Prerequisites:
 *   - Phase 1.1 migration must be run (tables must exist)
 *   - GOOGLE_SHEETS_CREDENTIALS env variable must be set
 *   - NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set
 *
 * ============================================================================
 */

import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'
import type {
  LegacyProjectTemplate,
  LegacyTemplateTask,
  ProjectTemplateInsert,
  TemplateTaskInsert,
  MigrationLog
} from '../lib/types/production'

// ============================================================================
// CONFIGURATION
// ============================================================================

const SPEC_SHEET_ID = '1RvRIcNDsYGvx2to302lzDs3nmFQXHETYNZzMWoyFnhE'

// Sheet ranges
const RANGES = {
  projectTemplates: 'ProjectTemplates!A2:Z', // From row 2 to end
  templateTasks: 'TemplateTasks!A2:Z'         // From row 2 to end
}

// Column indices for ProjectTemplates sheet
const TEMPLATE_COLS = {
  template_key: 0,
  category_key: 1,
  label: 2,
  description: 3,
  active: 4,
  sort_order: 5
}

// Column indices for TemplateTasks sheet
const TASK_COLS = {
  template_key: 0,
  task_key: 1,
  label: 2,
  default_priority: 3,
  sort_order: 4,
  active: 5
}

// ============================================================================
// LOGGING
// ============================================================================

const logs: MigrationLog[] = []

function log(level: 'info' | 'warning' | 'error', message: string, data?: any) {
  const logEntry: MigrationLog = {
    timestamp: new Date().toISOString(),
    level,
    message,
    data
  }
  logs.push(logEntry)

  // Console output with colors
  const colors = {
    info: '\x1b[36m',    // Cyan
    warning: '\x1b[33m', // Yellow
    error: '\x1b[31m'    // Red
  }
  const reset = '\x1b[0m'

  console.log(`${colors[level]}[${level.toUpperCase()}]${reset} ${message}`)
  if (data) {
    console.log('  ', JSON.stringify(data, null, 2))
  }
}

// ============================================================================
// GOOGLE SHEETS CLIENT
// ============================================================================

function getGoogleSheetsClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS || '{}')

  if (!credentials || !credentials.client_email) {
    throw new Error('GOOGLE_SHEETS_CREDENTIALS environment variable not set or invalid')
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  })

  return google.sheets({ version: 'v4', auth })
}

// ============================================================================
// SUPABASE CLIENT
// ============================================================================

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase environment variables not set')
  }

  return createClient(supabaseUrl, supabaseKey)
}

// ============================================================================
// DATA TRANSFORMATION HELPERS
// ============================================================================

function parseBoolean(value: any): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim()
    return lower === 'true' || lower === 'yes' || lower === '1'
  }
  return true // Default to true if missing
}

function parseNumber(value: any, defaultValue: number = 0): number {
  if (typeof value === 'number') return value
  const parsed = parseInt(String(value), 10)
  return isNaN(parsed) ? defaultValue : parsed
}

function transformProjectTemplate(row: any[]): ProjectTemplateInsert | null {
  const template_key = row[TEMPLATE_COLS.template_key]?.trim()
  const category_key = row[TEMPLATE_COLS.category_key]?.trim()
  const label = row[TEMPLATE_COLS.label]?.trim()

  // Skip if missing required fields
  if (!template_key || !category_key || !label) {
    log('warning', 'Skipping template row - missing required fields', { row })
    return null
  }

  return {
    template_key,
    category_key,
    label,
    description: row[TEMPLATE_COLS.description]?.trim() || null,
    active: parseBoolean(row[TEMPLATE_COLS.active]),
    sort_order: parseNumber(row[TEMPLATE_COLS.sort_order], 10)
  }
}

function transformTemplateTask(row: any[]): TemplateTaskInsert | null {
  const template_key = row[TASK_COLS.template_key]?.trim()
  const task_key = row[TASK_COLS.task_key]?.trim()
  const label = row[TASK_COLS.label]?.trim()
  const sort_order = parseNumber(row[TASK_COLS.sort_order])

  // Skip if missing required fields
  if (!template_key || !task_key || !label) {
    log('warning', 'Skipping task row - missing required fields', { row })
    return null
  }

  return {
    template_key,
    task_key,
    label,
    default_priority: row[TASK_COLS.default_priority]?.trim() || 'MEDIUM',
    sort_order,
    active: parseBoolean(row[TASK_COLS.active])
  }
}

// ============================================================================
// FETCH DATA FROM GOOGLE SHEETS
// ============================================================================

async function fetchProjectTemplates(): Promise<ProjectTemplateInsert[]> {
  log('info', 'Fetching ProjectTemplates from Google Sheets...')

  const sheets = getGoogleSheetsClient()

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPEC_SHEET_ID,
      range: RANGES.projectTemplates
    })

    const rows = response.data.values || []
    log('info', `Found ${rows.length} template rows`)

    const templates = rows
      .map(transformProjectTemplate)
      .filter((t): t is ProjectTemplateInsert => t !== null)

    log('info', `Successfully parsed ${templates.length} valid templates`)
    return templates

  } catch (error: any) {
    log('error', 'Failed to fetch ProjectTemplates', { error: error.message })
    throw error
  }
}

async function fetchTemplateTasks(): Promise<TemplateTaskInsert[]> {
  log('info', 'Fetching TemplateTasks from Google Sheets...')

  const sheets = getGoogleSheetsClient()

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPEC_SHEET_ID,
      range: RANGES.templateTasks
    })

    const rows = response.data.values || []
    log('info', `Found ${rows.length} task rows`)

    const tasks = rows
      .map(transformTemplateTask)
      .filter((t): t is TemplateTaskInsert => t !== null)

    log('info', `Successfully parsed ${tasks.length} valid tasks`)
    return tasks

  } catch (error: any) {
    log('error', 'Failed to fetch TemplateTasks', { error: error.message })
    throw error
  }
}

// ============================================================================
// INSERT DATA INTO SUPABASE
// ============================================================================

async function insertProjectTemplates(templates: ProjectTemplateInsert[]) {
  log('info', `Inserting ${templates.length} project templates into Supabase...`)

  const supabase = getSupabaseClient()
  let successCount = 0
  let errorCount = 0

  for (const template of templates) {
    try {
      const { error } = await supabase
        .from('project_templates')
        .upsert(template, {
          onConflict: 'template_key',
          ignoreDuplicates: false
        })

      if (error) {
        log('error', `Failed to insert template: ${template.template_key}`, { error: error.message })
        errorCount++
      } else {
        log('info', `✓ Inserted template: ${template.template_key} (${template.label})`)
        successCount++
      }
    } catch (error: any) {
      log('error', `Exception inserting template: ${template.template_key}`, { error: error.message })
      errorCount++
    }
  }

  log('info', `Project templates: ${successCount} succeeded, ${errorCount} failed`)
  return { successCount, errorCount }
}

async function insertTemplateTasks(tasks: TemplateTaskInsert[]) {
  log('info', `Inserting ${tasks.length} template tasks into Supabase...`)

  const supabase = getSupabaseClient()
  let successCount = 0
  let errorCount = 0

  for (const task of tasks) {
    try {
      const { error } = await supabase
        .from('template_tasks')
        .upsert(task, {
          onConflict: 'template_key,task_key',
          ignoreDuplicates: false
        })

      if (error) {
        log('error', `Failed to insert task: ${task.template_key}.${task.task_key}`, { error: error.message })
        errorCount++
      } else {
        log('info', `✓ Inserted task: ${task.template_key}.${task.task_key} - ${task.label}`)
        successCount++
      }
    } catch (error: any) {
      log('error', `Exception inserting task: ${task.template_key}.${task.task_key}`, { error: error.message })
      errorCount++
    }
  }

  log('info', `Template tasks: ${successCount} succeeded, ${errorCount} failed`)
  return { successCount, errorCount }
}

// ============================================================================
// MAIN MIGRATION FUNCTION
// ============================================================================

async function migrate() {
  console.log('\n' + '='.repeat(80))
  console.log('FWG Ops - Legacy Configuration Migration')
  console.log('Phase 1.2 - Google Sheets → Supabase')
  console.log('='.repeat(80) + '\n')

  try {
    // Step 1: Fetch data from Google Sheets
    log('info', 'Step 1: Fetching data from Google Sheets Spec...')
    const templates = await fetchProjectTemplates()
    const tasks = await fetchTemplateTasks()

    if (templates.length === 0) {
      log('warning', 'No templates found! Check your Google Sheets.')
      return
    }

    // Step 2: Insert into Supabase
    log('info', 'Step 2: Inserting data into Supabase...')
    const templateResult = await insertProjectTemplates(templates)
    const taskResult = await insertTemplateTasks(tasks)

    // Step 3: Summary
    console.log('\n' + '='.repeat(80))
    console.log('MIGRATION COMPLETE')
    console.log('='.repeat(80))
    console.log(`✓ Project Templates: ${templateResult.successCount} inserted`)
    console.log(`✓ Template Tasks: ${taskResult.successCount} inserted`)

    if (templateResult.errorCount > 0 || taskResult.errorCount > 0) {
      console.log(`\n⚠ Errors encountered:`)
      console.log(`  - Templates: ${templateResult.errorCount} failed`)
      console.log(`  - Tasks: ${taskResult.errorCount} failed`)
      console.log('\nCheck logs above for details.')
    }

    console.log('\nNext Steps:')
    console.log('1. Verify data in Supabase dashboard')
    console.log('2. Proceed to Phase 1.3: Link categories to templates')
    console.log('='.repeat(80) + '\n')

  } catch (error: any) {
    console.error('\n❌ MIGRATION FAILED')
    console.error(error.message)
    console.error('\nCheck the logs above for details.')
    process.exit(1)
  }
}

// ============================================================================
// RUN MIGRATION
// ============================================================================

if (require.main === module) {
  migrate().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

export { migrate }
