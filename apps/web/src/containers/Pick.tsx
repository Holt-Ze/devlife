import { useTalentPuller, useTalentPicker } from '@remake/hooks'
import { useTalentSubmit, useSubmitIsEnable } from '@remake/hooks'
import { PullCount, dev } from '@/config'
import { toastMsg } from '@/toast'
import Talent from '@/components/Talent'
import { talents as talentData } from '@remake/data'
import './Pick.css'

export function Pick() {
    const [pulled, puller] = useTalentPuller()
    const [talents, picker] = useTalentPicker()
    const { enabled, min, max } = useSubmitIsEnable()
    const submit = useTalentSubmit()
    const select = (id: number) => {
        const result = picker(id)
        if (result.type === 'ne')
            toastMsg(`最多选择 ${max} 个天赋`, 'pick-limit')
        if (result.type === 'ex')
            toastMsg(
                `与「${talentData.get(result.talent)?.name}」互斥`,
                'pick-exclude',
            )
    }
    const msg = enabled
        ? '下一步'
        : `请选取 ${min == max ? min : `${min}~${max}`} 个天赋`
    const handleSubmit = () => {
        if (enabled) return submit()
        toastMsg(msg, 'pick-toast')
    }
    if (!pulled)
        return (
            <div className="screen talent-pick">
                <div className="step-heading">
                    <div className="eyebrow">01 / TALENTS</div>
                    <h2>你的初始技能包</h2>
                    <p>
                        每个人都有擅长的事。从十个天赋中选出三个，带进这段旅程。
                    </p>
                </div>
                <div className="pick-intro">
                    <span className="pick-icon">{'{ ? }'}</span>
                    <p>好奇心、边界感，还是一点隐藏的天赋？</p>
                    <button
                        className="primary font-mono focus"
                        onClick={() => puller()}
                    >
                        抽取 {PullCount} 个天赋
                    </button>
                </div>
            </div>
        )
    const ps = dev.locked
        ? Array.from(new Set([...dev.locked, ...pulled]))
        : pulled
    return (
        <div className="screen talent-pick">
            <div className="step-heading">
                <div className="eyebrow">01 / TALENTS</div>
                <h2>
                    选择你的天赋{' '}
                    <span className="selection-count">
                        {talents.size} / {max}
                    </span>
                </h2>
                <p>选择三项。不同的组合，会让相同的起点走向不同的结局。</p>
            </div>
            <ul className="talent-list">
                {ps.map((id) => (
                    <li
                        key={id}
                        role="button"
                        tabIndex={0}
                        aria-pressed={talents.has(id)}
                        onClick={() => select(id)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                select(id)
                            }
                        }}
                    >
                        <Talent id={id} selected={talents.has(id)} />
                    </li>
                ))}
            </ul>
            <button
                className={enabled ? 'primary' : 'error'}
                onClick={handleSubmit}
            >
                {msg}
            </button>
        </div>
    )
}
export default Pick
