import type { Event, EventBranch } from '../event.types'
import type { Ending, Moment, Option, Scene } from './types'
import { option } from './types'

export const CampusQuarters = 20
export const GraduationQuarter = 16

export const campusEventIds = {
    firstWeek: 29001,
    adjustment: 29005,
    expense: 29006,
    schedule: 29012,
    graduation: 29016,
    classmates: 29019,
    rest: 29028,
    restEnding: 29029,
}

export function sceneEvents(
    id: number,
    scene: Scene<readonly Option[]>,
    gates: { condition: string; lockedReason: string }[] = [],
): Event[] {
    const { narration, choices, ...dialogue } = scene
    return [
        {
            id,
            event: narration,
            grade: 0,
            dialogue: { ...dialogue, portrait: dialogue.speaker.charAt(0) },
            choices: choices.map(({ outcome, ...choice }, index) => ({
                ...choice,
                ...gates[index],
                event: id + index + 1,
            })),
        },
        ...choices.map(({ outcome }, index): Event => ({
            id: id + index + 1,
            event: outcome.text,
            effect: outcome.effect,
            grade: 1,
            NoRandom: true,
        })),
    ]
}

export function followUpEvents(id: number, moments: readonly Moment[]): Event[] {
    return moments.map(({ text, effect }, index) => ({
        id: id + index,
        event: text,
        effect,
        grade: 1,
        NoRandom: true,
    }))
}

export function routeBranches(source: number, targets: readonly [number, number, number]): EventBranch[] {
    return [
        { condition: `EVT?[${source + 1}]`, event: targets[0] },
        { condition: `EVT?[${source + 2}]`, event: targets[1] },
        { condition: 'AGE>=0', event: targets[2] },
    ]
}

export function endingEvent(id: number, ending: Ending, grade: Event['grade'] = 2): Event {
    return { id, event: `${ending.name}：${ending.description}`, effect: { LIF: -1 }, grade, NoRandom: true }
}

const firstWeek = sceneEvents(campusEventIds.firstWeek, {
    title: '先决定怎么度过一周',
    narration: '宿舍群在问谁一起吃饭，勤工助学的名单也刚贴出来。课表之外，你还有几块空出来的时间。',
    speaker: '小沈',
    role: '同寝室的同学',
    text: '今天要交报名表。你想和同学一起学习，找份校内兼职，还是把晚上留给自己？',
    choices: [
        option('study-group', '组建每周一次的互助小组', '约定固定时间，和同学互相讲题。',
            '你们约好周四晚在图书馆碰头，从各自最不会讲的一题开始。', { CHR: 2, INT: 1 }),
        option('campus-job', '报名图书馆的勤工助学', '生活费多一点余量，周末少两个空闲时段。',
            '第一笔值班补贴进了你的记账本，周日早起却比你想的更费劲。', { MNY: 3, STR: -1 }),
        option('routine', '固定作息，给新生活留点空档', '减少临时安排，先适应校园节奏。',
            '你把睡觉和运动也写进了自己的课表，晚归的次数少了。', { STR: 2, SPR: 2 }),
    ],
})

// 与关键对话 ID 分开，避免同场景的结果与其他场景重叠。
const adjustmentOutcomes = 29100
const adjustment: Event = {
    id: campusEventIds.adjustment,
    grade: 0,
    event: '第一次期末周到了，课表之外的安排也开始产生影响。',
    branch: routeBranches(campusEventIds.firstWeek, [adjustmentOutcomes, adjustmentOutcomes + 1, adjustmentOutcomes + 2]),
}
const expense = sceneEvents(campusEventIds.expense, {
    title: '预算里漏算的一笔',
    narration: '课程实践有一笔额外的交通和材料开销。你算了算，按原计划这月会超支。',
    speaker: '赵老师',
    role: '辅导员',
    text: '学院有公用材料，也可以走困难补助申请。先看你更缺的是时间还是预算。',
    choices: [
        option('borrow', '和同学约好借用学院的材料', '省下一部分开销，需要协调借还时间。',
            '你登记了领用周期，和下一组约定好交接。', { CHR: 2, MNY: 1 }),
        option('extra-shift', '加排一班，用补贴覆盖支出', '储备会上升，周内的休息会少一晚。',
            '你结清了费用，也把原定的周末活动从日历里划掉。', { MNY: 3, STR: -2 }),
        option('smaller-plan', '与老师确认最低要求，缩小自费计划', '保住练习目标，少做一部分延伸内容。',
            '老师同意你少交一份附加材料，你省下了开销，也按期完成了必做部分。', { MNY: 1, SPR: 2 }),
    ],
})
const schedule = sceneEvents(campusEventIds.schedule, {
    title: '三件事挤进了同一周',
    narration: '毕业材料要交初稿，打工的同学想和你换班，老朋友也约好了周末见面。',
    speaker: '小沈',
    role: '同寝室的同学',
    text: '我看你这周每天都满了。哪一件该优先完成，哪一件能改期？',
    choices: [
        option('prioritize', '先保障初稿，主动谈换班和改期', '减少赶工，练习提前说明自己的安排。',
            '你逐一发去新的时间，初稿交了，朋友也改约到下周。', { INT: 2, CHR: 1, SPR: 1 }),
        option('cover-shift', '保留换班，接受这周会更辛苦', '多拿一笔补贴，也为赶工承担代价。',
            '换班顺利，初稿也交了。连着两个晚上睡得很晚，你取消了周末的活动。', { MNY: 3, STR: -2, SPR: -1 }),
        option('ask-support', '和导师沟通进度，保住休息时间', '提交已完成的部分，为剩余工作争取时间。',
            '你列出还没完成的章节，和导师约定按两次检查交付。空出来的周五晚上终于能休息。', { CHR: 1, STR: 2, SPR: 2 }),
    ],
})

export const campusRestEnding: Ending = {
    name: '给自己一段休整期',
    description: '你停下这段安排，和身边的人重新商量接下来的节奏。已经完成的学习、实践和作品，都会跟你进入下一段生活。',
}

export const sharedCampusEvents: Event[] = [
    ...firstWeek,
    adjustment,
    ...followUpEvents(adjustmentOutcomes, [
        { text: '互助小组兑现了每周见面的约定。复习时，你们用彼此的盲点对照出了两处容易错的内容。', effect: { INT: 1, CHR: 1 } },
        { text: '图书馆同事告诉你哪里能借到课程参考书。补贴和免费借阅一起减轻了这月的压力。', effect: { MNY: 2, SPR: 1 } },
        { text: '宿舍连着几晚都有人忙到深夜。你提早处理了作业，考试前保住了两晚完整的睡眠。', effect: { STR: 1, SPR: 2 } },
    ]),
    ...expense,
    ...schedule,
    {
        id: campusEventIds.graduation,
        event: '离校清单上最后一格打了勾。你把作品、实践证明和几张合照放进同一个文件夹，和同学在校门口告别。',
        effect: { SPR: 2 },
        grade: 1,
    },
    {
        id: campusEventIds.classmates,
        event: '原来的宿舍群聊起毕业后的第一年。几个人去向不同，却都在重新学习怎么安排工作和生活。',
        effect: { CHR: 1, SPR: 1 },
        grade: 0,
    },
    {
        id: campusEventIds.rest,
        event: '连续透支已经影响到日常安排。你决定先暂停手头的计划，把恢复状态放在眼前的进度之前。',
        include: '(STR<=0)|(SPR<=0)',
        branch: [{ condition: 'AGE>=0', event: campusEventIds.restEnding }],
        grade: 0,
    },
    endingEvent(campusEventIds.restEnding, campusRestEnding, 0),
]
