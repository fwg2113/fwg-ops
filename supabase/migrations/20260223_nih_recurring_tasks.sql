-- Add recurring task support to nih_tasks
ALTER TABLE nih_tasks ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;
ALTER TABLE nih_tasks ADD COLUMN IF NOT EXISTS recurring_days TEXT[] DEFAULT '{}';
-- recurring_days stores day abbreviations: 'Mon','Tue','Wed','Thu','Fri','Sat','Sun'
