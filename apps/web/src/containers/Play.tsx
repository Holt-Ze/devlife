import { useState, useRef, useCallback } from 'react'
import { useLayoutEffect, useEffect } from 'react'
import { useNext, useGotoSummary, useGameState, type Log } from '@remake/hooks'
import { useJudge } from '@/hooks/judge'
import { achievements, events, majors, talents, type MajorId } from '@remake/data'
import { attributeLabels, journeyTime } from '@remake/data/etc/display'
import { AutoInterval } from '@/config'
import { format } from '@remake/vitex'
import { toastAchvs } from '@/toast/Achv'
import Dialogue, { ChoiceChanges } from '@/components/Dialogue'
import JourneyProgress from '@/components/JourneyProgress'
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

function Log({ log, index, major }: { log: Log; index: number; major?: MajorId }) {
    return (
        <li className="log">
            <span className="age">{journeyTime(log.age, major)}</span>
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
                        <ChoiceChanges changes={log.decision.changes} major={major} />
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
    prop: string
    label: string
    value: number
    grade: number
}

function Prop({ prop, label, value, grade }: PropProps) {
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
            <span className="name">{label}</span>
            <span className="value font-mono">{displayValue}</span>
        </li>
    )
}

function Properties({ major }: { major?: MajorId }) {
    const judges = useJudge()
    const labels = attributeLabels(major)
    return (
        <ul className="properties">
            {judges.map(([key, { value, grade }]) => (
                <Prop key={key} prop={key} label={labels[key]} value={value} grade={grade} />
            ))}
        </ul>
    )
}

export function Play() {
    const [{ logs, ended, pending, choices }, next, choose] = useNext()
    const state = useGameState()!
    const major = state.major ? majors.get(state.major) : undefined
    const [auto, setAuto] = useState(false)
    const [history, setHistory] = useState(false)
    const logRef = useRef<HTMLUListElement>(null)
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
        if (!auto || pending || ended) return
        const timer = window.setInterval(handleNext, AutoInterval)
        return () => window.clearInterval(timer)
    }, [auto, pending, ended, handleNext])
    return (
        <div className="screen play">
            <JourneyProgress age={state.props.current.age} major={major} events={state.events} ended={ended} />
            <Properties major={state.major} />
            {pending && !history ? (
                <Dialogue
                    major={state.major}
                    pending={pending}
                    choices={choices}
                    resumeAuto={auto}
                    onChoose={handleChoose}
                    onHistory={() => setHistory(true)}
                />
            ) : (
                <ul className="logs hide-scrollbar" ref={logRef}>
                    {!logs.length && (
                        <li className="log-empty">
                            {major ? '点击「大学报到」，开启你的第一天。' : '点击「下一季度」，开始你的入职日。'}
                        </li>
                    )}
                    {logs.map((log, index) => (
                        <Log key={index} log={log} index={index} major={state.major} />
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
                            {major && !logs.length ? '大学报到' : '下一季度'} →
                        </button>
                    )}
                    {!ended && !pending && (
                        <button
                            className="secondary"
                            onClick={() => setAuto(!auto)}
                        >
                            {auto ? '暂停运行' : '自动运行'}
                        </button>
                    )}
                    {ended && (
                        <button className="primary" onClick={handleGotoSummary}>
                            {major ? '查看生涯复盘' : '查看职业复盘'}
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}

export default Play
