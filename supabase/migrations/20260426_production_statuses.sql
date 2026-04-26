-- ============================================================================
-- Production Statuses System
-- ----------------------------------------------------------------------------
-- Adds per-column configurable status pills to the production tracker.
-- Each stage column (QUEUE, DESIGN, PRINT, PRODUCTION) has its own list of
-- statuses. Cards display a colored pill; clicking it opens a dropdown to
-- change status. Some statuses can require a note. Some trigger special
-- actions (waste-report modal on "Needs reprint", auto-collapse on "In
-- Installation").
--
-- Replaces the old production_stuck / production_stuck_reason flag. Old
-- columns are kept in the schema (don't drop) but the UI no longer uses them.
-- A migration step below copies any existing stuck flags into the new system.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. production_statuses table
-- ---------------------------------------------------------------------------
create table if not exists public.production_statuses (
  id uuid primary key default gen_random_uuid(),
  stage_key text not null,                       -- 'QUEUE','DESIGN','PRINT','PRODUCTION'
  label text not null,
  color text not null default '#64748b',         -- hex color for the pill
  sort_order int not null default 0,             -- order within the column dropdown
  requires_note boolean not null default false,  -- prompts for note on select
  is_default_on_entry boolean not null default false, -- auto-applied when card enters this column
  special_action text,                           -- null | 'WASTE_REPORT' | 'COLLAPSE_INSTALL'
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_production_statuses_stage
  on public.production_statuses(stage_key, sort_order)
  where active = true;

-- One default-on-entry per stage_key (enforce via partial unique index)
create unique index if not exists uq_production_statuses_default_per_stage
  on public.production_statuses(stage_key)
  where is_default_on_entry = true and active = true;

-- ---------------------------------------------------------------------------
-- 2. Add status reference + note to documents
-- ---------------------------------------------------------------------------
alter table public.documents
  add column if not exists production_status_id uuid references public.production_statuses(id) on delete set null,
  add column if not exists production_status_note text;

-- ---------------------------------------------------------------------------
-- 3. Seed default statuses (only if the table is empty)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from public.production_statuses limit 1) then

    -- QUEUE column
    insert into public.production_statuses (stage_key, label, color, sort_order, requires_note, is_default_on_entry) values
      ('QUEUE', 'Ready to start',         '#22c55e', 0, false, true),
      ('QUEUE', 'Waiting on payment',     '#ef4444', 1, true,  false),
      ('QUEUE', 'Waiting on approval',    '#ef4444', 2, true,  false),
      ('QUEUE', 'Waiting on something',   '#f59e0b', 3, true,  false);

    -- DESIGN column
    insert into public.production_statuses (stage_key, label, color, sort_order, requires_note, is_default_on_entry) values
      ('DESIGN', 'Ready to design',       '#3b82f6', 0, false, true),
      ('DESIGN', 'In design',             '#f59e0b', 1, false, false),
      ('DESIGN', 'Revisions requested',   '#fb923c', 2, false, false),
      ('DESIGN', 'Waiting on customer',   '#94a3b8', 3, false, false),
      ('DESIGN', 'Need print files',      '#f59e0b', 4, false, false),
      ('DESIGN', 'Print files ready',     '#22c55e', 5, false, false),
      ('DESIGN', 'Stuck',                 '#ef4444', 6, true,  false);

    -- PRINT column
    insert into public.production_statuses (stage_key, label, color, sort_order, requires_note, is_default_on_entry, special_action) values
      ('PRINT', 'Ready to print',         '#3b82f6', 0, false, true,  null),
      ('PRINT', 'Printing',               '#f59e0b', 1, false, false, null),
      ('PRINT', 'Printed',                '#22c55e', 2, false, false, null),
      ('PRINT', 'Needs reprint',          '#ef4444', 3, true,  false, 'WASTE_REPORT'),
      ('PRINT', 'Stuck',                  '#ef4444', 4, true,  false, null);

    -- PRODUCTION column
    insert into public.production_statuses (stage_key, label, color, sort_order, requires_note, is_default_on_entry, special_action) values
      ('PRODUCTION', 'Ready',             '#3b82f6', 0, false, true,  null),
      ('PRODUCTION', 'Laminating',        '#f59e0b', 1, false, false, null),
      ('PRODUCTION', 'Cutting',           '#f59e0b', 2, false, false, null),
      ('PRODUCTION', 'Weeding',           '#f59e0b', 3, false, false, null),
      ('PRODUCTION', 'Masked',            '#f59e0b', 4, false, false, null),
      ('PRODUCTION', 'Ready for install', '#22c55e', 5, false, false, null),
      ('PRODUCTION', 'In Installation',   '#a855f7', 6, false, false, 'COLLAPSE_INSTALL'),
      ('PRODUCTION', 'Stuck',             '#ef4444', 7, true,  false, null);

  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Migrate any docs in QC stage to PRODUCTION (QC column is being removed)
-- ---------------------------------------------------------------------------
update public.documents
set production_stage = 'PRODUCTION'
where production_stage = 'QC';

-- ---------------------------------------------------------------------------
-- 5. Migrate existing production_stuck flags to the new status system
--    Any doc with production_stuck=true gets its current column's "Stuck"
--    status (or "Waiting on something" for QUEUE) and copies the reason.
-- ---------------------------------------------------------------------------
update public.documents d
set
  production_status_id = ps.id,
  production_status_note = d.production_stuck_reason
from public.production_statuses ps
where d.production_stuck = true
  and d.production_status_id is null
  and ps.stage_key = coalesce(d.production_stage, 'QUEUE')
  and (
    (ps.stage_key = 'QUEUE' and ps.label = 'Waiting on something')
    or (ps.stage_key in ('DESIGN','PRINT','PRODUCTION') and ps.label = 'Stuck')
  )
  and ps.active = true;

-- ---------------------------------------------------------------------------
-- 6. updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.tg_production_statuses_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tg_production_statuses_updated_at on public.production_statuses;
create trigger tg_production_statuses_updated_at
  before update on public.production_statuses
  for each row execute function public.tg_production_statuses_updated_at();
