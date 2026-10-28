import { type Event, type EventEffect, events } from '@remake/data'
import type { Properties, GameState, ProfileState } from './state'
import { propsEffect, createFlatState } from './state'
import { check as checkCondition } from '@remake/condition'
import type { TriggerResult } from './game'
import { produce } from 'immer'

export function check(
    event: Event['id'],
    state: GameState,
    profile: ProfileState,
) {
    const { include, exclude, NoRandom } = events.get(event)!
    if (NoRandom) return false
    const flatState = createFlatState(state, profile)
    if (exclude && checkCondition(flatState, exclude)) return false
    if (include) return checkCondition(flatState, include)
    return true
}

export function applyEffect(state: GameState, effect?: EventEffect): GameState {
    if (!effect) return state
    return produce(state, (draft) => {
        if (effect.LIF) draft.life += effect.LIF
        const pe: Partial<Properties> = {}
        if (effect.AGE) pe.age = effect.AGE
        if (effect.CHR) pe.charm = effect.CHR
        if (effect.INT) pe.intelligence = effect.INT
        if (effect.STR) pe.strength = effect.STR
        if (effect.MNY) pe.money = effect.MNY
        if (effect.SPR) pe.spirit = effect.SPR
        draft.props = propsEffect(draft.props, pe)
    })
}

export function trigger(
    eventId: number,
    state: GameState,
    profile: ProfileState,
): TriggerResult<Event['id']> {
    if (state.pendingChoice) throw new Error('A decision is still pending')
    const event = events.get(eventId)
    if (!event) throw new Error('Unknown event ' + eventId)
    const { effect, branch, choices } = event
    const newState = produce(applyEffect(state, effect), (draft) => {
        draft.events.add(eventId)
        if (choices?.length && draft.life > 0) {
            const quarter = draft.props.current.age
            draft.pendingChoice = {
                event: eventId,
                quarter,
                instance: `${quarter}:${eventId}:${draft.decisions.length}`,
            }
        }
    })
    if (newState.pendingChoice) return { state: newState, triggers: [eventId] }
    const flatState = createFlatState(newState, profile)
    if (branch) {
        for (const { condition, event } of branch) {
            if (checkCondition(flatState, condition)) {
                const result = trigger(event, newState, profile)
                return {
                    state: result.state,
                    triggers: [eventId, ...result.triggers],
                }
            }
        }
    }
    return { state: newState, triggers: [eventId] }
}

export function availableChoices(state: GameState, profile: ProfileState) {
    const pending = state.pendingChoice
    if (!pending) return []
    const flat = createFlatState(state, profile)
    return (events.get(pending.event)?.choices ?? []).map((choice) => ({
        ...choice,
        available: !choice.condition || checkCondition(flat, choice.condition),
    }))
}
