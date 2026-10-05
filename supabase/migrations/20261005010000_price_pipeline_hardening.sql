-- Price pipeline hardening, from the security review of 2026-10-05.
--
-- 1. A shared daily budget for Kroger API calls, so no caller (or burst of
--    callers across server instances) can spend Savry's whole daily quota.
--    Only the server's service role may draw on it.
-- 2. Recipe costs are worked out on the server from the stored ingredients
--    (/api/recipes/cost and /api/cron/recost); a browser can no longer send
--    a number, so set_my_recipe_cost goes.
-- 3. A list card shows a cost only when at least 95% of the recipe was priced.

create table if not exists public.kroger_call_budget (
  day date not null,
  kind text not null check (kind in ('locations', 'products')),
  used integer not null default 0 check (used >= 0),
  primary key (day, kind)
);
alter table public.kroger_call_budget enable row level security;
revoke all on public.kroger_call_budget from public, anon, authenticated;

-- Takes `calls` from today's budget for `kind` if it fits under `cap`; true when granted.
create or replace function public.take_kroger_budget(kind text, calls integer, cap integer)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  granted boolean;
begin
  if calls is null or calls < 1 or cap is null or cap < 1 then return false; end if;
  insert into public.kroger_call_budget as b (day, kind, used)
  values ((now() at time zone 'utc')::date, take_kroger_budget.kind, calls)
  on conflict (day, kind) do update set used = b.used + excluded.used
    where b.used + excluded.used <= cap
  returning true into granted;
  return coalesce(granted, false) and calls <= cap;
end;
$$;
revoke all on function public.take_kroger_budget(text, integer, integer) from public, anon, authenticated;
grant execute on function public.take_kroger_budget(text, integer, integer) to service_role;

drop function if exists public.set_my_recipe_cost(text, numeric, numeric);

create or replace function public.recipe_card(r public.recipes, viewer uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', r.id, 'slug', r.slug::text, 'title', r.title, 'description', r.description, 'imageUrl', r.image_url,
    'category', r.category, 'cuisine', r.cuisine, 'totalTime', r.prep_time_minutes + r.cook_time_minutes, 'servings', r.servings,
    'dietaryTags', to_jsonb(r.dietary_tags), 'allergens', to_jsonb(r.allergens),
    'calories', (r.nutrition_per_serving ->> 'calories')::integer,
    'nutritionSource', r.nutrition_source, 'nutritionCoverage', r.nutrition_coverage,
    'costPerServing', case when r.cost_coverage >= 0.95 then r.cost_per_serving end,
    'madeCount', r.made_count, 'saveCount', r.save_count, 'publishedAt', r.published_at, 'visibility', r.visibility,
    'editorsPick', (r.editors_pick_at is not null),
    'authorName', p.display_name, 'authorUsername', p.username::text,
    'mine', (viewer is not null and r.author_id = viewer),
    'saved', (viewer is not null and exists (select 1 from public.recipe_saves s where s.user_id = viewer and s.recipe_id = r.id))
  )
  from public.profiles p where p.id = r.author_id
$$;
