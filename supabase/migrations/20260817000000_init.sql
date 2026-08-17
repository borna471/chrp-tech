-- The insurer-side mirror of the homeowner app's browser storage.
--
-- The app keeps writing to localStorage and IndexedDB; these tables receive a
-- copy of every write so a separate dashboard codebase can oversee assessments,
-- photo statuses and reviewer findings. Nothing here is read back by the app.
--
-- Primary keys are `text` and carry the client's own ids rather than generated
-- uuids. That is what makes every mirror write an idempotent upsert: a reload,
-- a retry or a double-fire lands on the same row instead of duplicating it.

create table if not exists assessments (
  id                      text primary key,
  policy_ref              text        not null,
  home_address            text        not null,
  homeowner_first_name    text        not null,
  status                  text        not null,
  onboarding_completed_at timestamptz,
  -- Distinct from updated_at, which moves on every task change. This is the one
  -- the dashboard sorts its review queue by.
  submitted_at            timestamptz,
  created_at              timestamptz not null,
  updated_at              timestamptz not null,
  mirrored_at             timestamptz not null default now()
);

create table if not exists photo_tasks (
  id              text primary key,
  assessment_id   text not null references assessments (id) on delete cascade,
  slug            text not null,
  name            text not null,
  zone            text not null,
  risk            text not null,
  instruction     text not null,
  tips            text[] not null default '{}',
  -- Quoted throughout: `order` is a reserved word in Postgres.
  "order"         int  not null,
  status          text not null,
  follow_up_prompt text,
  mirrored_at     timestamptz not null default now()
);

create index if not exists photo_tasks_assessment_order_idx
  on photo_tasks (assessment_id, "order");

create table if not exists photo_captures (
  id            text primary key,
  task_id       text not null references photo_tasks (id) on delete cascade,
  assessment_id text not null references assessments (id) on delete cascade,
  -- Denormalised so the dashboard can group attempts by task without a join,
  -- and so the analyses route can resolve prompt content from the capture alone.
  task_slug     text not null,
  mime_type     text not null,
  captured_at   timestamptz not null,
  is_follow_up  boolean not null default false,
  -- Object path in the `captures` bucket. Null when the upload has not landed.
  storage_path  text,
  mirrored_at   timestamptz not null default now()
);

create index if not exists photo_captures_task_time_idx
  on photo_captures (task_id, captured_at);

create table if not exists photo_analyses (
  id              text primary key,
  capture_id      text not null unique references photo_captures (id) on delete cascade,
  assessment_id   text not null references assessments (id) on delete cascade,
  action          text not null,
  message         text not null,
  reason          text,

  -- `quality` is flattened rather than stored as jsonb: these four are filtered
  -- and charted, unlike `elements`.
  blur            real    not null,
  framing         text    not null,
  exposure        text    not null,
  subject_present boolean not null,

  -- [{ id, description, visible, confidence }]. `description` is resolved from
  -- content/photo-tasks.json when the row is written, so the dashboard renders
  -- "The base of the tank and the floor beneath it" rather than `tank-base`.
  elements        jsonb   not null default '[]',

  needs_human_review boolean not null default false,
  model           text not null,
  elapsed_ms      int  not null,
  analyzed_at     timestamptz not null,
  mirrored_at     timestamptz not null default now()
);

create index if not exists photo_analyses_review_idx
  on photo_analyses (assessment_id, needs_human_review);

-- Its own table rather than jsonb on the analysis: "every urgent finding across
-- every assessment" is the dashboard's primary query, and that wants an index.
create table if not exists photo_findings (
  analysis_id text not null references photo_analyses (id) on delete cascade,
  check_id    text not null,
  present     boolean not null,
  confidence  real    not null,
  note        text    not null,
  severity    text    not null,
  -- Denormalised from content/photo-tasks.json so the dashboard can say what
  -- the reviewer was asked without importing anything from the capture app.
  look_for    text    not null default '',
  primary key (analysis_id, check_id)
);

create index if not exists photo_findings_severity_idx
  on photo_findings (severity, present);

-- Status columns are deliberately `text` rather than enums: every new value
-- would otherwise be a migration, and TypeScript already constrains them at the
-- only place that writes.

-- RLS on with no policies at all: the service-role key used by the mirror routes
-- bypasses RLS, and nothing else can reach these tables.
alter table assessments    enable row level security;
alter table photo_tasks    enable row level security;
alter table photo_captures enable row level security;
alter table photo_analyses enable row level security;
alter table photo_findings enable row level security;

-- Private bucket for the photos. Same reasoning: no policies, so only the
-- service role can write, and the dashboard hands out signed URLs to read.
insert into storage.buckets (id, name, public)
values ('captures', 'captures', false)
on conflict (id) do nothing;
