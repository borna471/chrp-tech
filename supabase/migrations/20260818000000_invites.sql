-- Invites: what turns a single hardcoded demo assessment into one per homeowner.
--
-- The admin creates an assessment and hands out a link carrying `invite_token`.
-- The token is deliberately separate from the assessment id: the id appears in
-- storage paths and in every mirror payload, so it is not a secret and must not
-- be the thing that grants access.

alter table assessments
  add column if not exists invite_token    text unique,
  -- Collected when the assessment is created. Nothing sends to it yet — the
  -- link is delivered by copying it.
  add column if not exists homeowner_email text,
  add column if not exists invited_at      timestamptz,
  -- First time the link was followed, so the admin list can tell an invite that
  -- was sent from one that was actually opened.
  add column if not exists opened_at       timestamptz;

create index if not exists assessments_invite_token_idx
  on assessments (invite_token);
