import { useState, useRef, useCallback } from 'react'
import { useLayoutEffect, useEffect } from 'react'
import { useNext, useGotoSummary, type Log } from '@remake/hooks'
import { useJudge } from '@/hooks/judge'
import { achievements, events, talents, CareerQuarters } from '@remake/data'
import { properties, quarterLabel } from '@remake/data/etc/display'
import { AutoInterval } from '@/config'
import { format } from '@remake/vitex'
import { toastAchvs } from '@/toast/Achv'
import Dialogue, { ChoiceChanges } from '@/components/Dialogue'
import './Play.css'

function LogTalent({ id }: { id: number }) {
    const { name, description, grade } = talents.get(id)!
    return (
        <li className={`grade-${grade}`}>
            <span className="tag font-mono">[天赋]</span>
            <span className="name">{name}</span>
            <span className="description">{description}</span>
        </li>
    )
}

function LogTalents({ items }: { items: number[] }) {
    if (items.length === 0) return null
    const els = items.map((id) => <LogTalent key={id} id={id} />)
    return <ul className="log-inner log-talents">{els}</ul>
}

const year = new Date().getFullYear()
interface LogEventProps {
    id: number
    post: boolean
    index: number
}
function LogEvent({ id, post, index }: LogEventProps) {
    let { event, postEvent, grade, format: f } = events.get(id)!
    if (f) {
        const g = (key: string) => ({ CurrentYear: year + index })[key]
        event = format(event, g)
        if (post && postEvent) postEvent = format(postEvent, g)
    }
    return (
        <>
            <li className={`grade-${grade}`}>{event}</li>
            {post && postEvent && (
                <li className={`grade-${grade}`}>{postEvent}</li>
            )}
        </>
    )
}

function LogEvents({ items, index }: { items: number[]; index: number }) {
    const last = items.length - 1
    const els = items.map((id, i) => (
        <LogEvent key={id} id={id} post={i == last} index={index} />
    ))
    return <ul className="log-inner log-events">{els}</ul>
}

function LogAchievement({ id }: { id: number }) {
    const { name, description, grade } = achievements.get(id)!
    return (
        <li className={`grade-${grade}`}>
            <span className="tag font-mono">[成就]</span>
            <span className="name">{name}</span>
            <span className="description">{description}</span>
        </li>
    )
}

function LogAchievements({ items }: { items: number[] }) {
    if (items.length === 0) return null
    const els = items.map((id) => <LogAchievement key={id} id={id} />)
    return <ul className="log-inner log-achievements">{els}</ul>
}

function Log({ log, index }: { log: Log; index: number }) {
    return (
        <li className="log">
            <span className="age font-mono">{quarterLabel(log.age)}</span>
            <div className="content">
                {log.decision && (
                    <div className="log-decision">
                        <span className="decision-label">
                            你选择了：
                            {
                                events
                                    .get(log.decision.event)
                                    ?.choices?.find(
                                        (choice) =>
                                            choice.id === log.decision!.choice,
                                    )?.label
                            }
                        </span>
                        <ChoiceChanges changes={log.decision.changes} />
                    </div>
                )}
                <LogTalents items={log.talents} />
                <LogEvents items={log.events} index={index} />
                <LogAchievements items={log.achievements} />
            </div>
        </li>
    )
}

interface PropProps {
    prop: keyof typeof properties
    value: number
    grade: number
}

