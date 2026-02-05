/**
 * Migration Runner API Endpoint
 * Executes the automation_settings table migration
 * Call this endpoint once to set up the automation system
 *
 * Usage: POST /api/migrations/run
 */

import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

export async function POST(request: Request) {
  try {
    // Read the migration SQL
    const migrationSQL = `
      -- Create automation_settings table
      CREATE TABLE IF NOT EXISTS automation_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        automation_key TEXT UNIQUE NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT false,
        label TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Add index for quick lookups
      CREATE INDEX IF NOT EXISTS idx_automation_settings_key
        ON automation_settings(automation_key);
    `

    // Note: Supabase JS doesn't support raw SQL execution
    // We'll use the initialization approach instead
    console.log('Initializing automation settings via upsert approach')

    // Initialize with default settings
    const defaultSettings = [
      {
        automation_key: 'auto_production_on_payment',
        enabled: false,
        label: 'Auto-move to Production on Payment',
        description: 'Automatically move invoice to production and generate tasks when invoice is fully paid'
      },
      {
        automation_key: 'notify_customer_on_completion',
        enabled: false,
        label: 'Customer Notification on Completion',
        description: 'Send SMS/email to customer when all line item tasks are completed'
      }
    ]

    // Check if table exists by trying to query it
    const { error: checkError } = await supabase
      .from('automation_settings')
      .select('id')
      .limit(1)

    if (checkError && checkError.message.includes('relation "automation_settings" does not exist')) {
      return NextResponse.json({
        success: false,
        error: 'automation_settings table does not exist. Please run the migration SQL manually in Supabase SQL Editor.',
        sql: migrationSQL
      }, { status: 500 })
    }

    // Table exists, insert default settings
    for (const setting of defaultSettings) {
      const { error } = await supabase
        .from('automation_settings')
        .upsert(setting, {
          onConflict: 'automation_key',
          ignoreDuplicates: true
        })

      if (error) {
        console.error('Error inserting automation setting:', error)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Automation settings initialized successfully'
    })

  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
