import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { verifySource, source36 } from '../lib/source36.mjs'
import { profileService } from '../lib/profiles.mjs'
import { createApp } from '../server.mjs'

export async function exercise(db, t) {
    const { data } = await source36()
    let player, service, version
    await t.test('three ordered migrations create 18 business tables with comments', async () => {
        await db.migrate.latest()
        const rows = await db('information_schema.tables').where({ table_schema: 'public', table_type: 'BASE TABLE' }).whereNot('table_name', 'like', 'knex_%')
        assert.equal(rows.length, 18)
        const pending = (await db.migrate.latest())[1]
        assert.equal(pending.length, 0)
    })
    await t.test('complete real source content loads with original IDs and references', async () => {
        process.env.SEED_ADMIN_PASSWORD = randomUUID()
        process.env.SEED_PLAYER_PASSWORD = randomUUID()
        await db.seed.run()
        const report = await verifySource(db)
        assert.equal(report.counts.events, 98)
        assert.equal(report.counts.event_choices, 25)
        assert.equal(report.counts.talents, 28)
        assert.equal(report.counts.achievements, 20)
        assert.equal(report.counts.characters, 6)
        assert.equal(report.counts.endings, 6)
        assert.equal(report.counts.content_versions, 1)
        player = await db('users').where({ username: 'local_player' }).first()
        service = await profileService(db, player.id)
    })
    await t.test('source seed repeats without creating duplicate published versions', async () => {
        const before = await verifySource(db)
        await db.seed.run()
        assert.deepEqual((await verifySource(db)).counts, before.counts)
    })
    await t.test('foreign keys and compound uniqueness prevent orphan and duplicate choices', async () => {
        const row = await db('event_choices').first()
        await assert.rejects(db('event_choices').insert({ ...row, effects: JSON.stringify(row.effects) }), e => e.code === '23505')
        await assert.rejects(db('event_choices').insert({ ...row, code: 'orphan', position: 99, outcome_event_id: randomUUID(), effects: '{}' }), e => e.code === '23503')
        await assert.rejects(db('career_runs').insert({ user_id: player.id, content_version_id: randomUUID(), quarter: 37, state: '{}', rng_state: 'test' }))
    })
    await t.test('published snapshots reject update, delete and truncate', async () => {
        for (const action of [() => db('content_versions').update({ snapshot: '{}' }), () => db('content_versions').del(), () => db.raw('TRUNCATE content_versions CASCADE')]) await assert.rejects(action, e => e.code === '55000')
    })
    await t.test('browser archive import preserves original payload and normalizes references', async () => {
        const payload = { profile: JSON.stringify({ times: 3, talents: [1001,1002], events: [20000,20001], achievements: [301], locked: [1001] }), unique: JSON.stringify({ property: { CHR:5, INT:5, STR:5, MNY:5 }, talent: [1001] }) }
        const saved = await service.importArchive(payload, 'integration-probe')
        assert.equal(JSON.parse(saved.profile).times, 3)
        assert.equal(saved.initialized, true)
        assert.deepEqual((await db('archive_imports').first()).payload, payload)
        assert.equal(Number((await db('profile_events').count('* as n').first()).n), 2)
        version = saved.version
        await service.importArchive(payload, 'integration-probe')
        assert.equal(Number((await db('archive_imports').count('* as n').first()).n), 1)
        assert.equal((await service.get()).version, version)
    })
    await t.test('profile writes use optimistic version and reject stale updates', async () => {
        const profile = JSON.parse((await service.get()).profile)
        profile.times = 4
        const saved = await service.save({ key: 'profile', value: JSON.stringify(profile), expectedVersion: version })
        assert.equal(JSON.parse(saved.profile).times, 4)
        await assert.rejects(service.save({ key: 'profile', value: JSON.stringify(profile), expectedVersion: version }), e => e.status === 409)
    })
    await t.test('invalid imports leave both profile and audit unchanged', async () => {
        const before = await service.get()
        await assert.rejects(service.importArchive({ profile: 'broken', unique: null }))
        await assert.rejects(service.importArchive({ profile: JSON.stringify({ times:0, talents:[999999], events:[], achievements:[] }), unique:null }))
        assert.deepEqual(await service.get(), before)
    })
    await t.test('a failed multi-table transaction rolls back completely', async () => {
        const before = await service.get()
        await assert.rejects(db.transaction(async trx => { await trx('player_profiles').where({ user_id: player.id }).update({ times: 99 }); await trx('profile_talents').where({ user_id:player.id }).del(); throw new Error('forced') }), /forced/)
        assert.deepEqual(await service.get(), before)
    })
    await t.test('completed career history and choices archive idempotently', async () => {
        const event = data.events.find(e => e.choices?.length)
        const state = { props:{current:{age:36,charm:8,intelligence:20,strength:8,money:20,spirit:8}}, life:0, events:[event.id], talents:[1001], achievements:[301], decisions:[{instance:'qa-1',event:event.id,quarter:1,choice:event.choices[0].id,changes:{}}] }
        const id = randomUUID()
        await service.archiveCareer({ id, state })
        assert.equal((await service.archiveCareer({ id, state })).repeated, true)
        assert.equal(Number((await db('run_actions').count('* as n').first()).n), 1)
        await assert.rejects(service.archiveCareer({ id, state:{...state,life:-1} }), e => e.status === 409)
    })
    await t.test('HTTP endpoints read PostgreSQL and reject cross-site writes', async () => {
        const app = await createApp({ connection: db.client.config.connection, userId:player.id, port:8787 })
        await new Promise(resolve => app.server.listen(0,'127.0.0.1',resolve))
        try {
            const base = `http://127.0.0.1:${app.server.address().port}`
            assert.equal((await (await fetch(base+'/healthz')).json()).storage, 'postgresql')
            assert.equal((await (await fetch(base+'/api/content')).json()).snapshot.events.length,98)
            assert.equal((await fetch(base+'/api/profile',{method:'PATCH',headers:{Origin:'https://other.example','Content-Type':'application/json'},body:'{}'})).status,403)
        } finally { await app.close() }
    })
    await t.test('source seed preserves the player profile and career archives', async () => {
        const before = await service.get()
        await db.seed.run()
        assert.deepEqual(await service.get(),before)
        assert.equal(Number((await db('career_runs').count('* as n').first()).n),1)
    })
}
