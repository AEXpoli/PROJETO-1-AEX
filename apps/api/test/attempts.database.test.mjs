import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';

const U1 = '10000000-0000-4000-8000-000000000001';
const U2 = '10000000-0000-4000-8000-000000000002';
const U3 = '10000000-0000-4000-8000-000000000003';
const ORG1 = '20000000-0000-4000-8000-000000000001';
const ORG2 = '20000000-0000-4000-8000-000000000002';
const MODULE = 'a5400000-0000-4000-8000-000000000001';
const E = [101, 102, 103].map((n) => `a5400000-0000-4000-8000-000000000${n}`);
const O = [201, 202, 203, 204, 205, 206, 207, 208, 209].map(
  (n) => `a5400000-0000-4000-8000-000000000${n}`,
);
const ID = (n) => `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ASSIGN1 = '40000000-0000-4000-8000-000000000001';
const ASSIGN2 = '40000000-0000-4000-8000-000000000002';
let db;
async function record({
  user = U1,
  id = ID(1),
  exercise = E[0],
  option = O[1],
  assignment = null,
} = {}) {
  return (
    await db.query('select public.aex_record_attempt($1,$2,$3,$4,$5) as result', [
      user,
      id,
      exercise,
      option,
      assignment,
    ])
  ).rows[0].result;
}
async function snapshot(resource, user = U1) {
  return (await db.query('select public.aex_learning_read($1,$2) as result', [user, resource]))
    .rows[0].result;
}
async function rejected(operation, code) {
  await db.exec('savepoint rejection');
  await assert.rejects(operation, (error) => error.code === code);
  await db.exec('rollback to savepoint rejection; release savepoint rejection');
}
async function counts() {
  return (
    await db.query(
      'select (select count(*)::int from public.exercise_attempts) as attempts, (select count(*)::int from public.learning_progress) as progress, (select count(*)::int from public.user_achievements) as awards',
    )
  ).rows[0];
}

describe('PostgreSQL transactional learning workflow', () => {
  before(async () => {
    db = new PGlite();
    await db.exec(
      'create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated; create role service_role bypassrls;',
    );
    const root = resolve(import.meta.dirname, '../../../supabase');
    for (const name of readdirSync(resolve(root, 'migrations'))
      .filter((name) => name.endsWith('.sql'))
      .sort()) {
      await db.exec(readFileSync(resolve(root, 'migrations', name), 'utf8'));
    }
    await db.exec(readFileSync(resolve(root, 'seeds/educational_demo.sql'), 'utf8'));
    await db.exec(`
      insert into auth.users values ('${U1}'), ('${U2}'), ('${U3}');
      insert into public.profiles(id,display_name) values ('${U1}','User one'), ('${U2}','User two'), ('${U3}','No membership');
      insert into public.organizations(id,name) values ('${ORG1}','Org one'), ('${ORG2}','Org two');
      insert into public.organization_members(organization_id,user_id) values ('${ORG1}','${U1}'), ('${ORG2}','${U2}');
      insert into public.campaigns(id,organization_id,module_id,title,status,created_by) values
        ('${ASSIGN1}','${ORG1}','${MODULE}','Campaign one','active','${U1}'),
        ('${ASSIGN2}','${ORG2}','${MODULE}','Campaign two','active','${U2}');
      insert into public.campaign_assignments(id,campaign_id,organization_id,participant_id) values
        ('${ASSIGN1}','${ASSIGN1}','${ORG1}','${U1}'), ('${ASSIGN2}','${ASSIGN2}','${ORG2}','${U2}');
    `);
  });
  beforeEach(async () => {
    await db.exec('begin; set local role service_role');
  });
  afterEach(async () => {
    await db.exec('rollback');
  });
  after(async () => {
    await db.close();
  });

  it('evaluates a correct answer and atomically records points and achievements', async () => {
    const result = await record();
    assert.equal(result.correct, true);
    assert.equal(result.pointsAwarded, 10);
    assert.equal(result.evaluation, 'server');
    assert.ok(result.explanation);
    assert.deepEqual(await counts(), { attempts: 1, progress: 1, awards: 2 });
    const progress = await snapshot('progress');
    assert.equal(progress.summary.points, 10);
    assert.equal(progress.summary.correct, 1);
    assert.equal(progress.summary.completed, 1);
  });
  it('grants completion points for incorrect answers and preserves first-result metrics', async () => {
    assert.equal((await record({ option: O[0] })).correct, false);
    assert.equal((await record({ id: ID(2), option: O[1] })).pointsAwarded, 0);
    const progress = await snapshot('progress');
    assert.equal(progress.summary.points, 10);
    assert.equal(progress.summary.correct, 0);
    assert.equal(progress.summary.reviewed, 1);
    assert.equal(progress.summary.exerciseStats.find((x) => x.exerciseId === E[0]).attempts, 2);
    assert.equal((await snapshot('attempts')).length, 2);
  });
  it('replays the exact persisted response, even if feedback changes or content is archived', async () => {
    const first = await record();
    await db.exec(
      `update public.exercise_options set explanation='changed' where id='${O[1]}'; update public.exercises set status='archived' where id='${E[0]}'`,
    );
    assert.deepEqual(await record(), first);
    assert.deepEqual(await counts(), { attempts: 1, progress: 1, awards: 2 });
    assert.deepEqual((await snapshot('attempts'))[0], first);
  });
  it('rejects reuse of an id for another payload or user', async () => {
    await record();
    await rejected(() => record({ option: O[0] }), 'PT409');
    await rejected(() => record({ user: U2 }), 'PT409');
    await rejected(() => record({ assignment: ASSIGN1 }), 'PT409');
    assert.equal((await counts()).attempts, 1);
  });
  it('records repeat exercises with different ids without duplicate scoring', async () => {
    const results = await Promise.all([record(), record({ id: ID(2) }), record({ id: ID(3) })]);
    assert.equal(
      results.reduce((sum, item) => sum + item.pointsAwarded, 0),
      10,
    );
    assert.equal((await counts()).attempts, 3);
  });
  it('rejects options from another exercise before any mutation', async () => {
    await rejected(() => record({ option: O[5] }), 'PT400');
    assert.deepEqual(await counts(), { attempts: 0, progress: 0, awards: 0 });
  });
  it('rejects unpublished exercises and unpublished parent modules', async () => {
    await db.exec(`update public.exercises set status='draft' where id='${E[0]}'`);
    await rejected(() => record(), 'PT404');
    await db.exec(
      `update public.exercises set status='published' where id='${E[0]}'; update public.learning_modules set status='archived' where id='${MODULE}'`,
    );
    await rejected(() => record(), 'PT404');
  });
  it('requires category and a correct option without guessing them', async () => {
    await db.exec(`update public.exercises set category=null where id='${E[0]}'`);
    await rejected(() => record(), 'PT409');
    await db.exec(
      `update public.exercises set category='phishing' where id='${E[0]}'; update public.exercise_options set is_correct=false where id='${O[1]}'`,
    );
    await rejected(() => record(), 'PT409');
  });
  it('blocks users without membership and isolates personal history and progress', async () => {
    await rejected(() => record({ user: U3 }), 'PT403');
    await rejected(() => snapshot('progress', U3), 'PT403');
    await record();
    assert.deepEqual(await snapshot('attempts', U2), []);
    assert.equal((await snapshot('progress', U2)).summary.points, 0);
    assert.ok((await snapshot('achievements', U2)).every((x) => !x.unlocked));
  });
  it('checks membership again for idempotent replays', async () => {
    await record();
    await db.exec(
      `delete from public.campaign_assignments where participant_id='${U1}'; delete from public.campaigns where created_by='${U1}'; delete from public.organization_members where user_id='${U1}'`,
    );
    await rejected(() => record(), 'PT403');
  });
  it('rejects another participant/organization assignment and closed campaigns', async () => {
    await rejected(() => record({ assignment: ASSIGN2 }), 'PT403');
    await db.exec(`update public.campaigns set status='closed' where id='${ASSIGN1}'`);
    await rejected(() => record({ assignment: ASSIGN1 }), 'PT403');
    assert.equal((await counts()).attempts, 0);
  });
  it('rejects assignment to another module, even for the correct owner', async () => {
    await db.exec(
      `insert into public.learning_modules(id,title) values ('${ID(99)}','Other module'); update public.campaigns set module_id='${ID(99)}' where id='${ASSIGN1}'`,
    );
    await rejected(() => record({ assignment: ASSIGN1 }), 'PT403');
  });
  it('completes assignments only from their own attempts and never awards points twice', async () => {
    for (const [i, option] of [O[1], O[5], O[7]].entries())
      await record({ id: ID(i + 1), exercise: E[i], option });
    assert.equal((await snapshot('progress')).summary.points, 30);
    assert.ok((await snapshot('achievements')).every((x) => x.unlocked));
    assert.equal(
      (
        await db.query('select completed_at from public.campaign_assignments where id=$1', [
          ASSIGN1,
        ])
      ).rows[0].completed_at,
      null,
    );
    for (const [i, option] of [O[1], O[5], O[7]].entries()) {
      const result = await record({ id: ID(i + 10), exercise: E[i], option, assignment: ASSIGN1 });
      assert.equal(result.pointsAwarded, 0);
    }
    assert.ok(
      (
        await db.query('select completed_at from public.campaign_assignments where id=$1', [
          ASSIGN1,
        ])
      ).rows[0].completed_at,
    );
    assert.deepEqual(await counts(), { attempts: 6, progress: 1, awards: 3 });
  });
  it('does not award phishing for the bank-call category', async () => {
    await record({ exercise: E[2], option: O[7] });
    assert.equal((await snapshot('achievements')).find((x) => x.id === 'phishing').unlocked, false);
  });
  it('rolls back attempt, progress and rewards on a late assignment failure', async () => {
    await record({ id: ID(1), assignment: ASSIGN1 });
    await record({ id: ID(2), exercise: E[1], option: O[5], assignment: ASSIGN1 });
    const before = await counts();
    await db.exec(`reset role; create function public.fail_assignment_test() returns trigger language plpgsql as $$ begin raise exception 'test failure'; end $$;
      create trigger fail_assignment_test before update on public.campaign_assignments for each row execute function public.fail_assignment_test(); set local role service_role;`);
    await rejected(
      () => record({ id: ID(3), exercise: E[2], option: O[7], assignment: ASSIGN1 }),
      'P0001',
    );
    assert.deepEqual(await counts(), before);
    assert.equal((await snapshot('progress')).summary.points, 20);
    await db.exec(
      'reset role; drop trigger fail_assignment_test on public.campaign_assignments; set local role service_role',
    );
    assert.equal(
      (await record({ id: ID(3), exercise: E[2], option: O[7], assignment: ASSIGN1 }))
        .pointsAwarded,
      10,
    );
  });
  it('denies RPC and table access to public client roles and uses SECURITY INVOKER', async () => {
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set local role ${role}`);
      await rejected(() => record(), '42501');
      await rejected(() => snapshot('attempts'), '42501');
      await rejected(() => db.query('select * from public.exercise_attempts'), '42501');
    }
    await db.exec('reset role');
    const functions = await db.query(
      "select prosecdef from pg_proc where proname in ('aex_record_attempt','aex_learning_read')",
    );
    assert.ok(functions.rows.every((row) => row.prosecdef === false));
  });
});