function Prop({ prop, value, grade }: PropProps) {
    const prevRef = useRef<number>(value)
    const [trend, setTrend] = useState<'up' | 'down' | 'normal'>('normal')
    const [flip, setFlip] = useState(0)
    const [displayValue, setDisplayValue] = useState<number>(value)
    useEffect(() => {
        const prev = prevRef.current
        if (value === prev) return
        const startValue = prevRef.current
        prevRef.current = value
        setTrend(value > prev ? 'up' : 'down')
        setFlip((f) => (f + 1) % 2)
        let startTimestamp: number | null = null
        const duration = 400
        let end = false
        const step = (timestamp: number) => {
            if (!startTimestamp) startTimestamp = timestamp
            const progress = timestamp - startTimestamp
            const progressRatio = Math.min(progress / duration, 1)
            const easeOutQuad = progressRatio * (2 - progressRatio)
            const currentDec = startValue + (value - startValue) * easeOutQuad
            setDisplayValue(Math.round(currentDec))
            if (!end && progress < duration) requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
        const timer = setTimeout(() => setTrend('normal'), 2000)
        return () => {
            clearTimeout(timer)
            setDisplayValue(value)
            end = true
        }
    }, [value])

    return (
        <li className={`${prop} grade-${grade} trend-${trend}-${flip}`}>
            <span className="name">{properties[prop]}</span>
            <span className="value font-mono">{displayValue}</span>
        </li>
    )
}

function Properties() {
    const judges = useJudge()
    return (
        <ul className="properties">
            {judges.map(([key, { value, grade }]) => (
                <Prop key={key} prop={key} value={value} grade={grade} />
            ))}
        </ul>
    )
}

export function Play() {
    const [{ logs, ended, pending, choices }, next, choose] = useNext()
    const decisionCount = logs.filter((log) => log.decision).length
    const [autoVersion, setAutoVersion] = useState<number | null>(null)
    const auto = autoVersion === decisionCount && !pending && !ended
    const [history, setHistory] = useState(false)
    const logRef = useRef<HTMLUListElement>(null)
    const autoRef = useRef(0)
    const processRef = useRef(false)
    const gotoSummary = useGotoSummary()
    const handleNext = useCallback(() => {
        if (ended || pending) return
        if (processRef.current) return
        processRef.current = true
        const achievements = next()
        toastAchvs(achievements)
        processRef.current = false
    }, [ended, pending, next])
    const handleChoose = useCallback(
        (choice: string) => {
            if (!pending) return
            setAutoVersion(null)
            setHistory(false)
            toastAchvs(choose(pending.instance, choice))
        },
        [pending, choose],
    )
    const handleGotoSummary = useCallback(() => {
        if (!ended) return
        const achievements = gotoSummary()
        toastAchvs(achievements)
    }, [ended, gotoSummary])
    useLayoutEffect(() => {
        requestAnimationFrame(() => {
            if (!logRef.current) return
            logRef.current.scrollTop = logRef.current.scrollHeight
        })
    }, [logs, history])
    useEffect(() => {
        if (!auto || pending || ended) window.clearInterval(autoRef.current)
        else autoRef.current = window.setInterval(handleNext, AutoInterval)
        return () => window.clearInterval(autoRef.current)
    }, [auto, pending, ended, handleNext])
    return (
        <div className="screen play">
            <div className="career-progress">
                <strong>
                    {ended
                        ? '本次生涯已完成'
                        : logs.length
                          ? quarterLabel(logs.at(-1)!.age)
                          : '等待入职'}
                </strong>
                <progress
                    aria-label="职业生涯进度"
                    value={Math.max(0, logs.at(-1)?.age ?? 0)}
                    max={CareerQuarters}
                />
                <span>
                    {Math.max(0, logs.at(-1)?.age ?? 0)} / {CareerQuarters} 季度
                </span>
            </div>
            <Properties />
            {pending && !history ? (
                <Dialogue
                    pending={pending}
                    choices={choices}
                    onChoose={handleChoose}
                    onHistory={() => setHistory(true)}
                />
            ) : (
                <ul className="logs hide-scrollbar" ref={logRef}>
                    {!logs.length && (
                        <li className="log-empty">
                            &gt; 开发环境就绪。点击「下一季度」开始你的第一天。
                        </li>
                    )}
                    {logs.map((log, index) => (
                        <Log key={index} log={log} index={index} />
                    ))}
                </ul>
            )}
            {(!pending || history) && (
                <div className="controls">
                    {pending && (
                        <button
                            className="secondary"
                            onClick={() => setHistory(!history)}
                        >
                            {history ? '返回对话，做出选择' : '回看此前经历'}
                        </button>
                    )}
                    {!ended && !pending && (
                        <button className="primary" onClick={handleNext}>
                            下一季度 →
                        </button>
                    )}
                    {!ended && !pending && (
                        <button
                            className="secondary"
                            onClick={() =>
                                setAutoVersion(auto ? null : decisionCount)
                            }
                        >
                            {auto ? '暂停运行' : '自动运行'}
                        </button>
                    )}
                    {ended && (
                        <button className="primary" onClick={handleGotoSummary}>
                            查看职业复盘
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}

export default Play
