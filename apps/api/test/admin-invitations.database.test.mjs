import assert from 'node:assert/strict';
import { before, after, beforeEach, afterEach, describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const ADMIN = '11111111-1111-4111-8111-111111111111';
const TARGET = '22222222-2222-4222-8222-222222222222';
const OTHER = '33333333-3333-4333-8333-333333333333';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let db;
async function create(issuer = ADMIN, org = A) {
  return (await db.query('select public.aex_create_admin_invitation($1,$2,$3,$4) as result', [issuer, org, 'invite@example.test', 'Convidado fictício'])).rows[0].result.id;
}
async function ready() {
  const id = await create();
  await db.query('select public.aex_admin_invitation_delivery($1,$2,$3)', [ADMIN, id, TARGET]);
  await db.query('update auth.users set email_confirmed_at = now() where id = $1', [TARGET]);
  return id;
}
const accept = (id, user = TARGET) => db.query('select public.aex_accept_admin_invitation($1,$2) as result', [user, id]);
async function reject(operation, code) {
  await db.exec('savepoint rejection');
  await assert.rejects(operation, error => error.code === code);
  await db.exec('rollback to savepoint rejection; release savepoint rejection');
}
async function count(table) { return Number((await db.query(`select count(*) as n from public.${table} where ${table === 'profiles' ? 'id' : 'user_id'} = $1`, [TARGET])).rows[0].n); }

describe('Administrative invitations: real PostgreSQL transaction and permissions', () => {
  before(async () => {
    db = new PGlite();
    await db.exec('create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,invited_at timestamptz); create role anon; create role authenticated; create role service_role bypassrls;');
    const root = resolve(import.meta.dirname, '../../../supabase/migrations');
    for (const name of ['20261111002325_aex_initial_schema_backend_only.sql', '20261111155233_aex_admin_invitations.sql']) await db.exec(readFileSync(resolve(root, name), 'utf8'));
    await db.exec(`
      insert into auth.users values ('${ADMIN}','admin@example.test',now(),null), ('${TARGET}','invite@example.test',null,now()), ('${OTHER}','other@example.test',now(),null);
      insert into public.organizations(id,name) values ('${A}','Instituição A'), ('${B}','Instituição B');
      insert into public.profiles(id,display_name) values ('${ADMIN}','Admin fictício'), ('${OTHER}','Participante fictício');
      insert into public.organization_members(organization_id,user_id,role) values ('${A}','${ADMIN}','admin'), ('${A}','${OTHER}','participant');
    `);
  });
  after(async () => { await db.close(); });
  beforeEach(async () => { await db.exec('begin'); });
  afterEach(async () => { await db.exec('rollback'); });

  it('activation atomically creates profile/admin membership and consumes invitation', async () => {
    const id = await ready();
    assert.equal((await accept(id)).rows[0].result.organization_id, A);
    assert.equal(await count('profiles'), 1);
    assert.equal(await count('organization_members'), 1);
    const inv = (await db.query('select status,accepted_at from public.admin_invitations where id = $1', [id])).rows[0];
    assert.equal(inv.status, 'accepted'); assert.ok(inv.accepted_at);
    await reject(() => accept(id), '22023');
    assert.equal(await count('organization_members'), 1);
  });
  it('participant cannot issue an invitation or choose another organization', async () => {
    await reject(() => create(OTHER), '42501');
    await reject(() => create(ADMIN, B), '42501');
  });
  it('pending/failed email delivery grants no permission', async () => {
    const id = await create();
    await reject(() => accept(id), '22023');
    await db.query('select public.aex_admin_invitation_delivery($1,$2,null)', [ADMIN, id]);
    await reject(() => accept(id), '22023');
    assert.equal(await count('profiles'), 0);
  });
  it('different recipient and unconfirmed identity cannot activate', async () => {
    const id = await create();
    await db.query('select public.aex_admin_invitation_delivery($1,$2,$3)', [ADMIN, id, TARGET]);
    await reject(() => accept(id, OTHER), '42501');
    await reject(() => accept(id), '42501');
  });
  it('invalid and expired invitations create no profile or membership', async () => {
    const id = await ready();
    await db.query("update public.admin_invitations set created_at=now()-interval '2 days',expires_at=now()-interval '1 day' where id=$1", [id]);
    await reject(() => accept(id), '22023');
    await reject(() => accept('44444444-4444-4444-8444-444444444444'), '22023');
    assert.equal(await count('profiles'), 0);
  });
  it('issuer membership must still authorize the organization at acceptance', async () => {
    const id = await ready();
    await db.query("update public.organization_members set role='participant' where user_id=$1", [ADMIN]);
    await reject(() => accept(id), '42501');
    assert.equal(await count('organization_members'), 0);
  });
  it('existing participant is never promoted', async () => {
    const id = await ready();
    await db.query("insert into public.profiles(id,display_name) values($1,'Participante')", [TARGET]);
    await db.query("insert into public.organization_members(organization_id,user_id,role) values($1,$2,'participant')", [A, TARGET]);
    await reject(() => accept(id), '42501');
    assert.equal((await db.query('select role from public.organization_members where user_id=$1', [TARGET])).rows[0].role, 'participant');
  });
  it('confirmed existing accounts are not invited through onboarding', async () => {
    await db.query('update auth.users set email_confirmed_at=now() where id=$1', [TARGET]);
    await reject(() => create(), '23505');
  });
  it('duplicate sending is limited before calling the email service', async () => {
    await create(); await reject(() => create(), 'PT429');
  });
  it('a write failure rolls back profile, membership and consumption together', async () => {
    const id = await ready();
    await db.exec("create function public.reject_activation_test() returns trigger language plpgsql as $$ begin raise exception 'test rollback'; end $$; create trigger reject_activation_test before insert on public.organization_members for each row execute function public.reject_activation_test();");
    await reject(() => accept(id), 'P0001');
    assert.equal(await count('profiles'), 0);
    assert.equal((await db.query('select status from public.admin_invitations where id=$1',[id])).rows[0].status,'sent');
  });
  it('anon/authenticated cannot read invitations or execute privileged functions', async () => {
    for (const role of ['anon','authenticated']) {
      await db.exec(`set local role ${role}`);
      await reject(() => db.query('select * from public.admin_invitations'), '42501');
      await reject(() => create(), '42501');
      await reject(() => accept(TARGET), '42501');
      await db.exec('reset role');
    }
  });
});
