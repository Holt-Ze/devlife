import { useEffect, useRef } from 'react'
import {
    usePicked,
    useEnd,
    useProfile,
    useIsClassic,
    useGameState,
} from '@remake/hooks'
import { endings, events, majors, type MajorId } from '@remake/data'
import { useEndJudge } from '@/hooks/judge'
import {
    attributeLabels,
    judgeDisplay,
    journeyTime,
} from '@remake/data/etc/display'
import EventReview from '@/components/EventReview'
import CareerAnalysis from '@/components/CareerAnalysis'
import { ChoiceChanges } from '@/components/Dialogue'
import { toastAchvs, toastMsg } from '@/toast'
import Talent from '@/components/Talent'
import './Summary.css'
import { saveCareer } from '@/storage/postgres'

function Judges({ major }: { major?: MajorId }) {
    const judges = useEndJudge()
    const labels = attributeLabels(major)
    return (
        <ul className="judge-list">
            {judges.map(([key, { value, grade, level }]) => (
                <li className={`${key} grade-${grade}`} key={key}>
                    <span className="property">{labels[key]}</span>
                    <span className="value font-mono">{value}</span>
                    <span className="level">{major && key === 'age' ? journeyTime(value, major) : judgeDisplay(key, level)}</span>
                </li>
            ))}
        </ul>
    )
}

interface TalentListProps {
    picked: Set<number>
    picker: (id: number) => void
}
function TalentList({ picked, picker }: TalentListProps) {
    const [profile] = useProfile()
    const talents = usePicked()
    const hasInitialized = useRef(false)
    useEffect(() => {
        if (!profile.locked) return
        if (!hasInitialized.current) {
            for (const id of profile.locked) {
                if (talents.has(id) && !picked.has(id)) {
                    picker(id)
                }
            }
            hasInitialized.current = true
        }
    }, [profile.locked, talents, picked, picker])

    return (
        <ul className="talent-list">
            {Array.from(talents, (id) => (
                <li key={id} onClick={() => picker(id)}>
                    <Talent id={id} selected={picked.has(id)} />
                </li>
            ))}
        </ul>
    )
}

export default function Summary() {
    const state = useGameState()!
    const major = state.major ? majors.get(state.major) : undefined
    const archiveId = useRef(crypto.randomUUID())
    useEffect(() => {
        void saveCareer(archiveId.current, state).then(ok => {
            if (!ok) toastMsg('生涯历史暂未保存到服务端，本地档案仍会保留', 'career-save-error')
        })
    }, [state])
    const ending = Array.from(endings).find(([id]) => state.events.has(id))?.[1]
    const matchedPath = major?.pathways.find(path => path.name === ending?.name)
    const evidence = matchedPath ? state.decisions.flatMap(decision => {
        const choice = events.get(decision.event)?.choices?.find(option => option.id === decision.choice)
        return choice && matchedPath.evidence.includes(choice.event) ? [choice.label] : []
    }) : []
    const isClassic = useIsClassic()
    const [locked, picker, end] = useEnd()
    const handlePicker = (id: number) => {
        if (isClassic) picker(id)
        else toastMsg('职业出身的天赋不可锁定', 'summary-toast')
    }
    const handleEnd = () => {
        const achievements = end()
        toastAchvs(achievements)
    }
    return (
        <div className="screen summary">
            <div className="ending-card">
                <div className="eyebrow">{major ? major.name + ' · 生涯复盘' : '程序员职场篇 · 职业复盘'}</div>
                <h2>{ending?.name ?? '本次生涯已完成'}</h2>
                <p>{ending?.description}</p>
                {evidence.length > 0 && (
                    <p className="ending-evidence">你通过{evidence.map(label => `「${label}」`).join('、')}积累了申请这个岗位的经历。</p>
                )}
            </div>
            <CareerAnalysis final={state.props.current} major={state.major} />
            <EventReview final={state.props.current} major={state.major} />
            <Judges major={state.major} />
            <p className="alloc-hint">
                各项为结束时数值。成长分根据历程中的属性峰值计算，仅记录这段经历。
            </p>
            {state.decisions.length > 0 && (
                <section className="decision-history">
                    <h3>塑造这段生涯的 {state.decisions.length} 次决定</h3>
                    <ol>
                        {state.decisions.map((decision) => {
                            const scene = events.get(decision.event)
                            const choice = scene?.choices?.find(option => option.id === decision.choice)
                            return (
                                <li key={decision.instance}>
                                    <time>{journeyTime(decision.quarter, state.major)} · {scene?.dialogue?.title}</time>
                                    <strong>{choice?.label}</strong>
                                    {choice && <p>{events.get(choice.event)?.event}</p>}
                                    <ChoiceChanges changes={decision.changes} major={state.major} />
                                </li>
                            )
                        })}
                    </ol>
                </section>
            )}
            <div className="section">
                <div className="title">
                    {isClassic
                        ? '保留一项天赋，下一段生涯继续携带'
                        : '职业出身的天赋不可锁定'}
                </div>
                <TalentList picked={locked} picker={handlePicker} />
            </div>
            <button className="primary" onClick={handleEnd}>
                保存档案，返回首页
            </button>
        </div>
    )
}
