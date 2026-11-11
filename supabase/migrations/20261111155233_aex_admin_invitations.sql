-- Administrative invitations are backend-only. Existing tables and grants remain intact.
create table public.admin_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  issued_by uuid not null references public.profiles(id),
  email text not null check (email = lower(trim(email)) and char_length(email) between 3 and 254),
  display_name text not null check (char_length(trim(display_name)) between 1 and 120),
  target_user_id uuid references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','sent','failed','accepted')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  accepted_at timestamptz,
  check (expires_at > created_at),
  check ((status = 'accepted') = (accepted_at is not null))
);
create index admin_invitations_org_email_idx on public.admin_invitations(organization_id,email,created_at desc);
create index admin_invitations_issuer_idx on public.admin_invitations(issued_by);
create index admin_invitations_target_idx on public.admin_invitations(target_user_id);
alter table public.admin_invitations enable row level security;
revoke all on public.admin_invitations from public, anon, authenticated, service_role;

-- Restricted definer functions also read auth.users to bind an invitation to the
-- confirmed Auth identity. Only the API's service_role can execute these functions.
create function public.aex_create_admin_invitation(p_issuer uuid, p_organization uuid, p_email text, p_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_inv public.admin_invitations; v_email text := lower(trim(p_email));
begin
  perform 1 from public.organization_members where organization_id = p_organization and user_id = p_issuer and role = 'admin' for share;
  if not found then raise exception using errcode = '42501', message = 'Admin membership required'; end if;
  if p_name is null or char_length(trim(p_name)) not between 1 and 120 or v_email is null or char_length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using errcode = '22023', message = 'Invalid invitation';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_organization::text || ':' || v_email, 0));
  if exists (select 1 from public.admin_invitations where organization_id = p_organization and email = v_email and created_at > now() - interval '1 minute') then
    raise exception using errcode = 'PT429', message = 'Wait before inviting again';
  end if;
  -- This onboarding flow never promotes an existing confirmed account.
  if exists (select 1 from auth.users where lower(email) = v_email and email_confirmed_at is not null) then
    raise exception using errcode = '23505', message = 'Account already exists';
  end if;
  update public.admin_invitations set status = 'failed' where organization_id = p_organization and email = v_email and status in ('pending','sent');
  insert into public.admin_invitations(organization_id,issued_by,email,display_name)
    values(p_organization,p_issuer,v_email,trim(p_name)) returning * into v_inv;
  return jsonb_build_object('id',v_inv.id,'expires_at',v_inv.expires_at);
end $$;

create function public.aex_admin_invitation_delivery(p_issuer uuid, p_invitation uuid, p_target uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_inv public.admin_invitations;
begin
  select * into v_inv from public.admin_invitations where id = p_invitation and issued_by = p_issuer for update;
  if not found or v_inv.status <> 'pending' then raise exception using errcode = '22023', message = 'Invalid invitation'; end if;
  if p_target is null then
    update public.admin_invitations set status = 'failed' where id = p_invitation;
    return;
  end if;
  perform 1 from public.organization_members where organization_id = v_inv.organization_id and user_id = p_issuer and role = 'admin' for share;
  if not found then raise exception using errcode = '42501', message = 'Admin membership required'; end if;
  if not exists (select 1 from auth.users where id = p_target and lower(email) = v_inv.email and invited_at is not null) then
    raise exception using errcode = '42501', message = 'Invitation identity mismatch';
  end if;
  update public.admin_invitations set status = 'sent', target_user_id = p_target where id = p_invitation;
end $$;

create function public.aex_accept_admin_invitation(p_user uuid, p_invitation uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_inv public.admin_invitations; v_role text;
begin
  select * into v_inv from public.admin_invitations where id = p_invitation for update;
  if not found or v_inv.status <> 'sent' or v_inv.expires_at <= now() then
    raise exception using errcode = '22023', message = 'Invitation invalid, expired or used';
  end if;
  if v_inv.target_user_id is distinct from p_user then raise exception using errcode = '42501', message = 'Invitation identity mismatch'; end if;
  perform 1 from auth.users where id = p_user and lower(email) = v_inv.email and email_confirmed_at is not null for update;
  if not found then raise exception using errcode = '42501', message = 'Confirmed invitation identity required'; end if;
  perform 1 from public.organization_members where organization_id = v_inv.organization_id and user_id = v_inv.issued_by and role = 'admin' for share;
  if not found then raise exception using errcode = '42501', message = 'Issuer no longer authorized'; end if;
  insert into public.profiles(id,display_name) values(p_user,v_inv.display_name) on conflict(id) do nothing;
  insert into public.organization_members(organization_id,user_id,role)
    values(v_inv.organization_id,p_user,'admin') on conflict(organization_id,user_id) do nothing;
  select role into v_role from public.organization_members where organization_id = v_inv.organization_id and user_id = p_user for update;
  if v_role <> 'admin' then raise exception using errcode = '42501', message = 'Existing role cannot be promoted'; end if;
  update public.admin_invitations set status = 'accepted', accepted_at = now() where id = p_invitation;
  return jsonb_build_object('organization_id',v_inv.organization_id,'status','accepted');
end $$;

revoke all on function public.aex_create_admin_invitation(uuid,uuid,text,text) from public, anon, authenticated;
revoke all on function public.aex_admin_invitation_delivery(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.aex_accept_admin_invitation(uuid,uuid) from public, anon, authenticated;
grant execute on function public.aex_create_admin_invitation(uuid,uuid,text,text) to service_role;
grant execute on function public.aex_admin_invitation_delivery(uuid,uuid,uuid) to service_role;
grant execute on function public.aex_accept_admin_invitation(uuid,uuid) to service_role;
