# Savry community database

Savry has one community backend: **Supabase** (Postgres, Auth, Storage) in the
`savry` project. Firebase is retired; nothing on the site or in the app talks
to it. A cook's private recipe library, meal plan, grocery list, and on-device
AI stay in the app's Core Data/iCloud store unless the cook publishes.

## How clients talk to it

- **Reads** use RLS-constrained selects (`recipes`, `recipe_ingredients`,
  `recipe_steps`, `recipe_versions`, `contributions`) and the `get_*` functions.
- **Every write goes through a SECURITY DEFINER function.** Clients hold no
  insert/update/delete grants on recipes, ingredients, steps, contributions, or
  reports. Profiles allow updating only `display_name`, `bio`, `avatar_path`,
  `username`, `email_opt_in` on your own row.
- Functions check account standing first (`assert_can_write`): not banned and
  email confirmed. Then they screen text (`screen_text`), count daily
  allowances (`take_daily_allowance` in `daily_usage`), and validate structure.

## Functions clients call

| Function | Who | What |
| --- | --- | --- |
| `publish_recipe_v2(payload)` | member | Publish or republish. Screens text, validates nutrition, snapshots the previous version, bumps `version`. Images must live in the cook's own storage folder. |
| `get_recipe_community(target_slug)` | anyone | Tweaks, Made Its, comments, photos, and `viewer` for a recipe. Hides content from cooks the viewer blocked. |
| `get_recipe_discussion(target_slug)` | anyone | Threaded discussion for the web page. |
| `post_recipe_discussion(payload)` | member | Comment, reply, or text suggestion. |
| `record_made_it(payload)` | member | Counts a Made It only with proof: app `cooking_mode`/`mark_made`, or a web photo. One per cook per recipe per day. |
| `suggest_recipe_tweak(payload)` | member | Structured changes (`ingredient.replace`, `step.edit`, …). Validated against the live recipe, can't gut it, food-safety flags attached. One pending per cook per recipe. |
| `decide_recipe_tweak(payload)` | author | Accept (applies the changes, snapshots a version) or decline. |
| `report_content(payload)` | member | One report per person per target. Auto-hides after 3 reports (2 if `unsafe`); recipes after 5. Opens a `moderation_queue` item. |
| `block_user` / `unblock_user` | member | Per-viewer hiding. |
| `unpublish_recipe` / `delete_my_recipe` | author | Author control. |
| `accept_terms` | member | Records agreement to community terms. |
| `delete_my_account` | member | Deletes the auth user; cascades remove profile, recipes, contributions, photos. |
| `admin_moderation_queue` / `admin_moderate` / `admin_set_ban` | service role only | Used by `/api/admin/moderation`. |

## Tables

`profiles`, `recipes` (+ `recipe_ingredients`, `recipe_steps`, `recipe_versions`),
`contributions` (Made Its, comments, tweaks; `hidden`, `report_count`,
`safety_flags`, `changes`), `contribution_likes`, `reports`, `moderation_queue`,
`user_blocks`, `recipe_saves`, `profile_follows`, `memberships`, `daily_usage`,
`app_settings`.

## Trust model

- Ownership always comes from `auth.uid()` inside functions, never from JSON.
- Only the original author can accept a tweak or restore a version; every
  accepted tweak and republish keeps the prior state in `recipe_versions`.
- Moderation hides (`contributions.hidden`, `recipes.review_hold` +
  `visibility = 'unlisted'`) rather than deletes; admins restore or remove.
- Sponsors and ads are presentation only and never affect ranking or content.
