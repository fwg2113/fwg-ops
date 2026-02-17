/**
 * Production Task Generator
 * Phase 2.1 - Core Logic Library
 *
 * Automatically generates production tasks from templates when invoices
 * are moved to production or paid.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

// ============================================================================
// TYPES
// ============================================================================

type GenerateTasksResult = {
  success: boolean
  lineItemsProcessed: number
  totalTasksCreated: number
  errors: string[]
  details: {
    lineItemId: string
    category: string
    template: string
    tasksCreated: number
  }[]
}

type LineItem = {
  id: string
  category: string
  description: string | null
}

type ProjectTemplate = {
  template_key: string
  label: string
}

type TemplateTask = {
  task_key: string
  label: string
  instructions: string | null
  default_priority: string
  sort_order: number
}

// ============================================================================
// MAIN FUNCTION: Generate Production Tasks
// ============================================================================

/**
 * Generates production tasks for all line items in an invoice
 *
 * @param invoiceId - The invoice document ID
 * @returns Result object with success status and details
 */
export async function generateProductionTasks(invoiceId: string): Promise<GenerateTasksResult> {
  const result: GenerateTasksResult = {
    success: true,
    lineItemsProcessed: 0,
    totalTasksCreated: 0,
    errors: [],
    details: []
  }

  try {
    // Step 1: Get all line items for this invoice
    const { data: lineItems, error: lineItemsError } = await supabase
      .from('line_items')
      .select('id, category, description')
      .eq('document_id', invoiceId)

    if (lineItemsError) {
      result.success = false
      result.errors.push(`Failed to fetch line items: ${lineItemsError.message}`)
      return result
    }

    if (!lineItems || lineItems.length === 0) {
      result.errors.push('No line items found for this invoice')
      return result
    }

    // Step 2: Process each line item
    for (const lineItem of lineItems as LineItem[]) {
      const lineItemResult = await generateTasksForLineItem(invoiceId, lineItem)

      result.lineItemsProcessed++
      result.totalTasksCreated += lineItemResult.tasksCreated

      if (lineItemResult.success) {
        result.details.push({
          lineItemId: lineItem.id,
          category: lineItem.category,
          template: lineItemResult.template || 'N/A',
          tasksCreated: lineItemResult.tasksCreated
        })
      } else {
        result.errors.push(...lineItemResult.errors)
      }
    }

    // Mark as failure if any errors occurred
    if (result.errors.length > 0) {
      result.success = false
    }

    return result

  } catch (error: any) {
    result.success = false
    result.errors.push(`Unexpected error: ${error.message}`)
    return result
  }
}

// ============================================================================
// HELPER: Generate Tasks for Single Line Item
// ============================================================================

async function generateTasksForLineItem(
  invoiceId: string,
  lineItem: LineItem
): Promise<{ success: boolean; tasksCreated: number; template: string | null; errors: string[] }> {
  const result = {
    success: true,
    tasksCreated: 0,
    template: null as string | null,
    errors: [] as string[]
  }

  try {
    // Step 1: Check if line item has a category
    if (!lineItem.category) {
      result.success = false
      result.errors.push(`Line item ${lineItem.id} has no category`)
      return result
    }

    // Step 2: Find template for this category
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('template_key')
      .eq('category_key', lineItem.category)
      .single()

    if (categoryError || !category || !category.template_key) {
      result.success = false
      result.errors.push(`No template found for category: ${lineItem.category}`)
      return result
    }

    const templateKey = category.template_key
    result.template = templateKey

    // Step 3: Get template tasks
    const { data: templateTasks, error: tasksError } = await supabase
      .from('template_tasks')
      .select('task_key, label, instructions, default_priority, sort_order')
      .eq('template_key', templateKey)
      .eq('active', true)
      .order('sort_order', { ascending: true })

    if (tasksError) {
      result.success = false
      result.errors.push(`Failed to fetch template tasks: ${tasksError.message}`)
      return result
    }

    if (!templateTasks || templateTasks.length === 0) {
      result.success = false
      result.errors.push(`No tasks found in template: ${templateKey}`)
      return result
    }

    // Step 4: Check if tasks already exist for this line item
    const { data: existingTasks } = await supabase
      .from('tasks')
      .select('id')
      .eq('line_item_id', lineItem.id)
      .eq('auto_generated', true)

    if (existingTasks && existingTasks.length > 0) {
      result.success = false
      result.errors.push(`Tasks already exist for line item ${lineItem.id}. Delete them first to regenerate.`)
      return result
    }

    // Step 5: Create tasks
    const tasksToInsert = (templateTasks as TemplateTask[]).map((templateTask) => ({
      title: templateTask.label,
      description: `${lineItem.description || 'Line item'} - ${templateTask.label}`,
      status: 'TODO',
      priority: templateTask.default_priority,
      document_id: invoiceId,
      line_item_id: lineItem.id,
      auto_generated: true,
      sort_order: templateTask.sort_order,
      template_task_key: templateTask.task_key,
      notes: templateTask.instructions || null
    }))

    const { error: insertError } = await supabase
      .from('tasks')
      .insert(tasksToInsert)

    if (insertError) {
      result.success = false
      result.errors.push(`Failed to create tasks: ${insertError.message}`)
      return result
    }

    result.tasksCreated = tasksToInsert.length
    return result

  } catch (error: any) {
    result.success = false
    result.errors.push(`Unexpected error: ${error.message}`)
    return result
  }
}

// ============================================================================
// UTILITY: Delete Auto-Generated Tasks for Line Item
// ============================================================================

/**
 * Deletes all auto-generated tasks for a specific line item
 * Useful for regenerating tasks or cleanup
 */
export async function deleteAutoGeneratedTasks(lineItemId: string): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .delete()
      .eq('line_item_id', lineItemId)
      .eq('auto_generated', true)
      .select()

    if (error) {
      return { success: false, deletedCount: 0, error: error.message }
    }

    return { success: true, deletedCount: data?.length || 0 }

  } catch (error: any) {
    return { success: false, deletedCount: 0, error: error.message }
  }
}

// ============================================================================
// UTILITY: Regenerate Tasks for Line Item
// ============================================================================

/**
 * Deletes existing auto-generated tasks and creates fresh ones
 */
export async function regenerateTasksForLineItem(invoiceId: string, lineItemId: string): Promise<GenerateTasksResult> {
  // Delete existing tasks
  await deleteAutoGeneratedTasks(lineItemId)

  // Get the line item
  const { data: lineItem, error } = await supabase
    .from('line_items')
    .select('id, category, description')
    .eq('id', lineItemId)
    .single()

  if (error || !lineItem) {
    return {
      success: false,
      lineItemsProcessed: 0,
      totalTasksCreated: 0,
      errors: ['Line item not found'],
      details: []
    }
  }

  // Generate fresh tasks
  const lineItemResult = await generateTasksForLineItem(invoiceId, lineItem as LineItem)

  return {
    success: lineItemResult.success,
    lineItemsProcessed: 1,
    totalTasksCreated: lineItemResult.tasksCreated,
    errors: lineItemResult.errors,
    details: lineItemResult.success ? [{
      lineItemId: lineItem.id,
      category: lineItem.category,
      template: lineItemResult.template || 'N/A',
      tasksCreated: lineItemResult.tasksCreated
    }] : []
  }
}
