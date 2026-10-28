import { PullCount } from '@/config'
import { useModeChoose } from '@remake/hooks'
import './Mode.css'

export function Mode() {
    const [Mode, choose] = useModeChoose()
    return (
        <div className="screen mode">
            <div className="step-heading"><div className="eyebrow">NEW BRANCH</div><h2>从哪里开始？</h2><p>配置一位新开发者，或带着不同的背景进入职场。</p></div>
            <button onClick={() => choose(Mode.Classic)}>
                <div className="name">自由创建</div>
                <div className="description">
                    <span>{PullCount} 连抽天赋</span>
                    <span>自由分配属性</span>
                </div>
            </button>
            <button onClick={() => choose(Mode.Celebrity)}>
                <div className="name">职业出身</div>
                <div className="description">
                    <span>科班、自学、转行，六种职业起点</span>
                </div>
            </button>
        </div>
    )
}

export default Mode
