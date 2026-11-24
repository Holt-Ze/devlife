import { CampusQuarters, CareerQuarters, type Major } from '@remake/data'
import { campusStage, journeyTime } from '@remake/data/etc/display'

export default function JourneyProgress({ age, major, events, ended }: {
    age: number
    major?: Major
    events: ReadonlySet<number>
    ended: boolean
}) {
    const duration = major ? CampusQuarters : CareerQuarters
    const quarter = Math.min(duration, Math.max(0, age))
    const percent = Math.round(100 * quarter / duration)
    const phase = major
        ? campusStage(quarter)
        : quarter >= CareerQuarters ? '生涯回望' : quarter >= 24 ? '长期发展' : quarter >= 12 ? '方向探索' : '入行积累'
    const pathways = major?.pathways.map(path => ({
        name: path.name,
        ready: path.evidence.some(id => events.has(id)),
    }))

    return (
        <section className="life-timeline" aria-label="人生进度">
            <div className="timeline-heading">
                <strong>人生进度 <small>· {ended ? '本局已结束' : phase}</small></strong>
                <span>{percent}%</span>
            </div>
            <progress
                aria-label={major ? '大学到职场的旅程' : '九年职业旅程'}
                value={quarter}
                max={duration}
                aria-valuetext={`已走过 ${quarter} 个季度，共 ${duration} 个季度`}
            />
            <div className="timeline-scale">
                <span>{age < 0 ? major ? '等待报到' : '等待入职' : journeyTime(quarter, major?.id)}</span>
                <span>{quarter} / {duration} 季度</span>
            </div>
            {major && pathways && (
                <details className="journey-pathways">
                    <summary>
                        <span>{major.name}</span>
                        <span>{pathways.filter(path => path.ready).length} / {pathways.length} 个专项去向已解锁</span>
                    </summary>
                    <ul>
                        {pathways.map(path => (
                            <li key={path.name}>
                                <strong>{path.name}</strong>
                                <span>{path.ready ? '已有相关经历' : '完成对应实践或毕设后解锁'}</span>
                            </li>
                        ))}
                    </ul>
                </details>
            )}
        </section>
    )
}
