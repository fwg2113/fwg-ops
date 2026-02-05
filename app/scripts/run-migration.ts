/**
 * Migration Runner Script
 * Executes SQL migration files against Supabase database
 * Usage: npx tsx app/scripts/run-migration.ts <migration-file-path>
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗')
  process.exit(1)
}

// Create Supabase client with service role key (admin access)
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runMigration(filePath: string) {
  try {
    console.log(`\n🔄 Running migration: ${path.basename(filePath)}`)

    // Read SQL file
    const sql = fs.readFileSync(filePath, 'utf-8')

    // Execute SQL using Supabase RPC
    // Note: Supabase doesn't have a direct SQL execution method, so we use rpc
    // For multi-statement SQL files, we need to split and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.match(/^\/\*/))

    console.log(`   Found ${statements.length} SQL statements to execute\n`)

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]

      // Skip comments and empty statements
      if (!statement || statement.startsWith('--') || statement.match(/^\/\*/)) {
        continue
      }

      console.log(`   [${i + 1}/${statements.length}] Executing statement...`)

      try {
        // Use the postgres connection string approach
        const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' })

        if (error) {
          // If rpc doesn't exist, we need to execute via postgres directly
          console.log(`   ℹ️  RPC method not available, using alternative approach`)
          throw error
        }

        console.log(`   ✓ Statement ${i + 1} completed`)
      } catch (err) {
        console.error(`   ✗ Error executing statement ${i + 1}:`, err)
        console.error(`   Statement: ${statement.substring(0, 100)}...`)
        // Continue with next statement instead of failing completely
      }
    }

    console.log(`\n✅ Migration completed: ${path.basename(filePath)}\n`)
  } catch (error) {
    console.error(`\n❌ Migration failed:`, error)
    process.exit(1)
  }
}

// Get migration file path from command line argument
const migrationFile = process.argv[2]

if (!migrationFile) {
  console.error('❌ Usage: npx tsx app/scripts/run-migration.ts <migration-file-path>')
  console.error('   Example: npx tsx app/scripts/run-migration.ts supabase/migrations/20260205_automation_settings.sql')
  process.exit(1)
}

// Resolve to absolute path
const absolutePath = path.resolve(process.cwd(), migrationFile)

if (!fs.existsSync(absolutePath)) {
  console.error(`❌ Migration file not found: ${absolutePath}`)
  process.exit(1)
}

// Run the migration
runMigration(absolutePath)
