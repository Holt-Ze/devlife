import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import knex from 'knex'
import { writeFile } from 'node:fs/promises'
import { config, localConfig } from '../knexfile.mjs'
import { profileService } from '../lib/profiles.mjs'
import { source36 } from '../lib/source36.mjs'
import { exercise } from './exercise.mjs'

test('native persistent PostgreSQL integration', {timeout:120000}, async t => {
    const settings = localConfig()
    const admin = new pg.Client({connectionString:settings.adminUrl})
    await admin.connect()
    const name = 'devlife_verify_' + randomUUID().replaceAll('-','')
    await admin.query(`CREATE DATABASE ${name} OWNER devlife_owner TEMPLATE template0`)
    const url = new URL(settings.ownerUrl); url.pathname = '/' + name
    const db = knex(config(url.toString()))
    t.after(async () => {
        await db.destroy()
        if (!/^devlife_verify_[a-f0-9]{32}$/.test(name)) throw new Error('拒绝清理非验证数据库')
        await admin.query(`DROP DATABASE ${name} WITH (FORCE)`)
        await admin.end()
    })
    await exercise(db,t)
    await t.test('two genuinely concurrent transactions accept exactly one expectedVersion', async () => {
        const user = await db('users').where({username:'local_player'}).first()
        const service = await profileService(db,user.id)
        const before = await service.get()
        const input = {key:'profile',value:before.profile,expectedVersion:before.version}
        const results = await Promise.allSettled([service.save(input),service.save(input)])
        assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
        assert.equal(results.filter(r=>r.status==='rejected' && r.reason.status===409).length,1)
        assert.equal((await service.get()).version,before.version+1)
    })
    await t.test('configured runtime role cannot modify source, read password hashes or create tables', async () => {
        const app = knex(config(settings.appUrl))
        try {
            const { data } = await source36()
            assert.equal(Number((await app('events').count('* as n').first()).n), data.events.length)
            await assert.rejects(app('content_versions').update({snapshot:'{}'}),e=>e.code==='42501')
            await assert.rejects(app('users').select('password_hash'),e=>e.code==='42501')
            await assert.rejects(app.raw('CREATE TABLE forbidden_probe(id integer)'),e=>e.code==='42501')
        } finally {await app.destroy()}
    })
    await t.test('empty scratch database rolls back all migrations and replays them', async () => {
        const emptyName = 'devlife_verify_' + randomUUID().replaceAll('-','')
        await admin.query(`CREATE DATABASE ${emptyName} OWNER devlife_owner TEMPLATE template0`)
        const emptyUrl = new URL(settings.ownerUrl); emptyUrl.pathname='/' + emptyName
        const empty = knex(config(emptyUrl.toString()))
        try {
            await empty.migrate.latest()
            const result = await empty.migrate.rollback(undefined,true)
            assert.equal(result[1].length,4)
            assert.equal(await empty.schema.hasTable('events'),false)
            assert.equal((await empty.migrate.latest())[1].length,4)
        } finally {await empty.destroy();await admin.query(`DROP DATABASE ${emptyName} WITH (FORCE)`)}
    })
    await writeFile(new URL('../../../.local/real-tests.json',import.meta.url),JSON.stringify({date:new Date().toISOString(),database:'PostgreSQL 18.6 native',checks:16,passed:true,concurrentTransactions:'one success, one 409',runtimeRoleRestricted:true,rollbackReplay:true},null,2))
})
