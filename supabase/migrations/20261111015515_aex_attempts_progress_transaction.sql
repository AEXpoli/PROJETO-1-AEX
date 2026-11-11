-- Incremental: preserve tables, RLS, existing attempts and table privileges.
alter table public.exercises add column category text
  check (category in ('phishing', 'social-engineering'));
alter table public.exercise_attempts add column result jsonb
  check (result is null or jsonb_typeof(result) = 'object');
create index exercise_attempts_participant_exercise_idx
  on public.exercise_attempts(participant_id, exercise_id, answered_at, id);
create index exercise_attempts_assignment_idx
  on public.exercise_attempts(assignment_id, exercise_id) where assignment_id is not null;

-- Freeze available legacy feedback once, preserving the recorded correctness.
with ranked as (
  select a.*, row_number() over (partition by participant_id, exercise_id order by answered_at, id) as n
  from public.exercise_attempts a
)
update public.exercise_attempts a set result = jsonb_build_object(
  'attempt', jsonb_build_object('id', a.id, 'exerciseId', a.exercise_id,
    'selectedOptionId', a.selected_option_id, 'submittedAt', a.answered_at),
  'correct', a.is_correct, 'selectedLabel', o.option_text,
  'correctLabel', coalesce((select c.option_text from public.exercise_options c
    where c.exercise_id = a.exercise_id and c.is_correct), ''),
  'explanation', o.explanation, 'completedAt', a.answered_at, 'evaluation', 'server',
  'assignmentId', a.assignment_id, 'pointsAwarded', case when r.n = 1 then 10 else 0 end
)
from ranked r, public.exercise_options o
where r.id = a.id and o.id = a.selected_option_id;

insert into public.achievements(code, title, description) values
('first', 'Primeiro passo', 'Concluir a primeira atividade.'),
('phishing', 'Olhar atento', 'Concluir uma atividade de phishing.'),
('module', 'Mais preparado', 'Concluir um módulo.')
on conflict (code) do nothing;

create function public.aex_record_attempt(
  p_participant_id uuid, p_attempt_id uuid, p_exercise_id uuid,
  p_selected_option_id uuid, p_assignment_id uuid default null
) returns jsonb
language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_previous public.exercise_attempts%rowtype;
  v_exercise public.exercises%rowtype;
  v_option public.exercise_options%rowtype;
  v_correct_label text;
  v_first boolean;
  v_time timestamptz;
  v_result jsonb;
  v_completed integer;
  v_total integer;
