import type { Age, EventWithWeight } from '../age.types'
import type { EventBranch } from '../event.types'
import {
    CampusQuarters,
    GraduationQuarter,
    campusEventIds,
    campusRestEnding,
    endingEvent,
    followUpEvents,
    routeBranches,
    sceneEvents,
    sharedCampusEvents,
} from './shared'
import { computerScience } from './computer'
import { mechanical } from './mechanical'
import { accounting } from './accounting'
import { chinese } from './chinese'
import { visualDesign } from './design'
import { nursing } from './nursing'
import type { Ending, Major, MajorId, MajorStory, Moment } from './types'

export { CampusQuarters, GraduationQuarter }
export type { Major, MajorId }

export const majors = new Map<MajorId, Major>()
export const campusEvents = sharedCampusEvents.slice()
export const campusEndings = new Map<number, Ending>([[campusEventIds.restEnding, campusRestEnding]])

function regularPool(base: number, moments: readonly Moment[]): EventWithWeight[] {
    return moments.map(({ text, effect }, index) => {
        const id = base + index
        campusEvents.push({ id, event: text, effect, grade: 0, exclude: `EVT?[${id}]` })
        return [id, 1]
    })
}

function registerMajor(story: MajorStory) {
    const base = story.eventBase
    const arrival = base
    const foundation = base + 10
    const collaboration = base + 20
    const practice = base + 30
    const practiceFollowUp = base + 40
    const capstone = base + 50
    const graduation = base + 60
    const work = base + 70
    const workFollowUp = base + 110
    const finale = base + 150
    const entryScenes = [base + 80, base + 90, base + 100] as const
    const endingEvents = [base + 151, base + 152, base + 153] as const
    const evidence = [[practice + 1, capstone + 1], [practice + 2, capstone + 2]]
    // q18 永远根据 q17 已结算的实际选择落到同一岗位的后续，而不是重新抽取去向。
    const workBranches = entryScenes.flatMap((id, route): EventBranch[] =>
        [1, 2].map((offset) => ({ condition: `EVT?[${id + offset}]`, event: workFollowUp + route * 2 + offset - 1 })),
    )

    campusEvents.push(
        { id: arrival, event: story.arrival, effect: { SPR: 1 }, grade: 0 },
        ...sceneEvents(foundation, story.foundation),
        ...sceneEvents(collaboration, story.collaboration),
        ...sceneEvents(practice, story.practice, [
            { condition: `(EVT?[${foundation + 1}])|(INT>=10)`, lockedReason: '需要对应的入门作业经历，或专业能力达到 10' },
            { condition: `(EVT?[${foundation + 2}])|(CHR>=9)`, lockedReason: '需要对应的入门作业经历，或沟通达到 9' },
        ]),
        {
            id: practiceFollowUp,
            event: '实践周结束后，你收到了一条和之前的选择有关的消息。',
            grade: 0,
            branch: routeBranches(practice, [practiceFollowUp + 1, practiceFollowUp + 2, practiceFollowUp + 3]),
        },
        ...followUpEvents(practiceFollowUp + 1, story.practiceFollowUp),
        ...sceneEvents(capstone, story.capstone),
        ...sceneEvents(graduation, story.graduation, evidence.map((ids) => ({
            condition: `EVT?[${ids.join(',')}]`,
            lockedReason: '需要对应的专业实践或毕业作品经历',
        }))),
        { id: work, event: '新的一季开始，你遇到了进入新环境后的第一项任务。', grade: 0, branch: routeBranches(graduation, entryScenes) },
        {
            id: workFollowUp - 1,
            event: '上一季的做法留下了怎样的影响？你收到了来自合作方的反馈。',
            grade: 0,
            branch: workBranches,
        },
        {
            id: finale,
            event: '毕业后的第一年接近尾声。你整理了校园作品和近几季的记录，准备为下一年做新的安排。',
            grade: 0,
            branch: routeBranches(graduation, endingEvents),
        },
    )
    story.destinations.forEach(({ entry, followUp, ending }, index) => {
        const endingId = endingEvents[index]!
        campusEvents.push(
            ...sceneEvents(entryScenes[index]!, entry),
            ...followUpEvents(workFollowUp + 2 * index, followUp),
            endingEvent(endingId, ending),
        )
        campusEndings.set(endingId, ending)
    })

    const earlyPool = regularPool(base + 200, story.earlyEvents)
    const latePool = regularPool(base + 220, story.lateEvents)
    const fixed = new Map<number, number>([
        [0, arrival],
        [1, campusEventIds.firstWeek],
        [3, foundation],
        [4, campusEventIds.adjustment],
        [5, collaboration],
        [6, campusEventIds.expense],
        [8, practice],
        [9, practiceFollowUp],
        [11, capstone],
        [12, campusEventIds.schedule],
        [15, graduation],
        [GraduationQuarter, campusEventIds.graduation],
        [17, work],
        [18, workFollowUp - 1],
        [19, campusEventIds.classmates],
        [CampusQuarters, finale],
    ])
    const ages: Age[] = Array.from({ length: CampusQuarters + 1 }, (_, age) => {
        const milestone = fixed.get(age)
        const pool: EventWithWeight[] = milestone
            ? [[milestone, 1]]
            : age < 8 ? earlyPool : latePool
        return { age, event: [pool, age > 0 ? [[campusEventIds.rest, 1]] : []] }
    })
    majors.set(story.id, {
        id: story.id,
        name: story.name,
        category: story.category,
        description: story.description,
        pathways: evidence.map((markers, index) => ({
            name: story.destinations[index]!.ending.name,
            evidence: markers,
        })),
        endingEvents: [...endingEvents],
        ages,
    })
}

for (const story of [computerScience, mechanical, accounting, chinese, visualDesign, nursing]) {
    registerMajor(story)
}
