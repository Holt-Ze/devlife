import { readFile } from 'node:fs/promises'
import { digest } from './content.mjs'

export async function source36() {
    const data = JSON.parse(await readFile(new URL('../data/game36-source.json', import.meta.url), 'utf8'))
    if (data.careerQuarters !== 36 || data.formatVersion !== 2) throw new Error('源内容版本不正确')
    const eventIds = new Set(data.events.map(item => item.id))
    const talentIds = new Set(data.talents.map(item => item.id))
    if (eventIds.size !== data.events.length || talentIds.size !== data.talents.length) throw new Error('源内容有重复 ID')
    for (const event of data.events) {
        const choices = new Set()
        for (const choice of event.choices || []) {
            if (!eventIds.has(choice.event) || choices.has(choice.id)) throw new Error('选项引用或唯一性错误')
            choices.add(choice.id)
        }
        for (const branch of event.branch || []) if (!eventIds.has(branch.event)) throw new Error('分支引用错误')
    }
    for (const character of data.characters) for (const id of character.talent) if (!talentIds.has(id)) throw new Error('出身天赋引用错误')
    const endingIds = new Set(data.endings.map(ending => ending.event))
    for (const id of endingIds) if (!eventIds.has(id)) throw new Error('结局引用错误')
    const tracks = [{ id: 'programmer', ages: data.ages }, ...(data.majors ?? [])]
    if (new Set(tracks.map(track => track.id)).size !== tracks.length) throw new Error('专业标识重复')
    for (const track of tracks) {
        const quarters = track.id === 'programmer' ? data.careerQuarters : data.campusQuarters
        if (!Number.isInteger(quarters) || quarters < 1 || quarters > 36 || track.ages.length !== quarters + 1) throw new Error('路线季度设置错误')
        for (const [quarter, age] of track.ages.entries()) {
            if (age.age !== quarter || !age.event[0]?.length) throw new Error('季度缺少有效事件池')
            for (const [id, weight] of age.event.flat()) {
                if (!eventIds.has(id) || !Number.isFinite(weight) || weight <= 0) throw new Error('事件池引用或权重错误')
            }
        }
        if (track.id === 'programmer') continue
        if (!track.endingEvents.every(id => endingIds.has(id)) ||
            !track.pathways.every(path => path.evidence.every(id => eventIds.has(id)))) {
            throw new Error('专业去向引用错误')
        }
    }
    return { data, checksum: digest(data) }
}

export async function verifySource(db) {
    const { data, checksum } = await source36()
    const actual = await db('events').whereNotNull('source_id').orderBy('source_id').select('definition')
    const expected = [...data.events].sort((a, b) => a.id - b.id)
    if (digest(actual.map(row => row.definition)) !== digest(expected)) throw new Error('事件定义校验失败')
    const talentRows = await db('talents').orderBy('id').select('definition')
    if (digest(talentRows.map(row => row.definition)) !== digest([...data.talents].sort((a,b) => a.id-b.id))) throw new Error('天赋定义校验失败')
    const version = await db('content_versions').where({ checksum, source_tag: 'game36' }).first()
    if (!version || digest(version.snapshot) !== checksum) throw new Error('完整内容快照校验失败')
    const counts = {}
    for (const name of ['users', 'events', 'event_choices', 'event_branches', 'quarter_events', 'talents', 'achievements', 'characters', 'character_talents', 'endings', 'content_versions', 'player_profiles', 'career_runs', 'run_actions', 'archive_imports']) counts[name] = Number((await db(name).count('* as n').first()).n)
    return { checksum, counts, sourceCounts: { events: data.events.length, choices: data.events.reduce((n,e) => n+(e.choices?.length || 0),0), talents: data.talents.length, achievements: data.achievements.length, characters: data.characters.length, endings: data.endings.length, quarters: data.ages.length, majors: data.majors?.length ?? 0 }, snapshotMatchesSource: true, eventDefinitionsMatch: true, talentDefinitionsMatch: true }
}
