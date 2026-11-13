import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { testDatabase } from '../lib/test-database.mjs'

test('Knex CLI loads ESM configuration and runs migration, status, seed and rollback', { timeout: 60000 }, async t => {
    const fixture = await testDatabase({ maxConnections: 8 })
    t.after(() => fixture.close())
    const cli = fileURLToPath(import.meta.resolve('knex/bin/cli.js'))
    const config = fileURLToPath(new URL('../knexfile.mjs', import.meta.url))
    const env = { ...process.env, DATABASE_URL: fixture.connection, SEED_ADMIN_PASSWORD: randomUUID(), SEED_PLAYER_PASSWORD: randomUUID() }
    const run = args => promisify(execFile)(process.execPath, [cli, '--knexfile', config, ...args], { env, timeout: 20000 })
    await run(['migrate:latest'])
    const status = await run(['migrate:list'])
    assert.match(status.stdout, /202611090001_initial.mjs/)
    await run(['seed:run'])
    assert.equal(Number((await fixture.sql('events').count('* as n').first()).n), 12)
    await fixture.sql.destroy()
    await run(['migrate:rollback'])
})
