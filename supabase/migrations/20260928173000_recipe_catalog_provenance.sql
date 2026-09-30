-- Provenance and editorial quality controls for Savry's launch recipe catalog.
-- Public recipes must remain attributable; private permission records and
-- internal review notes are accessible only through trusted server tooling.

create type public.recipe_origin as enum (
  'savry_original',
  'community',
  'public_domain',
  'licensed_creator',
  'user_import'
);

create type public.recipe_review_status as enum (
  'draft',
  'needs_review',
  'editorially_reviewed',
  'kitchen_tested',
  'rejected'
);

create table public.recipe_provenance (
  recipe_id uuid primary key references public.recipes(id) on delete cascade,
  origin public.recipe_origin not null,
  source_name text check (char_length(source_name) <= 200),
  source_url text,
  license_name text check (char_length(license_name) <= 120),
  license_url text,
  attribution_text text check (char_length(attribution_text) <= 600),
  original_author text check (char_length(original_author) <= 160),
  accessed_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    origin in ('savry_original', 'community', 'user_import')
    or (source_name is not null and attribution_text is not null)
  )
);

create table public.recipe_rights_records (
  recipe_id uuid primary key references public.recipes(id) on delete cascade,
  permission_basis text not null check (
    permission_basis in ('owned', 'public_domain', 'licensed', 'user_grant')
  ),
  permission_record_path text,
  photo_rights_confirmed boolean not null default false,
  text_rights_confirmed boolean not null default false,
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recipe_editorial_reviews (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  reviewer_id uuid references public.profiles(id) on delete set null,
  status public.recipe_review_status not null default 'needs_review',
  measurements_checked boolean not null default false,
  instructions_checked boolean not null default false,
  allergen_flags_checked boolean not null default false,
  nutrition_provenance_checked boolean not null default false,
  food_safety_checked boolean not null default false,
  attribution_checked boolean not null default false,
  kitchen_tested_at timestamptz,
  notes text check (char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recipe_provenance_origin_idx on public.recipe_provenance (origin);
create index recipe_reviews_queue_idx on public.recipe_editorial_reviews (status, created_at);
create index recipe_reviews_recipe_idx on public.recipe_editorial_reviews (recipe_id, created_at desc);

create trigger recipe_provenance_touch before update on public.recipe_provenance
for each row execute function public.touch_updated_at();
create trigger recipe_rights_touch before update on public.recipe_rights_records
for each row execute function public.touch_updated_at();
create trigger recipe_editorial_reviews_touch before update on public.recipe_editorial_reviews
for each row execute function public.touch_updated_at();

alter table public.recipe_provenance enable row level security;
alter table public.recipe_rights_records enable row level security;
alter table public.recipe_editorial_reviews enable row level security;

create policy "public recipe provenance" on public.recipe_provenance
for select to anon, authenticated using (
  exists (
    select 1 from public.recipes r
    where r.id = recipe_id
      and (r.visibility = 'public' or r.author_id = (select auth.uid()))
  )
);

grant select on public.recipe_provenance to anon, authenticated;
revoke insert, update, delete on public.recipe_provenance from anon, authenticated;
revoke all on public.recipe_rights_records, public.recipe_editorial_reviews from anon, authenticated;

comment on table public.recipe_provenance is
  'Public-facing source, author, license, and attribution metadata for each recipe.';
comment on table public.recipe_rights_records is
  'Private evidence that Savry may publish recipe text and media; server access only.';
comment on table public.recipe_editorial_reviews is
  'Internal measurement, safety, nutrition, attribution, and kitchen-test review history.';
