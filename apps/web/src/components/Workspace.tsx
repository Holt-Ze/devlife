import type { ReactNode } from 'react'
import { Step, useStep, useProfile, useGoHome } from '@remake/hooks'

const steps: Record<Step, [string, string]> = {
    [Step.Idle]: ['welcome.ts', '准备就绪'],
    [Step.Mode]: ['new-career.ts', '选择起点'],
    [Step.Chara]: ['developer.json', '角色档案'],
    [Step.Pick]: ['talents.ts', '01 / 抽取天赋'],
    [Step.Alloc]: ['config.json', '02 / 配置属性'],
    [Step.Play]: ['career.log', '03 / 生涯运行中'],
    [Step.Summary]: ['retrospective.md', '04 / 职业复盘'],
    [Step.Achv]: ['achievements.json', '成就档案'],
    [Step.Thanks]: ['README.md', '关于项目'],
}
export default function Workspace({ children }: { children: ReactNode }) {
    const step = useStep()
    const goHome = useGoHome()
    const [profile] = useProfile()
    const [file, label] = steps[step]
    return (
        <div className="workspace">
            <header className="workspace-header">
                <div className="brand">
                    <span className="brand-mark">&lt;/&gt;</span> DEV
                    <span className="brand-light">LIFE</span>
                    <span className="brand-divider" />
                    程序员模拟器
                </div>
                <span className="header-note font-mono">
                    a new branch of your life
                </span>
                <span className="window-dots">
                    <i />
                    <i />
                    <i />
                </span>
            </header>
            <div className="workspace-body">
                <aside className="activity-bar" aria-hidden="true">
                    <span className="activity-active">▱</span>
                    <span>⌘</span>
                    <span>⑂</span>
                    <span className="activity-bottom">{'{ }'}</span>
                </aside>
                <main className={`workspace-main step-${step}`}>
                    <div className="editor-tabs">
                        <div className="editor-tab">
                            <span className="file-symbol">
                                {file.endsWith('.ts') ? 'TS' : '#'}
                            </span>
                            {file}
                            <span className="tab-dot" />
                        </div>
                        <span className="editor-tab-note">{label}</span>
                    </div>
                    <div className="breadcrumb font-mono">
                        workspace <span>›</span> programmer-simulator{' '}
                        <span>›</span> <strong>{file}</strong>
                        {![
                            Step.Idle,
                            Step.Play,
                            Step.Summary,
                            Step.Achv,
                            Step.Thanks,
                        ].includes(step) && (
                            <button className="workspace-back" onClick={goHome}>
                                返回首页
                            </button>
                        )}
                    </div>
                    <div className="editor-content">{children}</div>
                </main>
            </div>
            <footer className="workspace-status font-mono">
                <span>
                    ⑂ main <span className="status-ok">✓</span>
                </span>
                <span>已完成 {profile.times} 段生涯</span>
                <span className="status-right">
                    UTF-8 <span>TypeScript</span>
                    <span className="status-live">●</span> 本地运行
                </span>
            </footer>
        </div>
    )
}
