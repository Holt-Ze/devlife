import { events as programmerEvents, endings as programmerEndings } from './programmer/events'
import { campusEvents, campusEndings } from './campus/index'

// 主题内容直接使用可审查的 TypeScript，运行时不再依赖原版 Excel。
export type { Event, EventGrade, EventEffect, EventBranch, EventChoice, EventDialogue } from './event.types'
export { TalentGrade } from './talent.types'
export type { Talent, TalentEffect } from './talent.types'
export type { Age, EventWithWeight } from './age.types'
export type { Character, CharacterProperty } from './character.types'
export { AchievementGrade, AchievementOpportunity } from './achievement.types'
export type { Achievement } from './achievement.types'
export { SpecialThanksGroup } from './specialthanks.types'
export type { SpecialThanks } from './specialthanks.types'
export { talents } from './programmer/talents'
export { ages, CareerQuarters } from './programmer/events'
export { majors, CampusQuarters, GraduationQuarter } from './campus/index'
export type { Major, MajorId } from './campus/index'
export { achievements, characters, specialThanks } from './programmer/profile'

export const events = new Map(programmerEvents)
for (const event of campusEvents) {
    if (events.has(event.id)) throw new Error(`事件 ID 重复：${event.id}`)
    events.set(event.id, event)
}
export const endings = new Map([...programmerEndings, ...campusEndings])
