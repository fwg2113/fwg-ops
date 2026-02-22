/**
 * Customer Action Generator
 *
 * Automatically generates customer-facing action items from templates
 * when documents are created or submissions come in.
 * Mirrors the production taskGenerator.ts pattern.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

export const supabase = createClient(supabaseUrl, supabaseKey)

// ============================================================================
// TYPES
// ============================================================================

type GenerateActionsResult = {
  success: boolean
  actionsCreated: number
  errors: string[]
  templateUsed: string | null
}

type WorkflowStep = {
  step_key: string
  label: string
  description: string | null
  default_priority: string
  sort_order: number
  auto_complete_on_status: string | null
}

// ============================================================================
// MAIN: Generate Customer Actions for a Document
// ============================================================================

/**
 * Generates customer actions for a document based on its category.
 * Looks up the category's customer template and creates action items.
 *
 * @param documentId - The document ID
 * @param category - The category key (e.g., 'FULL_WRAP', 'PPF')
 * @param currentStatus - Optional current document status to auto-complete past steps
 */
export async function generateCustomerActions(
  documentId: string,
  category: string,
  currentStatus?: string
): Promise<GenerateActionsResult> {
  const result: GenerateActionsResult = {
    success: true,
    actionsCreated: 0,
    errors: [],
    templateUsed: null
  }

  try {
    if (!category) {
      result.success = false
      result.errors.push('No category provided')
      return result
    }

    // Check if actions already exist for this document
    const { data: existing } = await supabase
      .from('customer_actions')
      .select('id')
      .eq('document_id', documentId)

    if (existing && existing.length > 0) {
      result.errors.push('Customer actions already exist for this document')
      return result
    }

    // Find the customer template for this category
    const templateKey = await resolveTemplateKey(category)

    if (!templateKey) {
      // Fall back to OTHER_CUSTOMER template
      const fallbackKey = 'OTHER_CUSTOMER'
      const { data: fallbackSteps } = await supabase
        .from('customer_workflow_steps')
        .select('step_key, label, description, default_priority, sort_order, auto_complete_on_status')
        .eq('template_key', fallbackKey)
        .eq('active', true)
        .order('sort_order', { ascending: true })

      if (!fallbackSteps || fallbackSteps.length === 0) {
        result.success = false
        result.errors.push(`No template found for category: ${category} and no fallback available`)
        return result
      }

      result.templateUsed = fallbackKey
      return await insertActions(documentId, null, fallbackKey, fallbackSteps as WorkflowStep[], currentStatus, result)
    }

    result.templateUsed = templateKey

    // Get template steps
    const { data: steps, error: stepsError } = await supabase
      .from('customer_workflow_steps')
      .select('step_key, label, description, default_priority, sort_order, auto_complete_on_status')
      .eq('template_key', templateKey)
      .eq('active', true)
      .order('sort_order', { ascending: true })

    if (stepsError) {
      result.success = false
      result.errors.push(`Failed to fetch template steps: ${stepsError.message}`)
      return result
    }

    if (!steps || steps.length === 0) {
      result.success = false
      result.errors.push(`No active steps in template: ${templateKey}`)
      return result
    }

    return await insertActions(documentId, null, templateKey, steps as WorkflowStep[], currentStatus, result)

  } catch (error: any) {
    result.success = false
    result.errors.push(`Unexpected error: ${error.message}`)
    return result
  }
}

// ============================================================================
// Generate Customer Actions for a Submission (pre-document)
// ============================================================================

/**
 * Generates the initial customer action for a new submission.
 * Creates a REVIEW_AND_CATEGORIZE action linked to the submission.
 */
export async function generateSubmissionAction(
  submissionId: string,
  category?: string
): Promise<GenerateActionsResult> {
  const result: GenerateActionsResult = {
    success: true,
    actionsCreated: 0,
    errors: [],
    templateUsed: null
  }

  try {
    // Check if actions already exist for this submission
    const { data: existing } = await supabase
      .from('customer_actions')
      .select('id')
      .eq('submission_id', submissionId)

    if (existing && existing.length > 0) {
      result.errors.push('Customer actions already exist for this submission')
      return result
    }

    const templateKey = category ? (await resolveTemplateKey(category)) || 'OTHER_CUSTOMER' : 'OTHER_CUSTOMER'
    result.templateUsed = templateKey

    // Create just the first step (review) for the submission
    const { error } = await supabase
      .from('customer_actions')
      .insert({
        submission_id: submissionId,
        template_key: templateKey,
        step_key: 'REVIEW_AND_CATEGORIZE',
        title: 'Review & categorize submission',
        description: 'Review the incoming submission and categorize the project',
        status: 'TODO',
        priority: 'HIGH',
        sort_order: 1,
        auto_complete_on_status: 'draft',
        auto_generated: true
      })

    if (error) {
      result.success = false
      result.errors.push(`Failed to create submission action: ${error.message}`)
      return result
    }

    result.actionsCreated = 1
    return result

  } catch (error: any) {
    result.success = false
    result.errors.push(`Unexpected error: ${error.message}`)
    return result
  }
}

