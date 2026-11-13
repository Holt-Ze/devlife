import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { testDatabase } from '../lib/test-database.mjs'
import { demoIds, seed } from '../seeds/001_demo.mjs'
import { canonical, digest, makeSnapshot, validateContent } from '../lib/content.mjs'
import { verifyPassword } from '../lib/password.mjs'

test('PostgreSQL migrations, seeds and constraints', { timeout: 90000 }, async t => {
    const fixture = await testDatabase()
    const db = fixture.sql
    t.after(() => fixture.close())
    process.env.SEED_ADMIN_PASSWORD = `test-only-${randomUUID()}`
    process.env.SEED_PLAYER_PASSWORD = `test-only-${randomUUID()}`
    const rejectCode = async (operation, code) => assert.rejects(operation, error => error.code === code)
    const counts = async () => Object.fromEntries(await Promise.all(['users', 'events', 'content_versions', 'career_runs', 'run_actions'].map(async table => [table, Number((await db(table).count('* as n').first()).n)])))

    await t.test('empty database migrates and second migrate is a no-op', async () => {
        const [, first] = await db.migrate.latest()
        assert.equal(first.length, 1)
        const [, second] = await db.migrate.latest()
        assert.equal(second.length, 0)
        assert.equal((await db.migrate.list())[0].length, 1)
        assert.equal((await db.raw("SELECT count(*) AS n FROM pg_catalog.pg_description d JOIN pg_catalog.pg_class c ON c.oid=d.objoid JOIN pg_catalog.pg_namespace ns ON ns.oid=c.relnamespace WHERE ns.nspname='public' AND c.relname IN ('users','events','content_versions','career_runs','run_actions') AND d.objsubid > 0")).rows[0].n, '34')
    })
    await t.test('seed covers content baseline and uses salted password hashes', async () => {
        await db.seed.run()
        assert.deepEqual(await counts(), { users: 2, events: 12, content_versions: 1, career_runs: 1, run_actions: 1 })
        const { snapshot, checksum } = await db('content_versions').first()
        assert.equal(snapshot.events.filter(e => e.choices.length > 0).length, 6)
        assert.equal(snapshot.endings.length, 3)
        assert.equal(snapshot.careerQuarters, 24)
        assert.equal(digest(snapshot), checksum)
        const player = await db('users').where({ username: 'demo_player' }).first()
        assert.ok(await verifyPassword(process.env.SEED_PLAYER_PASSWORD, player.password_hash))
        assert.equal(await verifyPassword('wrong-password', player.password_hash), false)
    })
    await t.test('repeat seed preserves passwords, modified drafts and saved progress', async () => {
        const before = await db('users').where({ username: 'demo_player' }).first()
        await db('events').where({ code: 'first-review' }).update({ text: '人工编辑的事件', revision: 1 })
        await db('career_runs').where({ id: demoIds.run }).update({ version: 2 })
        await db.seed.run()
        assert.deepEqual(await counts(), { users: 2, events: 12, content_versions: 1, career_runs: 1, run_actions: 1 })
        assert.equal((await db('users').where({ id: before.id }).first()).password_hash, before.password_hash)
        assert.equal((await db('career_runs').first()).version, 2)
        assert.equal((await db('events').where({ code: 'first-review' }).first()).text, '人工编辑的事件')
        assert.notEqual((await db('content_versions').first()).snapshot.events[0].text, '人工编辑的事件')
    })
    await t.test('unique idempotency key is scoped to a run; invalid FKs are rejected', async () => {
        const action = await db('run_actions').first()
        const { id, created_at, ...duplicate } = action
        duplicate.result = JSON.stringify(duplicate.result)
        await rejectCode(() => db('run_actions').insert(duplicate), '23505')
        await rejectCode(() => db('run_actions').insert({ ...duplicate, run_id: randomUUID() }), '23503')
        const run = await db('career_runs').first()
        await rejectCode(() => db('career_runs').insert({ ...run, id: randomUUID(), user_id: randomUUID(), state: JSON.stringify(run.state) }), '23503')
        const copyId = randomUUID()
        await db('career_runs').insert({ ...run, id: copyId, state: JSON.stringify(run.state) })
        await db('run_actions').insert({ ...duplicate, run_id: copyId })
    })
    await t.test('domains, required JSON state fields and integer money are enforced', async () => {
        for (const [field, value] of [['quarter', -1], ['quarter', 25], ['version', -1], ['status', 'unknown']]) {
            await rejectCode(() => db('career_runs').where({ id: demoIds.run }).update({ [field]: value }), '23514')
        }
        for (const state of [null, {}, { tech: null, health: 5, mood: 5, cash_cents: 0 }, { tech: 5, health: 5, mood: 5, cash_cents: 0.1 }, { tech: -1, health: 5, mood: 5, cash_cents: 0 }, { tech: '5', health: 5, mood: 5, cash_cents: 0 }]) {
            await rejectCode(() => db('career_runs').where({ id: demoIds.run }).update({ state: JSON.stringify(state) }), '23514')
        }
        await rejectCode(() => db('events').where({ code: 'first-review' }).update({ choices: '{}' }), '23514')
        await rejectCode(() => db('users').where({ username: 'demo_player' }).update({ role: 'owner' }), '23514')
        await rejectCode(() => db('users').where({ username: 'demo_player' }).update({ auth_version: -1 }), '23514')
        await db('career_runs').where({ id: demoIds.run }).update({ state: JSON.stringify({ tech: 5, health: 5, mood: 5, cash_cents: -100 }) })
    })
    await t.test('published snapshots reject updates, deletion and truncation', async () => {
        await rejectCode(() => db('content_versions').update({ snapshot: '{}' }), '55000')
        await rejectCode(() => db('content_versions').del(), '55000')
        await rejectCode(() => db.raw('TRUNCATE content_versions CASCADE'), '55000')
        await rejectCode(() => db('users').where({ username: 'demo_player' }).del(), '23001')
    })
    await t.test('transaction failure rolls back both save state and action record', async () => {
        const before = await db('career_runs').where({ id: demoIds.run }).first()
        const beforeActions = (await counts()).run_actions
        await assert.rejects(db.transaction(async trx => {
            await trx('career_runs').where({ id: demoIds.run }).update({ version: 99 })
            await trx('run_actions').insert({ run_id: demoIds.run, request_id: randomUUID(), payload_hash: 'a'.repeat(64), result: '{}' })
            throw new Error('forced rollback')
        }), /forced rollback/)
        assert.equal((await db('career_runs').where({ id: demoIds.run }).first()).version, before.version)
        assert.equal((await counts()).run_actions, beforeActions)
    })
    await t.test('seed preflight failure changes no rows', async () => {
        const before = await counts()
        const saved = process.env.SEED_ADMIN_PASSWORD
        delete process.env.SEED_ADMIN_PASSWORD
        await assert.rejects(seed(db), /至少/)
        process.env.SEED_ADMIN_PASSWORD = saved
        assert.deepEqual(await counts(), before)
    })
    await t.test('explicit rollback drops core tables and migration replays', async () => {
        const [, rolledBack] = await db.migrate.rollback()
        assert.equal(rolledBack.length, 1)
        assert.equal(await db.schema.hasTable('users'), false)
        const [, applied] = await db.migrate.latest()
        assert.equal(applied.length, 1)
        await db.seed.run()
        assert.deepEqual(await counts(), { users: 2, events: 12, content_versions: 1, career_runs: 1, run_actions: 1 })
    })
})

test('publication validator rejects nested content errors and hashes canonical JSON', () => {
    const good = makeSnapshot()
    const bad = structuredClone(good)
    bad.events[0].choices[1].code = bad.events[0].choices[0].code
    assert.throws(() => validateContent(bad), /选项编码/)
    const invalidEffect = structuredClone(good)
    invalidEffect.events[0].effects.cash_cents = 0.5
    assert.throws(() => validateContent(invalidEffect), /效果超出/)
    const invalidReference = structuredClone(good)
    invalidReference.schedule[0].eventCode = 'missing-event'
    assert.throws(() => validateContent(invalidReference), /季度表引用/)
    assert.equal(digest({ a: 1, b: { c: 2 } }), digest({ b: { c: 2 }, a: 1 }))
    assert.equal(canonical({ b: 2, a: 1 }), '{"a":1,"b":2}')
})
