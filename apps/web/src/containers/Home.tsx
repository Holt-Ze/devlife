import { CampusQuarters, majors } from '@remake/data'
import { useRemake, useFeatures, useGoAchv, useGoThanks } from '@remake/hooks'
import Github from '@/components/Github'
import './Home.css'

export default function Home() {
    const startCampus = useRemake(true)
    const startProgrammer = useRemake()
    const features = useFeatures()
    const goAchv = useGoAchv()
    const goThanks = useGoThanks()
    const destinations = [...majors.values()].reduce((total, major) => total + major.endingEvents.length, 0)

    return (
        <div className="screen home">
            <div className="home-hero">
                <div className="hero-copy">
                    <h1>大学生<span>生涯模拟器</span></h1>
                    <p>
                        从选择专业开始。上课、做项目、试一份实习，看看四年里的决定会把你带到毕业后的哪一站。
                    </p>
                    <button className="primary" onClick={startCampus}>
                        选择专业 <span aria-hidden="true">→</span>
                    </button>
                </div>
            </div>
            <div className="home-footer">
                <dl className="home-facts">
                    <div><dt>个可玩专业</dt><dd>{majors.size}</dd></div>
                    <div><dt>季度完整旅程</dt><dd>{CampusQuarters}</dd></div>
                    <div><dt>种毕业发展去向</dt><dd>{destinations}</dd></div>
                </dl>
                <div className="home-actions">
                    <button className="secondary" onClick={startProgrammer}>程序员职场篇</button>
                    {features && <>
                        <button className="secondary" onClick={goAchv}>成就档案</button>
                        <button className="secondary" onClick={goThanks}>关于项目</button>
                        <Github />
                    </>}
                </div>
            </div>
        </div>
    )
}