begin
  if p_participant_id is null or p_attempt_id is null or p_exercise_id is null or p_selected_option_id is null then
    raise sqlstate 'PT400' using message = 'Invalid attempt parameters';
  end if;

  -- One transaction at a time per participant, including attempts in different modules.
  -- SELECT FOR UPDATE also handles the first attempt, before progress rows exist.
  perform 1 from public.profiles where id = p_participant_id for update;
  if not found then raise sqlstate 'PT403' using message = 'Profile unavailable'; end if;
  perform 1 from public.organization_members where user_id = p_participant_id for share;
  if not found then raise sqlstate 'PT403' using message = 'Membership required'; end if;

  select * into v_previous from public.exercise_attempts where id = p_attempt_id;
  if found then
    if v_previous.participant_id <> p_participant_id or v_previous.exercise_id <> p_exercise_id
      or v_previous.selected_option_id <> p_selected_option_id
      or v_previous.assignment_id is distinct from p_assignment_id then
      raise sqlstate 'PT409' using message = 'Idempotency conflict';
    end if;
    if p_assignment_id is not null and not exists (
      select 1 from public.campaign_assignments ca join public.organization_members om
        on om.organization_id = ca.organization_id and om.user_id = p_participant_id
      where ca.id = p_assignment_id and ca.participant_id = p_participant_id
    ) then raise sqlstate 'PT403' using message = 'Assignment unavailable'; end if;
    return v_previous.result;
  end if;

  select e.* into v_exercise from public.exercises e
    join public.learning_modules m on m.id = e.module_id
    where e.id = p_exercise_id and e.status = 'published' and m.status = 'published'
    for share of e, m;
  if not found then raise sqlstate 'PT404' using message = 'Exercise unavailable'; end if;
  if v_exercise.category is null then raise sqlstate 'PT409' using message = 'Exercise category required'; end if;

  if p_assignment_id is not null then
    perform 1 from public.campaign_assignments ca
      join public.campaigns c on c.id = ca.campaign_id and c.organization_id = ca.organization_id
      join public.organization_members om on om.organization_id = ca.organization_id and om.user_id = p_participant_id
      where ca.id = p_assignment_id and ca.participant_id = p_participant_id
        and c.module_id = v_exercise.module_id and c.status = 'active'
      for share of ca, c, om;
    if not found then raise sqlstate 'PT403' using message = 'Assignment unavailable'; end if;
  end if;

  -- Lock the options used to evaluate, and refuse an incomplete answer key.
  perform 1 from public.exercise_options where exercise_id = p_exercise_id for share;
  select * into v_option from public.exercise_options
    where id = p_selected_option_id and exercise_id = p_exercise_id;
  if not found then raise sqlstate 'PT400' using message = 'Option does not belong to exercise'; end if;
  select option_text into v_correct_label from public.exercise_options where exercise_id = p_exercise_id and is_correct;
  if not found then raise sqlstate 'PT409' using message = 'Exercise answer key unavailable'; end if;
  select not exists(select 1 from public.exercise_attempts
    where participant_id = p_participant_id and exercise_id = p_exercise_id) into v_first;
  v_time := clock_timestamp();
  v_result := jsonb_build_object(
    'attempt', jsonb_build_object('id', p_attempt_id, 'exerciseId', p_exercise_id,
      'selectedOptionId', p_selected_option_id, 'submittedAt', v_time),
    'correct', v_option.is_correct, 'selectedLabel', v_option.option_text,
    'correctLabel', v_correct_label, 'explanation', v_option.explanation,
    'completedAt', v_time, 'evaluation', 'server', 'assignmentId', p_assignment_id,
    'pointsAwarded', case when v_first then 10 else 0 end
  );
  insert into public.exercise_attempts(id, participant_id, exercise_id, selected_option_id, assignment_id, is_correct, answered_at, result)
    values(p_attempt_id, p_participant_id, p_exercise_id, p_selected_option_id, p_assignment_id, v_option.is_correct, v_time, v_result);

  -- A completed activity retains its points if content is later archived.
  select count(*) filter (where exists(select 1 from public.exercise_attempts a
      where a.participant_id = p_participant_id and a.exercise_id = e.id))::integer,
    count(*)::integer into v_completed, v_total
  from public.exercises e where e.module_id = v_exercise.module_id
    and (e.status = 'published' or exists(select 1 from public.exercise_attempts a
      where a.participant_id = p_participant_id and a.exercise_id = e.id));
  insert into public.learning_progress(participant_id, module_id, completed_exercises, total_exercises, points, completed_at, updated_at)
    values(p_participant_id, v_exercise.module_id, v_completed, v_total, v_completed * 10,
      case when v_completed = v_total then v_time end, v_time)
  on conflict (participant_id, module_id) do update set
    completed_exercises = excluded.completed_exercises, total_exercises = excluded.total_exercises,
    points = excluded.points, updated_at = excluded.updated_at,
    completed_at = case when excluded.completed_exercises = excluded.total_exercises
      then coalesce(public.learning_progress.completed_at, excluded.completed_at) else null end;

  insert into public.user_achievements(participant_id, achievement_id, awarded_at)
    select p_participant_id, a.id, v_time from public.achievements a
    where a.code = 'first'
      or (a.code = 'phishing' and exists(select 1 from public.exercise_attempts ea
        join public.exercises e on e.id = ea.exercise_id where ea.participant_id = p_participant_id and e.category = 'phishing'))
      or (a.code = 'module' and v_completed = v_total and v_total > 0)
    on conflict (participant_id, achievement_id) do nothing;

  -- An assignment completes only from attempts submitted for that assignment.
  if p_assignment_id is not null and not exists (
    select 1 from public.exercises e where e.module_id = v_exercise.module_id and e.status = 'published'
      and not exists(select 1 from public.exercise_attempts a where a.assignment_id = p_assignment_id
        and a.participant_id = p_participant_id and a.exercise_id = e.id)
  ) then
    update public.campaign_assignments set completed_at = coalesce(completed_at, v_time)
      where id = p_assignment_id and participant_id = p_participant_id;
  end if;
  return v_result;
