import { digest, makeSnapshot } from '../lib/content.mjs'
import { hashPassword } from '../lib/password.mjs'

export const demoIds = {
    run: '20000000-0000-4000-8000-000000000001',
    request: '30000000-0000-4000-8000-000000000001',
    eventInstance: '40000000-0000-4000-8000-000000000001',
}

// Insert-only seed: re-running does not reset accounts, edit drafts or overwrite progress.
export async function seed(knex) {
    const snapshot = makeSnapshot()
    const passwordHashes = await Promise.all([
        hashPassword(process.env.SEED_ADMIN_PASSWORD),
        hashPassword(process.env.SEED_PLAYER_PASSWORD),
    ])
    await knex.transaction(async trx => {
        for (const [index, role] of ['admin', 'player'].entries()) {
            await trx('users').insert({ username: `demo_${role}`, password_hash: passwordHashes[index], role }).onConflict('username').ignore()
        }
        const admin = await trx('users').where({ username: 'demo_admin' }).first()
        const player = await trx('users').where({ username: 'demo_player' }).first()
        if (admin.role !== 'admin' || player.role !== 'player') throw new Error('已有种子用户名的角色不匹配，已回滚')
        for (const { code, text, choices, effects } of snapshot.events) {
            await trx('events').insert({ code, text, choices: JSON.stringify(choices), effects: JSON.stringify(effects) }).onConflict('code').ignore()
        }
        const checksum = digest(snapshot)
        await trx('content_versions').insert({ snapshot: JSON.stringify(snapshot), checksum, created_by: admin.id }).onConflict('checksum').ignore()
        const content = await trx('content_versions').where({ checksum }).first()
        const state = { ...snapshot.initialState, pendingEvent: { code: 'first-review', instanceId: demoIds.eventInstance } }
        const result = { id: demoIds.run, quarter: 1, status: 'awaiting_choice', version: 1, state, event: snapshot.events[0] }
        const inserted = await trx('career_runs').insert({
            id: demoIds.run, user_id: player.id, content_version_id: content.id,
            quarter: 1, state: JSON.stringify(state), rng_state: 'demo-seed-v1:1', status: 'awaiting_choice', version: 1,
        }).onConflict('id').ignore().returning('id')
        if (inserted.length) {
            await trx('run_actions').insert({ run_id: demoIds.run, request_id: demoIds.request, payload_hash: digest({ type: 'advance', expectedVersion: 0 }), result: JSON.stringify(result) })
        }
    })
}
