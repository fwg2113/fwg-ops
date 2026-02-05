/**
 * Automation Settings Helper
 * Manages automation configuration and state
 */

import { supabase } from './supabase'

export type AutomationKey = 'auto_production_on_payment' | 'notify_customer_on_completion'

export type AutomationSetting = {
  id: string
  automation_key: AutomationKey
  enabled: boolean
  label: string
  description: string
  created_at: string
  updated_at: string
}

/**
 * Get all automation settings
 */
export async function getAutomationSettings(): Promise<AutomationSetting[]> {
  const { data, error } = await supabase
    .from('automation_settings')
    .select('*')
    .order('automation_key')

  if (error) {
    console.error('Error fetching automation settings:', error)
    return []
  }

  return data || []
}

/**
 * Get a single automation setting by key
 */
export async function getAutomationSetting(key: AutomationKey): Promise<AutomationSetting | null> {
  const { data, error } = await supabase
    .from('automation_settings')
    .select('*')
    .eq('automation_key', key)
    .single()

  if (error) {
    console.error(`Error fetching automation setting ${key}:`, error)
    return null
  }

  return data
}

/**
 * Check if an automation is enabled
 */
export async function isAutomationEnabled(key: AutomationKey): Promise<boolean> {
  const setting = await getAutomationSetting(key)
  return setting?.enabled || false
}

/**
 * Update automation setting
 */
export async function updateAutomationSetting(
  key: AutomationKey,
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('automation_settings')
    .update({
      enabled,
      updated_at: new Date().toISOString()
    })
    .eq('automation_key', key)

  if (error) {
    console.error(`Error updating automation setting ${key}:`, error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

/**
 * Initialize automation settings table with default values
 * This is safe to call multiple times (uses UPSERT)
 */
export async function initializeAutomationSettings(): Promise<void> {
  const defaultSettings = [
    {
      automation_key: 'auto_production_on_payment',
      enabled: false,
      label: 'Auto-move to Production on Payment',
      description: 'Automatically move invoice to production and generate tasks when any payment is received (deposit or full payment)'
    },
    {
      automation_key: 'notify_customer_on_completion',
      enabled: false,
      label: 'Customer Notification on Completion',
      description: 'Send SMS/email to customer when all line item tasks are completed'
    }
  ]

  for (const setting of defaultSettings) {
    await supabase
      .from('automation_settings')
      .upsert(setting, {
        onConflict: 'automation_key',
        ignoreDuplicates: false
      })
  }
}
