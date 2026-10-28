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
