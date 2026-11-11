
create table public.organizations (
 id uuid primary key default gen_random_uuid(),
 name text not null check (char_length(trim(name)) between 2 and 160),
 created_at timestamptz not null default now()
);
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check (char_length(trim(display_name)) between 1 and 120),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.organization_members (
 organization_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 role text not null default 'participant' check(role in ('participant','admin')),
 created_at timestamptz not null default now(),
 primary key (organization_id,user_id)
);
create index organization_members_user_idx on public.organization_members(user_id);
create table public.learning_modules (
 id uuid primary key default gen_random_uuid(),
 title text not null check (char_length(trim(title)) between 2 and 180),
 description text not null default '',
 sort_order integer not null default 0 check (sort_order >= 0),
 status text not null default 'draft' check(status in ('draft','published','archived')),
 created_at timestamptz not null default now()
);
create table public.exercises (
 id uuid primary key default gen_random_uuid(),
 module_id uuid not null references public.learning_modules(id) on delete restrict,
 title text not null check(char_length(trim(title)) between 2 and 180),
 scenario text not null,
 question text not null,
 sort_order integer not null default 0 check(sort_order >= 0),
 status text not null default 'draft' check(status in ('draft','published','archived')),
 created_at timestamptz not null default now(),
 unique(id,module_id)
);
create index exercises_module_idx on public.exercises(module_id,sort_order);
create table public.exercise_options (
 id uuid primary key default gen_random_uuid(),
 exercise_id uuid not null references public.exercises(id) on delete cascade,
 option_text text not null,
 is_correct boolean not null default false,
 explanation text not null default '',
 sort_order integer not null default 0 check(sort_order >= 0),
 unique(exercise_id,id)
);
create index exercise_options_exercise_idx on public.exercise_options(exercise_id,sort_order);
create unique index exercise_options_one_correct_idx on public.exercise_options(exercise_id) where is_correct;
create table public.campaigns (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 module_id uuid not null references public.learning_modules(id) on delete restrict,
 title text not null check(char_length(trim(title)) between 2 and 180),
 status text not null default 'draft' check(status in ('draft','active','closed')),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 unique(id,organization_id),
 foreign key (organization_id,created_by) references public.organization_members(organization_id,user_id)
);
create index campaigns_organization_idx on public.campaigns(organization_id,status);
create table public.campaign_assignments (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null,
 organization_id uuid not null,
 participant_id uuid not null,
 assigned_at timestamptz not null default now(),
 completed_at timestamptz,
 unique(campaign_id,participant_id),
 unique(id,participant_id),
 foreign key(campaign_id,organization_id) references public.campaigns(id,organization_id) on delete cascade,
 foreign key(organization_id,participant_id) references public.organization_members(organization_id,user_id)
);
create index campaign_assignments_participant_idx on public.campaign_assignments(participant_id);
create table public.exercise_attempts (
 id uuid primary key default gen_random_uuid(),
 participant_id uuid not null references public.profiles(id) on delete cascade,
 exercise_id uuid not null references public.exercises(id) on delete restrict,
 selected_option_id uuid not null,
 assignment_id uuid,
 is_correct boolean not null,
 answered_at timestamptz not null default now(),
 foreign key(exercise_id,selected_option_id) references public.exercise_options(exercise_id,id),
 foreign key(assignment_id,participant_id) references public.campaign_assignments(id,participant_id)
);
create index exercise_attempts_participant_idx on public.exercise_attempts(participant_id,answered_at desc);
create index exercise_attempts_exercise_idx on public.exercise_attempts(exercise_id);
create table public.learning_progress (
 participant_id uuid not null references public.profiles(id) on delete cascade,
 module_id uuid not null references public.learning_modules(id) on delete restrict,
 completed_exercises integer not null default 0 check(completed_exercises >= 0),
 total_exercises integer not null default 0 check(total_exercises >= 0),
 points integer not null default 0 check(points >= 0),
 completed_at timestamptz,
 updated_at timestamptz not null default now(),
 primary key(participant_id,module_id),
 check(completed_exercises <= total_exercises)
);
create table public.achievements (
 id uuid primary key default gen_random_uuid(),
 code text not null unique check(code ~ '^[a-z0-9_]+$'),
 title text not null,
 description text not null default '',
 created_at timestamptz not null default now()
);
create table public.user_achievements (
 participant_id uuid not null references public.profiles(id) on delete cascade,
 achievement_id uuid not null references public.achievements(id) on delete restrict,
 awarded_at timestamptz not null default now(),
 primary key(participant_id,achievement_id)
);
do $$
declare t text;
begin
 foreach t in array array['organizations','profiles','organization_members','learning_modules','exercises','exercise_options','campaigns','campaign_assignments','exercise_attempts','learning_progress','achievements','user_achievements']
 loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on table public.%I from anon, authenticated, public',t);
  execute format('grant select, insert, update, delete on table public.%I to service_role',t);
 end loop;
end $$;
