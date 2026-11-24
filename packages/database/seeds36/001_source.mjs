import { source36 } from '../lib/source36.mjs'
import { hashPassword } from '../lib/password.mjs'

export async function seed(knex) {
    const { data, checksum } = await source36()
    const adminHash = await hashPassword(process.env.SEED_ADMIN_PASSWORD)
    const playerHash = await hashPassword(process.env.SEED_PLAYER_PASSWORD)
    await knex.transaction(async db => {
        for (const [username, role, password_hash] of [['local_admin', 'admin', adminHash], ['local_player', 'player', playerHash]]) {
            await db('users').insert({ username, role, password_hash }).onConflict('username').ignore()
        }
        const admin = await db('users').where({ username: 'local_admin', role: 'admin' }).first()
        const player = await db('users').where({ username: 'local_player', role: 'player' }).first()
        if (!admin || !player) throw new Error('本机账号角色与预期不一致')
        // Source is authoritative for this readonly catalogue. Old published snapshots are retained.
        for (const item of data.events) {
            const row = { code: `event-${item.id}`, source_id: item.id, text: item.event, choices: JSON.stringify(item.choices || []), effects: JSON.stringify(item.effect || {}), definition: JSON.stringify(item) }
            await db('events').insert(row).onConflict('source_id').merge(row)
        }
        const eventMap = new Map((await db('events').whereNotNull('source_id').select('id', 'source_id')).map(row => [row.source_id, row.id]))
        for (const item of data.talents) await db('talents').insert({ id: item.id, name: item.name, description: item.description, grade: item.grade, definition: JSON.stringify(item) }).onConflict('id').merge()
        for (const item of data.achievements) await db('achievements').insert({ id: item.id, name: item.name, description: item.description, grade: item.grade, condition: item.condition, opportunity: item.opportunity, hidden: item.hide }).onConflict('id').merge()
        for (const item of data.characters) {
            await db('characters').insert({ id: item.id, name: item.name, properties: JSON.stringify(item.property) }).onConflict('id').merge()
            await db('character_talents').where({ character_id: item.id }).del()
            for (const [position, talent_id] of item.talent.entries()) await db('character_talents').insert({ character_id: item.id, talent_id, position })
        }
        for (const item of data.events) {
            const event_id = eventMap.get(item.id)
            await db('event_choices').where({ event_id }).del()
            await db('event_branches').where({ event_id }).del()
            for (const [position, choice] of (item.choices || []).entries()) await db('event_choices').insert({ event_id, code: choice.id, position, label: choice.label, description: choice.description, condition: choice.condition || null, locked_reason: choice.lockedReason || null, effects: JSON.stringify(choice.effect || {}), outcome_event_id: eventMap.get(choice.event) })
            for (const [position, branch] of (item.branch || []).entries()) await db('event_branches').insert({ event_id, position, condition: branch.condition, target_event_id: eventMap.get(branch.event) })
        }
        // Replacing only source catalogue memberships; no player/history rows are touched.
        await db('quarter_events').del()
        const tracks = [{ id: 'programmer', ages: data.ages }, ...(data.majors ?? [])]
        const pools = tracks.flatMap(track =>
            track.ages.flatMap(item => item.event.flatMap((pool, pool_level) =>
                pool.map(([id, weight], position) => ({
                    track: track.id,
                    quarter: item.age,
                    pool_level,
                    position,
                    event_id: eventMap.get(id),
                    weight,
                })),
            )),
        )
        await db('quarter_events').insert(pools)
        for (const item of data.endings) await db('endings').insert({ event_id: eventMap.get(item.event), name: item.name, description: item.description }).onConflict('event_id').merge()
        await db('content_versions').insert({ snapshot: JSON.stringify(data), checksum, created_by: admin.id, source_tag: 'game36', career_quarters: 36 }).onConflict('checksum').ignore()
        await db('player_profiles').insert({ user_id: player.id }).onConflict('user_id').ignore()
    })
}
