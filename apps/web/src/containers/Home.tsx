import { useRemake, useFeatures, useGoAchv, useGoThanks } from '@remake/hooks'
import ThemeToggle from '@/components/ThemeToggle'
import Github from '@/components/Github'
import './Home.css'

export default function Home() {
    const remake = useRemake()
    const features = useFeatures()
    const goAchv = useGoAchv()
    const goThanks = useGoThanks()
    return (
        <div className="screen home">
            <div className="hero-copy">
                <div className="eyebrow">
                    <span /> CAREER SIMULATION / v1.1
                </div>
                <h1>
                    程序员
                    <span>
                        模拟器<span className="cursor">_</span>
                    </span>
                </h1>
                <p className="hero-lead">
                    人生没有标准答案，
                    <br />
                    你的下一行，由你开始。
                </p>
                <p className="hero-description">
                    抽取天赋，做出选择。在代码、需求与生活之间，
                    <br className="desktop-break" />
                    运行一段属于你的程序员生涯。
                </p>
            </div>
            <div className="controls">
                <div>
                    <button className="primary focus" onClick={remake}>
                        <span className="font-mono">&gt;_</span> 启动新生涯{' '}
                        <span aria-hidden="true">↗</span>
                    </button>
                </div>
                {features && (
                    <div>
                        <button className="secondary" onClick={goAchv}>
                            成就档案
                        </button>
                        <button className="secondary" onClick={goThanks}>
                            关于项目
                        </button>
                    </div>
                )}
            </div>
            <div className="hero-preview" aria-label="游戏玩法预览">
                <div className="preview-title">
                    <span className="file-symbol">TS</span> my-career.ts{' '}
                    <span className="preview-dot" />
                </div>
                <div className="code-preview font-mono">
                    <div>
                        <i>01</i>
                        <span className="code-comment">
                            {'// 每一种起点，都有自己的可能'}
                        </span>
                    </div>
                    <div>
                        <i>02</i>
                        <span>
                            <b>const</b> developer = {'{'}
                        </span>
                    </div>
                    <div>
                        <i>03</i>
                        <span>
                            　talents: <em>{"['好奇心', '一点运气']"}</em>,
                        </span>
                    </div>
                    <div>
                        <i>04</i>
                        <span>
                            　experience: <strong>0</strong>,
                        </span>
                    </div>
                    <div>
                        <i>05</i>
                        <span>
                            　possibilities: <strong>Infinity</strong>
                        </span>
                    </div>
                    <div>
                        <i>06</i>
                        <span>{'};'}</span>
                    </div>
                    <div>
                        <i>07</i>
                        <span>&nbsp;</span>
                    </div>
                    <div>
                        <i>08</i>
                        <span>
                            <b>await</b> life.
                            <span className="code-function">run</span>
                            (developer);
                        </span>
                    </div>
                </div>
                <div className="preview-terminal">
                    <span className="terminal-label">
                        TERMINAL <span>bash</span>
                    </span>
                    <p>
                        <span>➜</span> career init
                    </p>
                    <p className="terminal-success">✓ 开发环境已就绪</p>
                    <p className="terminal-muted">
                        等待你的第一个 commit<span className="cursor">▋</span>
                    </p>
                </div>
            </div>
            <div className="home-facts">
                <div>
                    <strong>36</strong>
                    <span>季度职业旅程</span>
                </div>
                <div>
                    <strong>8</strong>
                    <span>次关键抉择</span>
                </div>
                <div>
                    <strong>6</strong>
                    <span>种职业结局</span>
                </div>
                <p>
                    每一次重启，
                    <br />
                    都是新的可能。
                </p>
            </div>
            <div className="actions">
                {features && <Github />}
                <ThemeToggle />
            </div>
        </div>
    )
}
