import { useGoHome } from '@remake/hooks'
import { specialThanks, SpecialThanksGroup as Group } from '@remake/data'
import type { SpecialThanks } from '@remake/data'
import { shuffle } from '@remake/vitex'
import './Thanks.css'

const groups = Map.groupBy(specialThanks, item => item.group)

export function Person({ item }: { item: SpecialThanks }) {
    return (
        <li
            className="person"
            style={
                {
                    '--custom-color': item.color,
                } as React.CSSProperties
            }
        >
            <span className="name">{item.name}</span>
            {item.comment && <span className="comment">{item.comment}</span>}
        </li>
    )
}

export function Thanks() {
    const goHome = useGoHome()
    const group1 = shuffle(groups.get(Group.G1) ?? [])
    const group2 = shuffle(groups.get(Group.G2) ?? [])
    return (
        <div className="screen thanks">
            <div className="step-heading"><h2>关于大学生生涯模拟器</h2><p>通过专业课程、实践和毕业后的经历，探索每个选择带来的机会与代价。</p></div>
            <a className="project-source" href="https://github.com/VickScarlet/remake" target="_blank" rel="noreferrer">上游项目：VickScarlet/remake · MIT License ↗</a>
            <button className="primary" onClick={goHome}>
                返回
            </button>
            <ul className="group group-1 hide-scrollbar">
                {group1.map((item, index) => (
                    <Person key={index} item={item} />
                ))}
            </ul>
            <ul className="group group-2 hide-scrollbar">
                {group2.map((item, index) => (
                    <Person key={index} item={item} />
                ))}
            </ul>
        </div>
    )
}
export default Thanks
