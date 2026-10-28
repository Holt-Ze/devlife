import { useState } from 'react'
import { useAllocator, usePointRandomizer, useLeftPoints } from '@remake/hooks'
import { usePicked, useReplaced, useStart, useIsClassic } from '@remake/hooks'
import type { AdditionalPoint } from '@remake/hooks'
import { properties } from '@remake/data/etc/display'
import { keys } from '@remake/vitex'
import { judgeGradeByValue } from '@/config'
import { talents } from '@remake/data'
import { toastAchvs, toastMsg } from '@/toast'
import Replaced from '@/components/Replaced'
import './Alloc.css'

interface AllocInputProps {
    point: number
    label: string
    onChange: (point: number) => void
}

function AllocInput(props: AllocInputProps) {
    return (
        <div className="allocation-input">
            <button
                aria-label={`减少${props.label}`}
                onClick={() => props.onChange(props.point - 1)}
            >
                −
            </button>
            <input
                className="font-mono"
                type="number"
                aria-label={props.label}
                value={props.point}
                onChange={(e) => props.onChange(Number(e.target.value))}
            />
            <button
                aria-label={`增加${props.label}`}
                onClick={() => props.onChange(props.point + 1)}
            >
                +
            </button>
        </div>
    )
}

interface PointsDetailProps {
    base: number
    source: AdditionalPoint[]
    fixed?: boolean
}

function PointsDetail({ base, source, fixed }: PointsDetailProps) {
    return (
        <ul className="points-detail">
            <li>
                <span>{fixed ? '固定' : '基础'}</span>
                <span className="font-mono">{base}</span>
            </li>
            {source.map(({ talent, points }) => (
                <li key={talent}>
                    <span>{talents.get(talent)?.name ?? talent}</span>
                    <span className="font-mono">{points}</span>
                </li>
            ))}
        </ul>
    )
}

export function Alloc() {
    const isClassic = useIsClassic()
    const picked = usePicked()
    const {
        talents: { chains },
        additionalPoints: { source },
    } = useReplaced()
    const { base, left, total } = useLeftPoints()
    const [{ alloc, final, base: ba }, allocator] = useAllocator()
    const random = usePointRandomizer()
    const start = useStart()
    const [showDetail, setShowDetail] = useState(false)
    const handleNext = () => {
        if (left != 0) return toastMsg('还有剩余点数未分配', 'alloc-toast')
        const achievements = start()
        toastAchvs(achievements)
    }
    return (
        <div className="screen point-allocation">
            <div className="step-heading">
                <div className="eyebrow">02 / CONFIGURE</div>
                <h2>配置你的起点</h2>
                <p>技术解决问题，沟通连接团队。也别忘了给健康留一点余地。</p>
            </div>
            <ul className="talent-list">
                {Array.from(picked, (id) => (
                    <li key={id}>
                        <Replaced id={id} chains={chains.get(id)} />
                    </li>
                ))}
            </ul>
            <ul className={`alloc ${isClassic ? 'classic' : 'modify'}`}>
                <li className={`left left-${left}`}>
                    <span className="name">
                        {isClassic ? '剩余点数' : '剩余加点'}
                    </span>
                    <button
                        className="font-mono"
                        onClick={() => setShowDetail(!showDetail)}
                    >
                        {left}
                    </button>
                    {showDetail && (
                        <PointsDetail
                            base={base}
                            source={source}
                            fixed={!isClassic}
                        />
                    )}
                </li>
                {keys(alloc).map((key) => (
                    <li
                        key={key}
                        className={`property grade-${judgeGradeByValue(key, final[key])}`}
                    >
                        <span className="name">
                            {properties[key]}
                            {!isClassic && (
                                <span className="font-mono">[{ba[key]}]</span>
                            )}
                        </span>
                        {!isClassic && (
                            <span className="font-mono">{final[key]}</span>
                        )}
                        {(isClassic || total !== 0) && (
                            <AllocInput
                                label={properties[key]}
                                point={alloc[key]}
                                onChange={(value) => allocator(key, value)}
                            />
                        )}
                    </li>
                ))}
            </ul>
            <div className="controls">
                {(isClassic || total !== 0) && (
                    <button className="secondary" onClick={() => random()}>
                        随机分配
                    </button>
                )}
                <button
                    className={left ? 'error' : 'primary'}
                    onClick={handleNext}
                >
                    开始职业生涯
                </button>
            </div>
            <p className="alloc-hint">
                心态初始为
                5；积蓄为抽象储备点数。健康或心态耗尽将提前休整，最长运行 36
                个季度。
            </p>
        </div>
    )
}
export default Alloc
