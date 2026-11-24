import { ProfileError } from './profiles.mjs'
import { source36 } from './source36.mjs'

export const reviewPrompt = `你是大学生生涯模拟器的复盘教练。用简体中文对玩家说“你”，根据输入中的路线和本局实际经历复盘。
分清主动选择、日常事件和自动出现的后续。能力和积蓄都是游戏点数，仅用于解释本局。讨论游戏中的职业素养，引用可核对的行为和结果，避免推断玩家现实人格、收入、健康状态或岗位资格。
输出一个 JSON 对象，包含 qualities、turningPoint、nextStep 三个字符串。每段约 70–130 字，无 Markdown。
qualities：从本局行为讨论一个专业素养，如证据意识、沟通、协作、职业边界或时间管理。结合五维终值说明积累与代价。
turningPoint：点名季度、事件、选择、已记录的结果和实际增减值。校园篇优先追踪相关课程、实践或毕设是否帮助打开毕业去向，以及岗位里的实际反馈。只在记录表明有联系时连接这些事件。
nextStep：用建议语气给出同一节点可尝试的另一个行动，指出可以观察的游戏结果。优先从明确列出的其他无门槛选项选择。
提前休整或记录不足时，按本局已走过的季度分析。未经历的节点留空，避免假设玩家读完大学、入职或走完职场篇。`

const invalid = () => { throw new ProfileError('复盘记录格式不正确', 400) }

export async function reviewCareer(body) {
    if (!process.env.DEEPSEEK_API_KEY) throw new ProfileError('服务端尚未配置 DeepSeek 密钥', 503)
    const { data } = await source36()
    const major = data.majors?.find(item => item.id === body?.major)
    if (body?.major !== undefined && !major) invalid()
    const maxQuarter = major ? data.campusQuarters : data.careerQuarters
    const events = new Map(data.events.map(event => [event.id, event]))
    const dimensions = {
        charm: '沟通',
        intelligence: major ? '专业能力' : '技术',
        strength: '健康',
        money: '积蓄',
        spirit: '心态',
    }
    const scores = (values, partial) => {
        const result = {}
        for (const [key, label] of Object.entries(dimensions)) {
            if (partial && values?.[key] === undefined) continue
            if (!Number.isFinite(values?.[key])) invalid()
            result[label] = values[key]
        }
        return result
    }
    if (!Array.isArray(body?.logs) || !body.logs.length || body.logs.length > 80) invalid()
    const final = scores(body.final, false)
    const history = body.logs.map(log => {
        if (!Number.isInteger(log?.age) || log.age < 0 || log.age > maxQuarter ||
            !Array.isArray(log.events) || log.events.length > 12) invalid()
        const record = {
            季度: log.age,
            事件: log.events.map(id => events.get(id)?.event ?? invalid()),
        }
        if (log.decision) {
            const scene = events.get(log.decision.event)
            const choice = scene?.choices?.find(item => item.id === log.decision.choice)
            if (!choice || !log.events.includes(choice.event)) invalid()
            record.决定 = {
                场景: scene.dialogue.title,
                选择: choice.label,
                实际变化: scores(log.decision.changes, true),
                其他无门槛选项: scene.choices.filter(item => item !== choice && !item.condition).map(item => item.label),
            }
        }
        return record
    })
    const evidence = {
        路线: major?.name ?? '程序员职场篇',
        计划季度: maxQuarter,
        阶段: major ? '第 0 季度报到，前四年为大学，第 16 季度毕业，其后为毕业第一年。' : '第 0 季度入职，此后为九年职场经历。',
        最终属性: final,
        经历: history,
    }
    const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        signal: AbortSignal.timeout(45000),
        headers: { Authorization: 'Bearer ' + process.env.DEEPSEEK_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: process.env.DEEPSEEK_MODEL || 'deepseek-flash',
            thinking: { type: 'disabled' },
            response_format: { type: 'json_object' },
            max_tokens: 1100,
            messages: [{ role: 'system', content: reviewPrompt }, { role: 'user', content: JSON.stringify(evidence) }],
        }),
    }).catch(() => { throw new ProfileError('暂时无法连接 DeepSeek，请稍后重试', 503) })
    if (!response.ok) {
        const messages = { 401: 'DeepSeek 密钥未通过验证', 402: 'DeepSeek 账户余额不足', 429: 'DeepSeek 请求繁忙，请稍后重试' }
        throw new ProfileError(messages[response.status] || 'DeepSeek 服务暂时不可用', 503)
    }
    try {
        const report = JSON.parse((await response.json()).choices[0].message.content)
        const result = {}
        for (const key of ['qualities', 'turningPoint', 'nextStep']) {
            if (typeof report[key] !== 'string' || !report[key].trim()) throw new Error()
            result[key] = report[key].trim()
        }
        return result
    } catch {
        throw new ProfileError('本次分析未生成完整结果，可以重试', 502)
    }
}
