-- Completion history log for No Idle Hands
-- Records every task completion permanently, even when recurring tasks reset

CREATE TABLE nih_task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES nih_tasks(id) ON DELETE SET NULL,
  task_title TEXT NOT NULL,
  completion_notes TEXT,
  completion_photo_url TEXT,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_by_names TEXT,
  points_awarded INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_nih_task_completions_task_id ON nih_task_completions(task_id);
CREATE INDEX idx_nih_task_completions_completed_at ON nih_task_completions(completed_at DESC);
CREATE INDEX idx_nih_task_completions_photo ON nih_task_completions(completion_photo_url) WHERE completion_photo_url IS NOT NULL;
