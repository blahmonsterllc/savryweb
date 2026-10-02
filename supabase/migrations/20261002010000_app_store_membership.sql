-- Links a Savry+ purchase made in the iOS app to the member's Savry account,
-- so the website knows who is a paying member (no ads, member features).
--
-- The server verifies Apple's signature on the transaction first
-- (lib/app-store-jws.mjs) and passes only the verified facts here:
--   { originalTransactionId, productId, purchasedAt, expiresAt, revoked, appAccountToken }
-- Writing a membership row fires membership_sync_profile, which sets
-- profiles.tier. Nothing in this file is callable by members.

create or replace function public.record_app_store_membership(target_user uuid, purchase jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  subscription_id text := purchase->>'originalTransactionId';
  product_id text := purchase->>'productId';
  period_start timestamptz := (purchase->>'purchasedAt')::timestamptz;
  period_end timestamptz := (purchase->>'expiresAt')::timestamptz;
  revoked boolean := coalesce((purchase->>'revoked')::boolean, false);
  owner_id uuid;
  held public.memberships%rowtype;
  held_is_live boolean;
  next_status public.membership_status;
begin
  if target_user is null or subscription_id is null or subscription_id = '' or product_id is null or period_end is null then
    raise exception 'The purchase is incomplete' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = target_user) then
    raise exception 'No such member' using errcode = '22023';
  end if;

  -- One purchase belongs to one Savry account. Whoever linked it first keeps it.
  select user_id into owner_id from public.memberships
  where provider = 'app_store' and provider_subscription_id = subscription_id;
  if owner_id is not null and owner_id <> target_user then
    return jsonb_build_object('linked', false, 'reason', 'linked_to_another_account');
  end if;

  next_status := case when revoked or period_end <= now() then 'expired' else 'active' end;

  select * into held from public.memberships where user_id = target_user for update;
  if found then
    held_is_live := held.status in ('trialing', 'active')
      and (held.current_period_end is null or held.current_period_end > now());

    if held.provider_subscription_id = subscription_id then
      -- An older transaction for the same subscription never shortens the
      -- period; only a refund or revocation ends it early.
      if not revoked and held.current_period_end is not null and held.current_period_end >= period_end then
        return jsonb_build_object('linked', true, 'status', held.status, 'currentPeriodEnd', held.current_period_end, 'member', held_is_live);
      end if;
    elsif held_is_live and (next_status <> 'active' or (held.current_period_end is not null and held.current_period_end >= period_end)) then
      -- A different membership that is still live stays unless this one runs longer.
      return jsonb_build_object('linked', true, 'status', held.status, 'currentPeriodEnd', held.current_period_end, 'member', true);
    end if;

    update public.memberships
    set provider = 'app_store',
        provider_subscription_id = subscription_id,
        provider_product_id = product_id,
        provider_customer_id = coalesce(purchase->>'appAccountToken', provider_customer_id),
        status = next_status,
        current_period_start = period_start,
        current_period_end = period_end,
        cancel_at_period_end = false
    where user_id = target_user;
  else
    insert into public.memberships
      (user_id, provider, provider_subscription_id, provider_product_id, provider_customer_id, status, current_period_start, current_period_end)
    values
      (target_user, 'app_store', subscription_id, product_id, purchase->>'appAccountToken', next_status, period_start, period_end);
  end if;

  return jsonb_build_object('linked', true, 'status', next_status, 'currentPeriodEnd', period_end, 'member', next_status = 'active');
exception
  -- Two devices linking the same purchase at once: the other one won.
  when unique_violation then
    return jsonb_build_object('linked', false, 'reason', 'linked_to_another_account');
end; $$;

-- Renewals, refunds, and expirations reported by Apple's servers. The member
-- is found by the purchase already linked to them, or, for a purchase the app
-- has not reported yet, by the account id the app attached when it was bought.
create or replace function public.apply_app_store_notification(purchase jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid;
  token text := purchase->>'appAccountToken';
begin
  select user_id into owner_id from public.memberships
  where provider = 'app_store' and provider_subscription_id = purchase->>'originalTransactionId';

  if owner_id is null and token ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select id into owner_id from public.profiles where id = token::uuid;
  end if;
  if owner_id is null then
    return jsonb_build_object('linked', false, 'reason', 'no_linked_account');
  end if;
  return public.record_app_store_membership(owner_id, purchase);
end; $$;

-- Memberships whose paid period ended without a renewal. A day's grace covers
-- the gap between Apple renewing and Savry hearing about it.
create or replace function public.expire_lapsed_memberships()
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  ended integer;
begin
  update public.memberships
  set status = 'expired'
  where status in ('trialing', 'active')
    and current_period_end is not null
    and current_period_end < now() - interval '1 day';
  get diagnostics ended = row_count;
  return ended;
end; $$;

revoke all on function public.record_app_store_membership(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.apply_app_store_notification(jsonb) from public, anon, authenticated;
revoke all on function public.expire_lapsed_memberships() from public, anon, authenticated;
grant execute on function public.record_app_store_membership(uuid, jsonb) to service_role;
grant execute on function public.apply_app_store_notification(jsonb) to service_role;
grant execute on function public.expire_lapsed_memberships() to service_role;
