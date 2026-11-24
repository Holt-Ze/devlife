import type { Achievement, Event, Talent } from '@remake/data'
import { ages, majors, AchievementOpportunity as Ao } from '@remake/data'
import type { GameState, ProfileState, Decision, Allocation } from './state'
import { createState, nextProfile, propsEffect } from './state'
import { summary as stateSummary } from './state'
import type { ReplacementResult, AdditionalPoints } from './talent'
import { pull, exclude, replacement, additionalPoints } from './talent'
import { trigger as ttr } from './talent'
import { trigger as atr } from './achievement'
import {
    trigger as etr,
    check as ec,
    applyEffect,
    availableChoices,
} from './event'
import type { RNG } from '@remake/vitex'
import { pickWeight } from '@remake/vitex'
import { produce, enableMapSet } from 'immer'
enableMapSet()

export interface TriggerResult<T> {
    state: GameState
    triggers: T[]
}
export interface PickResult {
    talents: ReplacementResult
    additionalPoints: AdditionalPoints
}
export function pick(talents: Iterable<Talent['id']>, rng?: RNG): PickResult {
    const r = replacement(talents, rng)
    const ap = additionalPoints(r.talents)
    return { talents: r, additionalPoints: ap }
}

export interface StartResult {
    state: GameState
    achievements: Achievement['id'][]
}
export function start(
    profile: ProfileState,
    ...args: Parameters<typeof createState>
): StartResult {
    const state = createState(...args)
    const ar = atr(Ao.Start, state, profile)
    return { state: ar.state, achievements: ar.triggers }
}
export interface NextResult {
    state: GameState
    age: number
    achievements: Achievement['id'][]
    events: Event['id'][]
    talents: Talent['id'][]
    end: boolean
    decision?: Decision
}

export function next(
    state: GameState,
    profile: ProfileState,
    rng?: RNG,
): NextResult {
    if (state.life < 1) throw new Error('Career is already complete')
    if (state.pendingChoice)
        throw new Error('Choose before advancing the quarter')
    let s = produce(state, (draft) => {
        draft.props = propsEffect(state.props, { age: 1 })
    })
    const age = s.props.current.age
    const tr = ttr(s, profile, rng)
    const events = (state.major ? majors.get(state.major)?.ages[age] : ages.get(age))?.event
    if (!events) throw new Error('No event pool for quarter ' + age)
    let event: Event['id'] | null = null
    for (const level of events) {
        const filtered = level.filter(([e]) => ec(e, tr.state, profile))
        if (filtered.length < 1) continue
        event = pickWeight(filtered, rng)
    }
    if (event === null)
        throw new Error('No event could be picked for age ' + age)
    const er = etr(event, tr.state, profile)
    const ar = atr(Ao.Trajectory, er.state, profile)
    const end = ar.state.life < 1
    return {
        state: ar.state,
        age,
        achievements: ar.triggers,
        events: er.triggers,
        talents: tr.triggers,
        end,
    }
}

export function choose(
    state: GameState,
    profile: ProfileState,
    instance: string,
    choiceId: string,
): NextResult {
    const pending = state.pendingChoice
    if (state.life < 1 || !pending || pending.instance !== instance)
        throw new Error('Decision is no longer pending')
    const option = availableChoices(state, profile).find(
        (option) => option.id === choiceId,
    )
    if (!option?.available) throw new Error('Choice is unavailable')
    const ready = produce(state, (draft) => {
        delete draft.pendingChoice
    })
    const er = etr(option.event, applyEffect(ready, option.effect), profile)
    const changes: Partial<Allocation> = {}
    for (const key of [
        'charm',
        'intelligence',
        'strength',
        'money',
        'spirit',
    ] as const) {
        const change = er.state.props.current[key] - state.props.current[key]
        if (change) changes[key] = change
    }
    const decision: Decision = { ...pending, choice: choiceId, changes }
    const resolved = produce(er.state, (draft) => {
        draft.decisions.push(decision)
    })
    const ar = atr(Ao.Trajectory, resolved, profile)
    return {
        state: ar.state,
        age: pending.quarter,
        achievements: ar.triggers,
        events: er.triggers,
        talents: [],
        end: ar.state.life < 1,
        decision,
    }
}

export interface SummaryResult {
    state: GameState
    summary: number
    achievements: Achievement['id'][]
}
export function summary(
    state: GameState,
    profile: ProfileState,
): SummaryResult {
    if (state.life > 0 || state.pendingChoice)
        throw new Error('Career is not complete')
    const ar = atr(Ao.Summary, state, profile)
    const s = stateSummary(ar.state)
    return { state: ar.state, summary: s, achievements: ar.triggers }
}

export interface EndResult {
    profile: ProfileState
    achievements: Achievement['id'][]
}

export function end(
    state: GameState,
    profile: ProfileState,
    locked?: Talent['id'][],
) {
    const ar = atr(Ao.End, state, profile)
    const p = nextProfile(profile, ar.state, locked)
    return { profile: p, achievements: ar.triggers }
}

export { pull, exclude }
