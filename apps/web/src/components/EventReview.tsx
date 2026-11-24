import { useState } from 'react'
import { useLogs, type Allocation } from '@remake/hooks'
import { events, type MajorId } from '@remake/data'
import { attributeLabels, journeyTime } from '@remake/data/etc/display'
import { ChoiceChanges } from './Dialogue'

const sections = { qualities: '个人素养', turningPoint: '关键事件', nextStep: '下一局可以试什么' }
type Report = Record<keyof typeof sections, string>

export default function EventReview({ final, major }: { final: Allocation; major?: MajorId }) {
    const logs = useLogs()
    const properties = attributeLabels(major)
    const [report, setReport] = useState<Report>()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const decisions = logs.flatMap(log => log.decision ? [log.decision] : [])
    // 优先解释有明确代价的决定，再按单次属性变化总量排序。
    const impact = (changes: Partial<Allocation>) => Object.values(changes).reduce((n, value) => n + Math.abs(value), 0)
    const focus = [...decisions].sort((a, b) =>
        Number(Object.values(b.changes).some(n => n < 0)) - Number(Object.values(a.changes).some(n => n < 0)) ||
        impact(b.changes) - impact(a.changes))[0]
    const scene = focus && events.get(focus.event)
    const choice = scene?.choices?.find(item => item.id === focus?.choice)
    const alternative = scene?.choices?.find(item => item !== choice && !item.condition)
    const gains = focus && (Object.keys(focus.changes) as (keyof Allocation)[]).filter(key => focus.changes[key]! > 0)
    const costs = focus && (Object.keys(focus.changes) as (keyof Allocation)[]).filter(key => focus.changes[key]! < 0)
    async function generate() {
        setLoading(true)
        setError('')
        try {
            const response = await fetch('/api/review', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ major, final, logs: logs.map(({ age, events, decision }) => ({ age, events, decision })) }),
                signal: AbortSignal.timeout(55000),
            })
            if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('请启动本机 API 服务后重试。')
            const result = await response.json()
            if (!response.ok) throw new Error(result.message || '暂时无法生成分析')
            setReport(result)
        } catch (e) {
            setError(e instanceof Error && e.name === 'Error' ? e.message : '连接中断或超时，请重试。')
        } finally { setLoading(false) }
    }
    return <section className="event-review" aria-label="事件复盘">
        <h3>本局的关键取舍</h3>
        {focus && choice ? <>
            <p><strong>{journeyTime(focus.quarter, major)} · {scene?.dialogue?.title}</strong></p>
            <p>你选择了「{choice.label}」。{events.get(choice.event)?.event}</p>
            <ChoiceChanges changes={focus.changes} major={major} />
            <p>{gains?.length ? '这次行动直接改善了' + gains.map(key => properties[key]).join('、') + '。' : ''}
                {costs?.length ? '代价体现在' + costs.map(key => properties[key]).join('、') + '上。' : ''}
                {alternative && '下一局可以在这里试试「' + alternative.label + '」，对比两种选择后的属性变化。'}</p>
        </> : <p>这段生涯尚未留下主动选择。最后一个季度的记录是「{events.get(logs.at(-1)?.events.at(-1) ?? -1)?.event ?? '无事件记录'}」。现有经历不足以判断你的决策习惯。</p>}
        <div className="model-review">
            <h3>DeepSeek 深度复盘</h3>
            {report ? (Object.keys(sections) as (keyof Report)[]).map(key =>
                <div key={key}><h4>{sections[key]}</h4><p>{report[key]}</p></div>
            ) : <>
                <p>将本局的路线、五维终值、季度事件和决定发送给 DeepSeek，分析选择的代价和下一局可以尝试的行动。</p>
                <button className="secondary" disabled={loading} onClick={generate}>{loading ? '正在分析本局经历…' : error ? '重新生成分析' : '生成深度复盘'}</button>
            </>}
            <p role="status">{error || (loading ? '复盘生成中，你可以继续浏览。' : '')}</p>
        </div>
    </section>
}
