-- Private staging queue for externally sourced launch-catalog candidates.
-- Nothing in this table is visible to the public recipe APIs. A candidate
-- must be normalized and pass every editorial check before promotion.

create table public.recipe_catalog_batches (
  id uuid primary key default gen_random_uuid(),
  catalog_hash text not null unique check (catalog_hash ~ '^sha256:[a-f0-9]{64}$'),
  source_name text not null,
  source_license_name text not null,
  source_license_url text not null,
  candidate_count integer not null check (candidate_count > 0),
  manifest jsonb not null,
  imported_by uuid references public.profiles(id) on delete set null,
  imported_at timestamptz not null default now()
);

create table public.recipe_catalog_candidates (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.recipe_catalog_batches(id) on delete restrict,
  external_id text not null unique,
  source_content_hash text not null unique check (source_content_hash ~ '^sha256:[a-f0-9]{64}$'),
  title text not null check (char_length(title) between 1 and 200),
  planned_collection text not null check (char_length(planned_collection) between 1 and 80),
  source_url text not null,
  source_revision_id bigint,
  license_name text not null,
  license_url text not null,
  attribution_text text not null check (char_length(attribution_text) between 1 and 600),
  source_payload jsonb not null,
  normalized_recipe jsonb,
  status public.recipe_review_status not null default 'needs_review',
  text_rights_confirmed boolean not null default false,
  measurements_checked boolean not null default false,
  instructions_checked boolean not null default false,
  allergen_flags_checked boolean not null default false,
  nutrition_provenance_checked boolean not null default false,
  food_safety_checked boolean not null default false,
  attribution_checked boolean not null default false,
  kitchen_tested_at timestamptz,
  reviewer_id uuid references public.profiles(id) on delete set null,
  review_notes text check (char_length(review_notes) <= 4000),
  promoted_recipe_id uuid unique references public.recipes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    status not in ('editorially_reviewed', 'kitchen_tested')
    or (
      normalized_recipe is not null
      and text_rights_confirmed
      and measurements_checked
      and instructions_checked
      and allergen_flags_checked
      and nutrition_provenance_checked
      and food_safety_checked
      and attribution_checked
      and reviewer_id is not null
    )
  ),
  check (status <> 'kitchen_tested' or kitchen_tested_at is not null),
  check (promoted_recipe_id is null or status in ('editorially_reviewed', 'kitchen_tested'))
);

create index recipe_catalog_candidates_queue_idx
  on public.recipe_catalog_candidates (status, planned_collection, created_at);
create index recipe_catalog_candidates_batch_idx
  on public.recipe_catalog_candidates (batch_id);
create index recipe_catalog_candidates_title_trgm_idx
  on public.recipe_catalog_candidates using gin (title gin_trgm_ops);

create trigger recipe_catalog_candidates_touch before update on public.recipe_catalog_candidates
for each row execute function public.touch_updated_at();

alter table public.recipe_catalog_batches enable row level security;
alter table public.recipe_catalog_candidates enable row level security;

-- These tables are intentionally service-role only. Review access should go
-- through a future admin API that verifies Savry staff privileges.
revoke all on public.recipe_catalog_batches from anon, authenticated;
revoke all on public.recipe_catalog_candidates from anon, authenticated;

comment on table public.recipe_catalog_batches is
  'Immutable manifests for licensed launch-catalog ingestion batches.';
comment on table public.recipe_catalog_candidates is
  'Private sourced recipe drafts; no candidate becomes public without full editorial approval.';

