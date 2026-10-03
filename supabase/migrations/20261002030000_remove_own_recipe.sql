-- Cooks could already take a recipe off the table (unpublish_recipe) or delete
-- it (delete_my_recipe); the website just never offered either. This adds the
-- admin's delete for junk. Everything hanging off a recipe (ingredients,
-- steps, versions, notes, made-its, saves, reports, patrol reviews) cascades.

create or replace function public.admin_delete_recipe(target uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  removed public.recipes%rowtype;
begin
  delete from public.recipes where id = target returning * into removed;
  if removed.id is null then
    return jsonb_build_object('deleted', false);
  end if;
  return jsonb_build_object('deleted', true, 'imagePath', removed.image_path, 'title', removed.title);
end $$;

revoke all on function public.admin_delete_recipe(uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_recipe(uuid) to service_role;
