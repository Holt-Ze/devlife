import { randomUUID, createHash } from 'node:crypto'
import { digest } from './content.mjs'
import { source36 } from './source36.mjs'

export class ProfileError extends Error { constructor(message, status = 400) { super(message); this.status = status } }
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const parse = raw => { try { return JSON.parse(raw) } catch { throw new ProfileError('档案内容无法解析，原始本地档案已保留') } }

export async function profileService(db, userId) {
    const { data, checksum } = await source36()
    const majorIds = new Set(data.majors?.map(major => major.id))
    const eventDefinitions = new Map(data.events.map(event => [event.id, event]))
    const known = { talents: new Set(data.talents.map(x => x.id)), events: new Set(data.events.map(x => x.id)), achievements: new Set(data.achievements.map(x => x.id)) }
    const events = new Map((await db('events').whereNotNull('source_id').select('id', 'source_id')).map(x => [x.source_id, x.id]))
    const numericProperties = value => object(value) && Object.values(value).every(x => typeof x === 'number' && Number.isFinite(x))
    const validateProfile = raw => {
        const value = raw === null ? { times: 0, talents: [], events: [], achievements: [], locked: [] } : parse(raw)
        if (!object(value) || !Number.isSafeInteger(value.times) || value.times < 0 || value.times > 2147483647) throw new ProfileError('生涯次数不合法')
        for (const key of ['talents', 'events', 'achievements']) {
            if (!Array.isArray(value[key]) || value[key].some(x => !Number.isInteger(x) || !known[key].has(x))) throw new ProfileError(`档案的 ${key} 包含未知条目`)
            value[key] = [...new Set(value[key])]
        }
        value.locked ??= []
        if (!Array.isArray(value.locked) || value.locked.length > 1 || value.locked.some(x => !known.talents.has(x))) throw new ProfileError('保留天赋不合法')
        for (const key of ['highest', 'lowest']) if (value[key] != null && !numericProperties(value[key])) throw new ProfileError('历史属性不合法')
        return value
    }
    const validateUnique = raw => {
        if (raw === null || raw === 'null') return null
        const value = parse(raw)
        if (!object(value) || !object(value.property) || !['CHR', 'INT', 'STR', 'MNY'].every(key => Number.isFinite(value.property[key])) || !Array.isArray(value.talent) || !value.talent.length || value.talent.some(id => !known.talents.has(id))) throw new ProfileError('生成角色不合法')
        return value
    }
    async function get(trx = db) {
        const row = await trx('player_profiles').where({ user_id: userId }).first()
        if (!row) throw new ProfileError('本机玩家尚未初始化', 503)
        const profile = { times: row.times, locked: row.locked_talent_id === null ? [] : [row.locked_talent_id] }
        for (const [name, column] of [['talents','talent_id'], ['achievements','achievement_id']]) profile[name] = (await trx(`profile_${name}`).where({ user_id: userId }).orderBy(column).select(column)).map(x => x[column])
        profile.events = (await trx('profile_events as p').join('events as e', 'p.event_id', 'e.id').where('p.user_id', userId).orderBy('e.source_id').select('e.source_id')).map(x => x.source_id)
        if (row.highest) profile.highest = row.highest
        if (row.lowest) profile.lowest = row.lowest
        return { profile: JSON.stringify(profile), unique: row.unique_character ? JSON.stringify(row.unique_character) : null, version: row.version, initialized: row.initialized }
    }
    async function applyProfile(trx, value) {
        await trx('player_profiles').where({ user_id: userId }).update({ times: value.times, locked_talent_id: value.locked[0] || null, ...(value.highest ? { highest: JSON.stringify(value.highest) } : {}), ...(value.lowest ? { lowest: JSON.stringify(value.lowest) } : {}) })
        for (const [name, column] of [['talents','talent_id'], ['events','event_id'], ['achievements','achievement_id']]) {
            await trx(`profile_${name}`).where({ user_id: userId }).del()
            if (value[name].length) await trx(`profile_${name}`).insert(value[name].map(id => ({ user_id: userId, [column]: name === 'events' ? events.get(id) : id })))
        }
    }
    async function importArchive(payload, source = 'browser-localStorage') {
        if (!object(payload) || ![payload.profile, payload.unique].every(v => v === null || typeof v === 'string')) throw new ProfileError('导入载荷格式不正确')
        const profile = validateProfile(payload.profile), unique = validateUnique(payload.unique)
        return db.transaction(async trx => {
            const row = await trx('player_profiles').where({ user_id: userId }).forUpdate().first()
            await trx('archive_imports').insert({ user_id: userId, source, checksum: digest(payload), payload: JSON.stringify(payload) }).onConflict(['user_id','checksum']).ignore()
            if (!row.initialized) {
                await applyProfile(trx, profile)
                await trx('player_profiles').where({ user_id: userId }).update({ unique_character: unique ? JSON.stringify(unique) : null, initialized: true, version: row.version + 1, updated_at: trx.fn.now() })
            }
            return get(trx)
        })
    }
    async function save({ key, value, expectedVersion }) {
        if (!['profile','unique'].includes(key) || !Number.isSafeInteger(expectedVersion) || typeof value !== 'string') throw new ProfileError('保存请求不正确')
        const validated = key === 'profile' ? validateProfile(value) : validateUnique(value)
        return db.transaction(async trx => {
            const row = await trx('player_profiles').where({ user_id: userId }).forUpdate().first()
            if (row.version !== expectedVersion) throw new ProfileError('档案已在其他窗口更新，请刷新后再保存', 409)
            if (key === 'profile') await applyProfile(trx, validated)
            else await trx('player_profiles').where({ user_id: userId }).update({ unique_character: validated ? JSON.stringify(validated) : null })
            await trx('player_profiles').where({ user_id: userId }).update({ version: row.version + 1, initialized: true, updated_at: trx.fn.now() })
            return get(trx)
        })
    }
    async function archiveCareer({ id, state }) {
        if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id) || !object(state) || !object(state.props) || !numericProperties(state.props.current) || !Array.isArray(state.decisions) || !Array.isArray(state.events)) throw new ProfileError('生涯历史格式不正确')
        if (state.major !== undefined && !majorIds.has(state.major)) throw new ProfileError('生涯专业不正确')
        const maxQuarter = state.major ? data.campusQuarters : data.careerQuarters
        const quarter = state.props.current.age
        if (!Number.isInteger(quarter) || quarter < 0 || quarter > maxQuarter || state.events.some(id => !known.events.has(id))) throw new ProfileError('生涯季度或事件引用不正确')
        for (const decision of state.decisions) if (!eventDefinitions.get(decision.event)?.choices?.some(c => c.id === decision.choice)) throw new ProfileError('生涯选择记录不正确')
        return db.transaction(async trx => {
            const version = await trx('content_versions').where({ checksum }).first()
            if (!version) throw new ProfileError('生涯内容尚未同步到数据库', 503)
            const [inserted] = await trx('career_runs').insert({
                id,
                user_id: userId,
                content_version_id: version.id,
                quarter,
                state: JSON.stringify(state),
                rng_state: 'client-unavailable',
                status: 'ended',
                version: state.decisions.length,
            }).onConflict('id').ignore().returning('id')
            if (!inserted) {
                const existing = await trx('career_runs').where({ id }).first()
                if (existing.user_id !== userId || digest(existing.state) !== digest(state)) throw new ProfileError('生涯编号冲突', 409)
                return { id, repeated: true }
            }
            for (const decision of state.decisions) {
                const hash = createHash('sha256').update(id + ':' + decision.instance).digest('hex')
                const request_id = `${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20,32)}`
                await trx('run_actions').insert({ run_id: id, request_id, payload_hash: digest(decision), result: JSON.stringify(decision) })
            }
            return { id, repeated: false }
        })
    }
    return { get, save, importArchive, archiveCareer }
}
