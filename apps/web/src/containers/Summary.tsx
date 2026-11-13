import { useEffect, useRef } from 'react'
import {
    usePicked,
    useEnd,
    useProfile,
    useIsClassic,
    useGameState,
} from '@remake/hooks'
import { endings } from '@remake/data'
import { useEndJudge } from '@/hooks/judge'
import {
    properties,
    judgeDisplay,
    quarterLabel,
} from '@remake/data/etc/display'
import { events } from '@remake/data'
import { ChoiceChanges } from '@/components/Dialogue'
import { toastAchvs, toastMsg } from '@/toast'
import Talent from '@/components/Talent'
import './Summary.css'
import { saveCareer } from '@/storage/postgres'

function Judges() {
    const judges = useEndJudge()
    return (
        <ul className="judge-list">
            {judges.map(([key, { value, grade, level }]) => (
                <li className={`${key} grade-${grade}`} key={key}>
                    <span className="property">{properties[key]}</span>
                    <span className="value font-mono">{value}</span>
                    <span className="level">{judgeDisplay(key, level)}</span>
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
    const archiveId = useRef(crypto.randomUUID())
    useEffect(() => {
        void saveCareer(archiveId.current, state).then(ok => {
            if (!ok) toastMsg('生涯历史暂未保存到服务端，本地档案仍会保留', 'career-save-error')
        })
    }, [state])
    const ending = Array.from(endings).find(([id]) => state.events.has(id))?.[1]
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
                <div className="eyebrow">CAREER RETROSPECTIVE / 职业复盘</div>
                <h2>{ending?.name ?? '本次生涯已完成'}</h2>
                <p>{ending?.description}</p>
            </div>
            <Judges />
            <p className="alloc-hint">
                各项为结束时数值。成长分根据历程中的属性峰值计算，仅记录这段经历。
            </p>
            {state.decisions.length > 0 && (
                <section className="decision-history">
                    <h3>塑造这段生涯的 {state.decisions.length} 次决定</h3>
                    <ol>
                        {state.decisions.map((decision) => (
                            <li key={decision.instance}>
                                <time>
                                    {quarterLabel(decision.quarter)} ·{' '}
                                    {
                                        events.get(decision.event)?.dialogue
                                            ?.title
                                    }
                                </time>
                                <strong>
                                    {
                                        events
                                            .get(decision.event)
                                            ?.choices?.find(
                                                (choice) =>
                                                    choice.id ===
                                                    decision.choice,
                                            )?.label
                                    }
                                </strong>
                                <ChoiceChanges changes={decision.changes} />
                            </li>
                        ))}
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