// ============================================================================
// Auto-Complete Actions on Status Change
// ============================================================================

/**
 * Auto-completes any customer actions that have auto_complete_on_status
 * matching the new document status.
 *
 * @param documentId - The document ID
 * @param newStatus - The new document status
 * @returns Number of actions auto-completed
 */
export async function autoCompleteActions(
  documentId: string,
  newStatus: string
): Promise<{ completed: number; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('customer_actions')
      .update({
        status: 'COMPLETED',
        completed_at: new Date().toISOString()
      })
      .eq('document_id', documentId)
      .eq('auto_complete_on_status', newStatus.toLowerCase())
      .eq('status', 'TODO')
      .select()

    if (error) {
      return { completed: 0, error: error.message }
    }

    return { completed: data?.length || 0 }

  } catch (error: any) {
    return { completed: 0, error: error.message }
  }
}

// ============================================================================
// Complete a Single Action
// ============================================================================

/**
 * Manually completes a customer action by ID.
 */
export async function completeAction(
  actionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('customer_actions')
      .update({
        status: 'COMPLETED',
        completed_at: new Date().toISOString()
      })
      .eq('id', actionId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }

  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// ============================================================================
// Link Submission Actions to Document (after conversion)
// ============================================================================

/**
 * When a submission is converted to a document, this links
 * the submission's actions to the new document and generates
 * remaining workflow steps.
 */
export async function linkSubmissionToDocument(
  submissionId: string,
  documentId: string,
  category: string
): Promise<GenerateActionsResult> {
  // Mark submission actions as linked to the document and complete REVIEW_AND_CATEGORIZE
  await supabase
    .from('customer_actions')
    .update({
      document_id: documentId,
      status: 'COMPLETED',
      completed_at: new Date().toISOString()
    })
    .eq('submission_id', submissionId)
    .eq('step_key', 'REVIEW_AND_CATEGORIZE')

  // Generate remaining actions for the document
  return await generateCustomerActions(documentId, category, 'draft')
}

// ============================================================================
// HELPERS
// ============================================================================

async function resolveTemplateKey(category: string): Promise<string | null> {
  // First try direct lookup via categories table
  const { data: cat } = await supabase
    .from('categories')
    .select('customer_template_key')
    .eq('category_key', category)
    .single()

  if (cat?.customer_template_key) {
    return cat.customer_template_key
  }

  // Fallback: try constructing the template key
  const constructedKey = `${category}_CUSTOMER`
  const { data: template } = await supabase
    .from('customer_workflow_templates')
    .select('template_key')
    .eq('template_key', constructedKey)
    .single()

  return template?.template_key || null
}

async function insertActions(
  documentId: string,
  submissionId: string | null,
  templateKey: string,
  steps: WorkflowStep[],
  currentStatus: string | undefined,
  result: GenerateActionsResult
): Promise<GenerateActionsResult> {
  // Determine which statuses have already been passed
  const statusOrder = ['new', 'draft', 'sent', 'viewed', 'approved', 'partial', 'paid']
  const currentIndex = currentStatus ? statusOrder.indexOf(currentStatus.toLowerCase()) : -1

  const actionsToInsert = steps.map((step) => {
    // Auto-complete steps whose trigger status has already been reached
    const stepStatusIndex = step.auto_complete_on_status
      ? statusOrder.indexOf(step.auto_complete_on_status.toLowerCase())
      : -1
    const alreadyCompleted = currentIndex >= 0 && stepStatusIndex >= 0 && stepStatusIndex <= currentIndex

    return {
      document_id: documentId,
      submission_id: submissionId,
      template_key: templateKey,
      step_key: step.step_key,
      title: step.label,
      description: step.description,
      status: alreadyCompleted ? 'COMPLETED' : 'TODO',
      priority: step.default_priority,
      sort_order: step.sort_order,
      auto_complete_on_status: step.auto_complete_on_status,
      auto_generated: true,
      completed_at: alreadyCompleted ? new Date().toISOString() : null
    }
  })

  const { error: insertError } = await supabase
    .from('customer_actions')
    .insert(actionsToInsert)

  if (insertError) {
    result.success = false
    result.errors.push(`Failed to create actions: ${insertError.message}`)
    return result
  }

  result.actionsCreated = actionsToInsert.length
  return result
}
