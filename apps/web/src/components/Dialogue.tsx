import { useEffect, useRef } from 'react'
import { events, type EventChoice, type MajorId } from '@remake/data'
import type { Allocation, PendingChoice } from '@remake/hooks'
import { attributeLabels, journeyTime } from '@remake/data/etc/display'
import './Dialogue.css'

export function ChoiceChanges({ changes, major }: { changes: Partial<Allocation>; major?: MajorId }) {
    const properties = attributeLabels(major)
    return (
        <span className="choice-changes">
            {Object.entries(changes)
                .filter(([, value]) => value)
                .map(([key, value]) => (
                    <span
                        className={value! > 0 ? 'positive' : 'negative'}
                        key={key}
                    >
                        {properties[key as keyof Allocation]}{' '}
                        {value! > 0 ? '+' : ''}
                        {value}
                    </span>
                ))}
        </span>
    )
}

export default function Dialogue({
    major,
    pending,
    choices,
    resumeAuto,
    onChoose,
    onHistory,
}: {
    major?: MajorId
    pending: PendingChoice
    choices: readonly (EventChoice & { available: boolean })[]
    resumeAuto: boolean
    onChoose: (choice: string) => void
    onHistory: () => void
}) {
    const event = events.get(pending.event)!
    const dialogue = event.dialogue
    const title = useRef<HTMLHeadingElement>(null)
    useEffect(() => {
        title.current?.focus()
    }, [pending.instance])
    useEffect(() => {
        const keydown = (event: KeyboardEvent) => {
            if (event.altKey || event.ctrlKey || event.metaKey || event.repeat)
                return
            if (
                event.target instanceof HTMLInputElement ||
                event.target instanceof HTMLTextAreaElement
            )
                return
            const index = Number(event.key) - 1
            if (!Number.isInteger(index) || index < 0) return
            const choice = choices[index]
            if (!choice?.available) return
            event.preventDefault()
            onChoose(choice.id)
        }
        window.addEventListener('keydown', keydown)
        return () => window.removeEventListener('keydown', keydown)
    }, [choices, onChoose])
    return (
        <section className="dialogue-stage" aria-labelledby="dialogue-title">
            <div className="dialogue-scene-bar">
                <span className="eyebrow">
                    关键选择 · {journeyTime(pending.quarter, major)}
                </span>
                <button className="dialogue-history" onClick={onHistory}>
                    回看经历 ↗
                </button>
            </div>
            <div className="dialogue-scene">
                <aside className="dialogue-character" aria-hidden="true">
                    <div className="portrait-frame">
                        <span className="portrait-code">{'{ }'}</span>
                        <span className="portrait-monogram">
                            {dialogue?.portrait ?? '？'}
                        </span>
                        <span className="portrait-status">● ONLINE</span>
                    </div>
                    <span className="portrait-caption">
                        {dialogue?.role ?? '职业时刻'}
                    </span>
                </aside>
                <div className="dialogue-content">
                    <p className="dialogue-narration">{event.event}</p>
                    <div className="dialogue-speaker">
                        <strong>{dialogue?.speaker ?? '你'}</strong>
                        <span>{dialogue?.role ?? '内心独白'}</span>
                    </div>
                    <h2 id="dialogue-title" tabIndex={-1} ref={title}>
                        {dialogue?.title ?? '做出你的选择'}
                    </h2>
                    <p className="dialogue-line">
                        “{dialogue?.text ?? event.event}”
                    </p>
                </div>
            </div>
            <div className="dialogue-options" aria-label="对话选项">
                {choices.map((choice, index) => {
                    const effects = { ...events.get(choice.event)?.effect }
                    for (const [key, value] of Object.entries(
                        choice.effect ?? {},
                    ))
                        effects[key as keyof typeof effects] =
                            (effects[key as keyof typeof effects] ?? 0) + value
                    const changes: Partial<Allocation> = {}
                    const mapper = {
                        INT: 'intelligence',
                        CHR: 'charm',
                        STR: 'strength',
                        SPR: 'spirit',
                        MNY: 'money',
                    } as const
                    for (const [key, prop] of Object.entries(mapper)) {
                        const value = effects[key as keyof typeof mapper]
                        if (value) changes[prop] = value
                    }
                    return (
                        <button
                            key={choice.id}
                            className="dialogue-option"
                            disabled={!choice.available}
                            onClick={() => onChoose(choice.id)}
                        >
                            <span className="option-number font-mono">
                                {String(index + 1).padStart(2, '0')}
                            </span>
                            <span className="option-copy">
                                <span className="option-label">
                                    {choice.label}
                                </span>
                                <span className="option-description">
                                    {choice.available
                                        ? choice.description
                                        : `未解锁 · ${choice.lockedReason ?? '尚未满足条件'}`}
                                </span>
                                <ChoiceChanges changes={changes} major={major} />
                            </span>
                            <span className="option-arrow" aria-hidden="true">
                                {choice.available ? '↗' : '◇'}
                            </span>
                        </button>
                    )
                })}
            </div>
            <p className="dialogue-footnote">
                {resumeAuto && '选择后将继续自动运行 · '}
                选择将影响后续经历与职业结局{' '}
                <span className="font-mono">[1–{choices.length}]</span>
            </p>
        </section>
    )
}
