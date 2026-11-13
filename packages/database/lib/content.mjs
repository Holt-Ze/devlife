import { createHash } from 'node:crypto'

export const initialState = { tech: 6, health: 8, mood: 7, cash_cents: 1800000 }
const choice = (code, label, effects) => ({ code, label, effects })
const event = (code, quarter, text, effects = {}, choices = []) => ({ code, quarter, text, effects, choices })

// The 24-quarter course baseline is intentionally separate from the 36-quarter
// browser game's rule expressions, talents and abstract savings points.
export const seedEvents = [
    event('first-review', 1, '第一次代码评审收到了十几条修改意见，你准备怎样回应？', {}, [
        choice('learn', '理解意见，补齐测试后再提交', { tech: 2, mood: 1 }),
        choice('discuss', '约导师讨论设计取舍', { tech: 1, mood: 2 }),
    ]),
    event('first-release', 2, '你参与的第一个版本顺利发布，团队向你发来感谢。', { tech: 1, mood: 1, cash_cents: 200000 }),
    event('after-work', 3, '下班后的两个小时，你决定怎样安排？', {}, [
        choice('study', '购买技术书并完成练习', { tech: 3, cash_cents: -20000 }),
        choice('rest', '运动、休息，恢复精力', { health: 2, mood: 2 }),
    ]),
    event('probation', 4, '你通过了试用期，开始独立负责一个小模块。', { tech: 1, mood: 1, cash_cents: 300000 }),
    event('incident', 6, '线上故障发生了，日志中有一条关键线索。', {}, [
        choice('investigate', '与同事一起定位根因并复盘', { tech: 3, mood: -1 }),
        choice('rollback', '优先回滚版本，恢复服务', { tech: 1, health: 1 }),
    ]),
    event('team-sharing', 8, '你在团队分享会上讲清了一个棘手问题。', { tech: 1, mood: 2 }),
    event('job-offer', 10, '一家新公司发来邀请，薪资更高，节奏也更快。', {}, [
        choice('join', '接受邀请，承担新的挑战', { tech: 2, health: -2, cash_cents: 500000 }),
        choice('stay', '留在当前团队继续积累', { tech: 1, mood: 2 }),
    ]),
    event('career-route', 12, '工作三年，你开始选择下一阶段的成长方向。', {}, [
        choice('specialist', '深入基础原理，走技术路线', { tech: 4, mood: -1 }),
        choice('balance', '稳定交付，为生活留出时间', { health: 2, mood: 3 }),
    ]),
    event('mentoring', 15, '新同事独立完成了任务，你也从指导中重新理解了基础知识。', { tech: 2, mood: 1 }),
    event('open-source', 18, '一个开源项目邀请你共同维护，你怎样安排投入？', {}, [
        choice('contribute', '固定投入时间，推动关键改进', { tech: 3, mood: 2, cash_cents: -50000 }),
        choice('limited', '限定投入时间，先照顾自己的节奏', { health: 2, mood: 1 }),
    ]),
    event('sustainable-work', 21, '你开始减少无效比较，把精力放回可改变的事情。', { health: 2, mood: 2 }),
    event('career-review', 24, '六年过去，你翻看最早的提交记录，为这一段职业旅程写下复盘。', { mood: 1 }),
]

export const endings = [
    { code: 'recovery', name: '休整重启', priority: 1, condition: { any: [{ health_lte: 0 }, { mood_lte: 0 }] } },
    { code: 'specialist', name: '技术专家', priority: 2, condition: { tech_gte: 24 } },
    { code: 'sustainable', name: '可持续的工程师', priority: 3, condition: { always: true } },
]

export function canonical(value) {
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
    if (value !== null && typeof value === 'object') {
        return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
    }
    return JSON.stringify(value)
}
export function digest(value) { return createHash('sha256').update(canonical(value)).digest('hex') }

export function validateContent(content) {
    const fail = message => { throw new Error(`内容校验失败：${message}`) }
    const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
    const validCode = value => typeof value === 'string' && /^[a-z][a-z0-9-]{0,39}$/.test(value)
    const validateEffects = effects => {
        if (!object(effects)) fail('效果必须是对象')
        for (const [key, value] of Object.entries(effects)) {
            if (!['tech', 'health', 'mood', 'cash_cents'].includes(key)) fail(`未知效果 ${key}`)
            if (!Number.isSafeInteger(value) || Math.abs(value) > (key === 'cash_cents' ? 100000000 : 100)) fail(`效果超出范围 ${key}`)
        }
    }
    if (content.formatVersion !== 1 || content.careerQuarters !== 24) fail('格式或季度版本不支持')
    if (!object(content.initialState) || Object.keys(content.initialState).sort().join(',') !== 'cash_cents,health,mood,tech') fail('初始状态字段不完整')
    validateEffects(content.initialState)
    if (['tech', 'health', 'mood'].some(key => content.initialState[key] < 0)) fail('初始属性不能为负')
    if (!Array.isArray(content.events) || content.events.length < 12) fail('至少需要 12 个事件')
    const codes = new Set()
    let choiceCount = 0
    for (const item of content.events) {
        if (!object(item) || !validCode(item.code) || codes.has(item.code)) fail('事件编码不合法或重复')
        codes.add(item.code)
        if (typeof item.text !== 'string' || !item.text.trim()) fail('事件文本为空')
        validateEffects(item.effects)
        if (!Array.isArray(item.choices)) fail('选项必须为数组')
        const choices = new Set()
        if (item.choices.length) {
            choiceCount++
            if (item.choices.length < 2 || item.choices.length > 6) fail('选择事件需 2–6 个选项')
        }
        for (const option of item.choices) {
            if (!object(option) || !validCode(option.code) || choices.has(option.code)) fail('选项编码不合法或重复')
            choices.add(option.code)
            if (typeof option.label !== 'string' || !option.label.trim()) fail('选项文案为空')
            validateEffects(option.effects)
        }
    }
    if (choiceCount < 6) fail('至少需要 6 个选择事件')
    if (!Array.isArray(content.schedule) || content.schedule.length !== 12) fail('季度表应包含 12 个事件位置')
    const quarters = new Set(), scheduledCodes = new Set()
    for (const item of content.schedule) {
        if (!object(item) || !Number.isInteger(item.quarter) || item.quarter < 1 || item.quarter > 24 || quarters.has(item.quarter) || !codes.has(item.eventCode) || scheduledCodes.has(item.eventCode)) fail('季度表引用不合法或重复')
        quarters.add(item.quarter)
        scheduledCodes.add(item.eventCode)
    }
    if (scheduledCodes.size !== codes.size) fail('存在未安排季度的事件')
    if (!Array.isArray(content.endings) || content.endings.length !== 3) fail('需要 3 类结局')
    // This baseline exposes only the documented, ordered ending predicates.
    if (canonical(content.endings) !== canonical(endings)) fail('结局规则不受基础版支持')
    return content
}

export function makeSnapshot() {
    return validateContent({
        formatVersion: 1,
        careerQuarters: 24,
        initialState,
        schedule: seedEvents.map(({ code, quarter }) => ({ quarter, eventCode: code })),
        events: seedEvents.map(({ quarter, ...item }) => item),
        endings,
    })
}
