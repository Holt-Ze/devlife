import type { ReactNode } from 'react'
import { Step, useStep, useProfile, useGoHome, useRemake, useSelectedMajor } from '@remake/hooks'

const steps: Record<Step, [string, string]> = {
    [Step.Idle]: ['welcome.ts', '生涯模拟'],
    [Step.Major]: ['majors.ts', '选择专业'],
    [Step.Mode]: ['new-career.ts', '选择起点'],
    [Step.Chara]: ['developer.json', '角色档案'],
    [Step.Pick]: ['talents.ts', '抽取天赋'],
    [Step.Alloc]: ['config.json', '配置属性'],
    [Step.Play]: ['career.log', '生涯进行中'],
    [Step.Summary]: ['retrospective.md', '生涯复盘'],
    [Step.Achv]: ['achievements.json', '成就档案'],
    [Step.Thanks]: ['README.md', '关于项目'],
}
export default function Workspace({ children }: { children: ReactNode }) {
    const step = useStep()
    const goHome = useGoHome()
    const chooseMajor = useRemake(true)
    const inCampusSetup = useSelectedMajor() && (step === Step.Pick || step === Step.Alloc)
    const [profile] = useProfile()
    const [file, label] = steps[step]
    return (
        <div className="workspace">
            <header className="workspace-header">
                <div className="brand">
                    <span className="brand-mark">&lt;/&gt;</span> DEV
                    <span className="brand-light">LIFE</span>
                    <span className="brand-divider" />
                    生涯模拟器
                </div>
                <span className="header-note">{label}</span>
            </header>
            <div className="workspace-body">
                <main className={`workspace-main step-${step}`}>
                    <div className="breadcrumb">
                        {![
                            Step.Idle,
                            Step.Play,
                            Step.Summary,
                            Step.Achv,
                            Step.Thanks,
                        ].includes(step) && (
                            <button className="workspace-back" onClick={inCampusSetup ? chooseMajor : goHome}>
                                {inCampusSetup ? '返回专业选择' : '返回首页'}
                            </button>
                        )}
                    </div>
                    <div className="editor-content">{children}</div>
                </main>
            </div>
            <footer className="workspace-status font-mono">
                <span>{file}</span>
                <span className="status-right">已完成 {profile.times} 段生涯</span>
            </footer>
        </div>
    )
}
