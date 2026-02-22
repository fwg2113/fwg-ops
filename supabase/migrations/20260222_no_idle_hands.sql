-- No Idle Hands tables (prefixed with nih_)

-- Team members
CREATE TABLE nih_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  avatar_color TEXT NOT NULL DEFAULT '#6b7280',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Categories
CREATE TABLE nih_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  sort_order INT DEFAULT 0
);

-- Locations
CREATE TABLE nih_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0
);

-- Tasks
CREATE TABLE nih_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES nih_categories(id),
  location_id UUID REFERENCES nih_locations(id),
  urgency TEXT CHECK (urgency IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  time_estimate TEXT,
  status TEXT CHECK (status IN ('open', 'in_progress', 'completed')) DEFAULT 'open',
  is_project BOOLEAN DEFAULT false,
  parent_id UUID REFERENCES nih_tasks(id) ON DELETE CASCADE,
  sort_order INT DEFAULT 0,
  point_of_contact TEXT,
  completion_notes TEXT,
  completion_photo_url TEXT,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES nih_team_members(id),
  created_by UUID REFERENCES nih_team_members(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Task assignees (many-to-many)
CREATE TABLE nih_task_assignees (
  task_id UUID REFERENCES nih_tasks(id) ON DELETE CASCADE,
  team_member_id UUID REFERENCES nih_team_members(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, team_member_id)
);

-- Indexes
CREATE INDEX idx_nih_tasks_status ON nih_tasks(status);
CREATE INDEX idx_nih_tasks_parent_id ON nih_tasks(parent_id);
CREATE INDEX idx_nih_tasks_category_id ON nih_tasks(category_id);
CREATE INDEX idx_nih_tasks_urgency ON nih_tasks(urgency);

-- Seed: team members
INSERT INTO nih_team_members (name, role, avatar_color) VALUES
  ('Joe', 'admin', '#d71cd1'),
  ('Danny', 'member', '#3b82f6'),
  ('Bronson', 'member', '#22c55e'),
  ('Mikey', 'member', '#f59e0b'),
  ('Mason', 'member', '#ec4899'),
  ('Diogo', 'member', '#a855f7'),
  ('Jay', 'member', '#06b6d4');

-- Seed: categories
INSERT INTO nih_categories (name, color, sort_order) VALUES
  ('Shop Maintenance', '#f59e0b', 0),
  ('Inventory', '#3b82f6', 1),
  ('Vehicles', '#6b7280', 2),
  ('Admin', '#8b5cf6', 3),
  ('Marketing', '#ec4899', 4),
  ('Equipment', '#14b8a6', 5),
  ('Facility', '#22c55e', 6),
  ('Other', '#94a3b8', 7);

-- Seed: locations
INSERT INTO nih_locations (name, sort_order) VALUES
  ('Unit A', 0),
  ('Unit B', 1),
  ('Unit D - Lobby', 2),
  ('Unit D - Bay', 3),
  ('Loft', 4),
  ('Offsite', 5);
