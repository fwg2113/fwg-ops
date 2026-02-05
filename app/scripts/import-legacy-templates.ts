/**
 * Legacy System Migration Script
 * Imports all production templates and tasks from legacy Google Sheets
 *
 * Run this with: npx tsx app/scripts/import-legacy-templates.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

function parseCSV(filePath: string): any[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.trim().split('\n')
  const headers = lines[0].split(',')

  return lines.slice(1).map(line => {
    const values = line.split(',')
    const obj: any = {}
    headers.forEach((header, index) => {
      obj[header.trim()] = values[index]?.trim() || null
    })
    return obj
  })
}

async function importTemplatesAndTasks() {
  console.log('🚀 Starting legacy system migration...\n')

  // Read template tasks CSV
  const templateTasksPath = path.join(process.cwd(), 'legacy-sheets', 'FWG_Wraps_Spec - TemplateTasks.csv')
  const templateTasks = parseCSV(templateTasksPath)

  // Group tasks by template_key
  const templateGroups = templateTasks.reduce((acc: any, task: any) => {
    if (!acc[task.template_key]) {
      acc[task.template_key] = []
    }
    acc[task.template_key].push(task)
    return acc
  }, {})

  console.log(`📋 Found ${Object.keys(templateGroups).length} unique workflow templates\n`)

  // Import each template and its tasks
  for (const [templateKey, tasks] of Object.entries(templateGroups) as [string, any[]][]) {
    console.log(`\n⚙️  Processing: ${templateKey}`)
    console.log(`   Tasks: ${tasks.length}`)

    // Create or update template
    const { data: existingTemplate } = await supabase
      .from('project_templates')
      .select('id')
      .eq('template_key', templateKey)
      .single()

    let templateId: string

    if (existingTemplate) {
      console.log(`   ✓ Template already exists`)
      templateId = existingTemplate.id
    } else {
      const { data: newTemplate, error } = await supabase
        .from('project_templates')
        .insert({
          template_key: templateKey,
          category_key: templateKey.replace('_WORKFLOW', ''),
          label: templateKey.replace(/_/g, ' ').replace(' WORKFLOW', ''),
          description: `${templateKey.replace(/_/g, ' ')} production workflow`,
          active: true,
          sort_order: 10
        })
        .select('id')
        .single()

      if (error) {
        console.error(`   ❌ Error creating template:`, error.message)
        continue
      }

      templateId = newTemplate.id
      console.log(`   ✓ Template created`)
    }

    // Import tasks for this template
    let tasksCreated = 0
    let tasksSkipped = 0

    for (const task of tasks) {
      // Check if task already exists
      const { data: existingTask } = await supabase
        .from('template_tasks')
        .select('id')
        .eq('template_key', templateKey)
        .eq('task_key', task.task_key)
        .single()

      if (existingTask) {
        tasksSkipped++
        continue
      }

      // Create task
      const { error } = await supabase
        .from('template_tasks')
        .insert({
          template_key: templateKey,
          task_key: task.task_key,
          label: task.label,
          default_priority: task.default_priority || 'MEDIUM',
          sort_order: parseInt(task.sort_order) || 0,
          active: task.active === 'TRUE'
        })

      if (error) {
        console.error(`   ❌ Error creating task ${task.task_key}:`, error.message)
      } else {
        tasksCreated++
      }
    }

    console.log(`   ✓ Created ${tasksCreated} tasks (${tasksSkipped} already existed)`)
  }

  // Update categories to link to templates
  console.log('\n\n📂 Updating category template links...')

  const categoryTemplateMap: Record<string, string> = {
    'VINYL_GRAPHICS': 'CAST_LET_GRAPH_WORKFLOW', // Default to cast lettering workflow
    'VINYL_WRAP': 'PARTIAL_WRAP_WORKFLOW',
    'PPF': 'PPF_WORKFLOW',
    'EMBROIDERY': 'EMBROIDERY',
    'STICKERS': 'STICKERS',
  }

  for (const [categoryKey, templateKey] of Object.entries(categoryTemplateMap)) {
    const { error } = await supabase
      .from('categories')
      .update({ template_key: templateKey })
      .eq('category_key', categoryKey)

    if (error) {
      console.error(`   ❌ Error updating category ${categoryKey}:`, error.message)
    } else {
      console.log(`   ✓ Linked ${categoryKey} → ${templateKey}`)
    }
  }

  console.log('\n\n✅ Migration complete!\n')
}

importTemplatesAndTasks().catch(console.error)
