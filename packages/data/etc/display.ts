import { CampusQuarters, GraduationQuarter, type MajorId } from '../src/index'

export const properties = {
    charm: '沟通',
    intelligence: '技术',
    strength: '健康',
    money: '积蓄',
    spirit: '心态',
    age: '季度',
    summary: '成长分',
}

export const quarterLabel = (quarter: number) => quarter <= 0 ? '入职日' : `第 ${Math.ceil(quarter / 4)} 年 Q${(quarter - 1) % 4 + 1}`

const campusProperties = { ...properties, intelligence: '专业能力' }

export function attributeLabels(major?: MajorId) {
    return major ? campusProperties : properties
}

export function journeyTime(quarter: number, major?: MajorId) {
    if (!major) return quarterLabel(quarter)
    if (quarter <= 0) return '报到日'
    if (quarter === GraduationQuarter) return '毕业离校'
    if (quarter > GraduationQuarter) return `毕业后第 ${quarter - GraduationQuarter} 季度`
    const year = ['大一', '大二', '大三', '大四'][Math.floor((quarter - 1) / 4)]
    const semester = (quarter - 1) % 4 < 2 ? '上' : '下'
    return `${year}${semester} · ${quarter % 2 ? '学期前段' : '学期后段'}`
}

export function campusStage(quarter: number) {
    if (quarter >= CampusQuarters) return '毕业一年回望'
    if (quarter > GraduationQuarter) return '初入职场'
    if (quarter === GraduationQuarter) return '毕业离校'
    if (quarter >= 11) return '毕设与去向'
    if (quarter >= 5) return '专业实践'
    return '入学适应'
}

const s = (str: string) => str.split('|')
const p = (prefix: string, arr: string[]) => arr.map(v => prefix + v)
const jbase = '待积累|起步|入门|稳步成长|熟练|优秀|出色|卓越'
export const judges = {
    summary: s(jbase),
    charm: s(jbase),
    money: s(jbase),
    spirit: s('透支|低落|紧绷|平稳|积极|从容|充盈'),
    intelligence: s(jbase + '|专家|领军|标杆'),
    strength: s(jbase + '|活力充沛|状态极佳|持续精进|健康达人|长跑选手'),
    age: s('初次报到|入行探索|独立交付|持续成长|职业进阶|稳定迭代|九年积累'),
}

export const rates = {
    times: p('抽到紫色概率', s('不变|翻倍|三倍|四倍|五倍|六倍')),
    achievement: p('抽到橙色概率', s('不变|翻倍|三倍|四倍|五倍|六倍')),
}

export function judgeDisplay(key: keyof typeof judges, level: number) {
    return judges[key][level]
}