exception when unique_violation then
  raise sqlstate 'PT409' using message = 'Idempotency conflict';
end;
$$;

create function public.aex_learning_read(p_participant_id uuid, p_resource text)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare v_result jsonb;
begin
  if p_participant_id is null or not exists(select 1 from public.organization_members where user_id = p_participant_id) then
    raise sqlstate 'PT403' using message = 'Membership required';
  end if;
  if p_resource = 'attempts' then
    select coalesce(jsonb_agg(result order by answered_at desc, id desc), '[]'::jsonb) into v_result
      from public.exercise_attempts where participant_id = p_participant_id;
  elsif p_resource = 'achievements' then
    select coalesce(jsonb_agg(jsonb_build_object('id', a.code, 'title', a.title,
      'description', a.description, 'unlocked', ua.achievement_id is not null) order by a.code), '[]'::jsonb)
      into v_result from public.achievements a left join public.user_achievements ua
      on ua.achievement_id = a.id and ua.participant_id = p_participant_id
      where a.code in ('first', 'phishing', 'module');
  elsif p_resource = 'progress' then
    with first_attempts as (
      select distinct on (exercise_id) exercise_id, is_correct
      from public.exercise_attempts where participant_id = p_participant_id
      order by exercise_id, answered_at, id
    ), catalog as (
      select e.id, e.module_id, f.is_correct from public.exercises e
      join public.learning_modules m on m.id = e.module_id
      left join first_attempts f on f.exercise_id = e.id
      where (e.status = 'published' and m.status = 'published') or f.exercise_id is not null
    ), per_module as (
      select module_id, count(*)::integer as total, count(is_correct)::integer as completed,
        count(*) filter (where is_correct)::integer as correct,
        count(*) filter (where is_correct = false)::integer as reviewed,
        (count(is_correct) * 10)::integer as points,
        count(*) = count(is_correct) as is_complete
      from catalog group by module_id
    ), statistics as (
      select c.id, count(a.id)::integer as attempts,
        count(a.id) filter (where a.is_correct)::integer as correct,
        count(a.id) filter (where not a.is_correct)::integer as incorrect
      from catalog c left join public.exercise_attempts a
        on a.exercise_id = c.id and a.participant_id = p_participant_id group by c.id
    ) select jsonb_build_object(
      'evaluation', 'server',
      'completions', (select coalesce(jsonb_agg(jsonb_build_object('exerciseId', exercise_id, 'correct', is_correct) order by exercise_id), '[]') from first_attempts),
      'summary', jsonb_build_object(
        'total', coalesce(sum(total),0), 'completed', coalesce(sum(completed),0),
        'correct', coalesce(sum(correct),0), 'reviewed', coalesce(sum(reviewed),0),
        'points', coalesce(sum(points),0), 'isComplete', coalesce(sum(total)>0 and sum(completed)=sum(total), false),
        'exerciseStats', (select coalesce(jsonb_agg(jsonb_build_object('exerciseId', id, 'attempts', attempts, 'correct', correct, 'incorrect', incorrect) order by id), '[]') from statistics)),
      'modules', coalesce(jsonb_agg(jsonb_build_object('moduleId', module_id, 'total', total, 'completed', completed,
        'correct', correct, 'reviewed', reviewed, 'points', points, 'isComplete', is_complete) order by module_id), '[]')
    ) into v_result from per_module;
  else raise sqlstate 'PT400' using message = 'Invalid learning resource';
  end if;
  return v_result;
end;
$$;

-- Invoker functions, never elevated definer functions; only the backend can call them.
revoke all on function public.aex_record_attempt(uuid,uuid,uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.aex_learning_read(uuid,text) from public, anon, authenticated;
grant execute on function public.aex_record_attempt(uuid,uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.aex_learning_read(uuid,text) to service_role;
