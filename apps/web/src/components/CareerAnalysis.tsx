import { useLogs, type Allocation } from '@remake/hooks'
import type { MajorId } from '@remake/data'
import { attributeLabels } from '@remake/data/etc/display'
import { JudgeLineMap } from '@/config'
import './CareerAnalysis.css'

const axes = ['intelligence', 'charm', 'money', 'spirit', 'strength'] as const
const rings = [0.25, 0.5, 0.75, 1]
function point(index: number, ratio: number) {
    const angle = (index * 2 * Math.PI) / axes.length - Math.PI / 2
    return {
        x: 160 + 94 * ratio * Math.cos(angle),
        y: 132 + 94 * ratio * Math.sin(angle),
    }
}

function polygon(ratios: readonly number[]) {
    return ratios
        .map((ratio, index) => {
            const { x, y } = point(index, ratio)
            return `${x},${y}`
        })
        .join(' ')
}

export default function CareerAnalysis({ final, major }: { final: Allocation; major?: MajorId }) {
    const scores = axes.map((key) => ({
        key,
        ratio: Math.min(1, Math.max(0, final[key] / JudgeLineMap[key].at(-1)!)),
    }))
    const logs = useLogs()
    const baseline = logs[0]?.props
    const properties = attributeLabels(major)
    const start = major ? '报到日' : '入职日'
    const signed = (value: number) => value > 0 ? '+' + value : String(value)

    return (
        <section className="career-analysis" aria-labelledby="career-analysis-title">
            <figure className="career-radar">
                <h3 id="career-analysis-title">五维属性雷达</h3>
                <svg viewBox="0 0 320 254" aria-hidden="true">
                    {rings.map((ring) => (
                        <polygon
                            className="radar-grid"
                            key={ring}
                            points={polygon(axes.map(() => ring))}
                        />
                    ))}
                    {scores.map(({ key }, index) => {
                        const end = point(index, 1)
                        return <line className="radar-grid" key={key} x1="160" y1="132" x2={end.x} y2={end.y} />
                    })}
                    <polygon className="radar-profile" points={polygon(scores.map(({ ratio }) => ratio))} />
                    {scores.map(({ key, ratio }, index) => {
                        const marker = point(index, ratio)
                        const label = point(index, 1.3)
                        return (
                            <g key={key}>
                                <circle className="radar-marker" cx={marker.x} cy={marker.y} r="4" />
                                <text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle">
                                    {properties[key]} {final[key]}
                                </text>
                            </g>
                        )
                    })}
                </svg>
                <figcaption>
                    标签为结算原值。图形按各项最高评级门槛换算，达到门槛即显示为满格。
                </figcaption>
            </figure>
            <div className="career-advice">
                <h3>从{start}到结算</h3>
                <p>以{start}结束时的数值为起点。「选择贡献」累计每次主动选择产生的直接变化。</p>
                <table className="attribute-growth"><thead><tr><th>属性</th><th>净变化</th><th>选择贡献</th></tr></thead>
                    <tbody>{axes.map(key => <tr key={key}>
                        <th scope="row">{properties[key]}</th>
                        <td>{baseline ? signed(final[key] - baseline[key]) : '—'}</td>
                        <td>{signed(logs.reduce((sum, log) => sum + (log.decision?.changes[key] ?? 0), 0))}</td>
                    </tr>)}</tbody>
                </table>
            </div>
        </section>
    )
}
