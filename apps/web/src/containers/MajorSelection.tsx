import { majors } from '@remake/data'
import { useChooseMajor, useProfile } from '@remake/hooks'
import './MajorSelection.css'

export default function MajorSelection() {
    const choose = useChooseMajor()
    const [profile] = useProfile()

    return (
        <section className="screen major-selection" aria-labelledby="major-title">
            <header>
                <h1 id="major-title">选择你的专业</h1>
                <p>从大一报到走到毕业后第一年。实践和毕业作品会为你打开不同的去向。</p>
            </header>
            <ul className="major-grid">
                {[...majors.values()].map(major => {
                    const discovered = major.endingEvents.filter(id => profile.events.has(id)).length
                    return (
                        <li key={major.id}>
                            <button
                                type="button"
                                className="major-card"
                                data-major={major.id}
                                aria-labelledby={`major-${major.id}`}
                                aria-describedby={`major-detail-${major.id}`}
                                onClick={() => choose(major.id)}
                            >
                                <span className="major-card-category">{major.category}</span>
                                <strong id={`major-${major.id}`}>{major.name}</strong>
                                <span className="major-card-copy" id={`major-detail-${major.id}`}>{major.description}</span>
                                <span className="major-card-paths">
                                    {major.pathways.map(path => <span key={path.name}>{path.name}</span>)}
                                </span>
                                {discovered > 0 && (
                                    <span className="major-card-record">已探索 {discovered} / {major.endingEvents.length} 个去向</span>
                                )}
                                <span className="major-card-arrow" aria-hidden="true">→</span>
                            </button>
                        </li>
                    )
                })}
            </ul>
        </section>
    )
}
