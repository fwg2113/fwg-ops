-- Add instructions field to template_tasks and customer_workflow_steps
-- Allows storing specific instructions for each task/step in the template

ALTER TABLE template_tasks
ADD COLUMN IF NOT EXISTS instructions TEXT DEFAULT NULL;

ALTER TABLE customer_workflow_steps
ADD COLUMN IF NOT EXISTS instructions TEXT DEFAULT NULL;
