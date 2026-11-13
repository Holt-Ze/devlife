import { test } from 'node:test'
import { testDatabase } from '../lib/test-database.mjs'
import { exercise } from './exercise.mjs'
test('complete 36-quarter database', { timeout:120000 }, async t => {
    const fixture = await testDatabase({maxConnections:12})
    t.after(() => fixture.close())
    await exercise(fixture.sql,t)
})
