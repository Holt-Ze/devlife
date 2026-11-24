import type { Age } from '../age.types'
import type { EventEffect } from '../event.types'

export type MajorId = 'computer-science' | 'mechanical' | 'accounting' | 'chinese' | 'visual-design' | 'nursing'

export interface Major {
    id: MajorId
    name: string
    category: string
    description: string
    pathways: { name: string; evidence: readonly number[] }[]
    endingEvents: number[]
    ages: Age[]
}

export interface Moment {
    text: string
    effect?: EventEffect
}

export interface Option {
    id: string
    label: string
    description: string
    outcome: Moment
}

export interface Scene<Choices extends readonly Option[] = readonly [Option, Option, Option]> {
    title: string
    narration: string
    speaker: string
    role: string
    text: string
    choices: Choices
}

export type Ending = { name: string; description: string }

export interface Destination {
    entry: Scene<readonly [Option, Option]>
    followUp: readonly [Moment, Moment]
    ending: Ending
}

export interface MajorStory {
    id: MajorId
    // 已发布的事件 ID 以这个号段为基础。已有号段与同一场景的选项次序需保留。
    eventBase: number
    name: string
    category: string
    description: string
    arrival: string
    foundation: Scene
    collaboration: Scene
    practice: Scene
    practiceFollowUp: readonly [Moment, Moment, Moment]
    capstone: Scene
    graduation: Scene
    destinations: readonly [Destination, Destination, Destination]
    earlyEvents: readonly Moment[]
    lateEvents: readonly Moment[]
}

export function option(
    id: string,
    label: string,
    description: string,
    text: string,
    effect: EventEffect,
): Option {
    return { id, label, description, outcome: { text, effect } }
}
