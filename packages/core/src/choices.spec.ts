import { describe, expect, test } from 'bun:test'
import { createState } from './state'
import { next, choose, summary } from './game'
import { availableChoices, trigger, check } from './event'

const profile = {
    times: 0,
    talents: new Set<number>(),
    events: new Set<number>(),
    achievements: new Set<number>(),
}
const allocation = {
    charm: 5,
    intelligence: 5,
    strength: 5,
    money: 5,
    spirit: 5,
}
const review = () => {
    const state = createState(allocation)
    state.props.current.age = 0
    return next(state, profile).state
}

describe('Interactive career decisions', () => {
    test('quarter waits for a choice; base effects apply only once', () => {
        const waiting = review()
        expect(waiting.props.current.intelligence).toBe(6)
        expect(waiting.pendingChoice?.event).toBe(20001)
        expect(waiting.achievements.has(302)).toBe(false)
        expect(() => next(waiting, profile)).toThrow('Choose before advancing')
        expect(() => summary(waiting, profile)).toThrow('not complete')
        const result = choose(
            waiting,
            profile,
            waiting.pendingChoice!.instance,
            'learn',
        )
        expect(result.state.props.current.intelligence).toBe(8)
        expect(result.state.props.current.age).toBe(1)
        expect(result.state.pendingChoice).toBeUndefined()
        expect(result.decision?.changes).toEqual({ intelligence: 2, spirit: 1 })
        expect(result.state.decisions.length).toBe(1)
        expect(result.achievements).toContain(302)
        expect(waiting.decisions.length).toBe(0)
        expect(next(result.state, profile).age).toBe(2)
    })
    test('stale, invalid and already-submitted decisions cannot apply effects', () => {
        const waiting = review()
        const token = waiting.pendingChoice!.instance
        expect(() => choose(waiting, profile, 'stale', 'learn')).toThrow(
            'no longer pending',
        )
        expect(() => choose(waiting, profile, token, 'missing')).toThrow(
            'unavailable',
        )
        const resolved = choose(waiting, profile, token, 'learn').state
        expect(() => choose(resolved, profile, token, 'learn')).toThrow(
            'no longer pending',
        )
        expect(resolved.decisions.length).toBe(1)
    })
    test('locked options are rejected by the engine, while fallback stays available', () => {
        const state = createState(allocation)
        state.props.current.age = 5
        const waiting = next(state, profile).state
        expect(
            availableChoices(waiting, profile).find(
                (choice) => choice.id === 'hotfix',
            )?.available,
        ).toBe(false)
        expect(() =>
            choose(waiting, profile, waiting.pendingChoice!.instance, 'hotfix'),
        ).toThrow('unavailable')
        const resolved = choose(
            waiting,
            profile,
            waiting.pendingChoice!.instance,
            'rollback',
        )
        expect(resolved.state.props.current.strength).toBe(6)
        expect(resolved.state.props.current.age).toBe(6)
    })
    test('different answers unlock different future events', () => {
        const waiting = review()
        const learn = choose(
            waiting,
            profile,
            waiting.pendingChoice!.instance,
            'learn',
        ).state
        const rush = choose(
            waiting,
            profile,
            waiting.pendingChoice!.instance,
            'rush',
        ).state
        expect(check(20213, learn, profile)).toBe(false)
        expect(check(20213, rush, profile)).toBe(true)
        expect(check(20214, learn, profile)).toBe(true)
        expect(check(20214, rush, profile)).toBe(false)
    })
    test('repeated event configurations have distinct instance tokens', () => {
        const first = review()
        const state = createState(allocation)
        state.props.current.age = 4
        const later = trigger(20001, state, profile).state
        expect(later.pendingChoice!.instance).not.toBe(
            first.pendingChoice!.instance,
        )
        expect(() =>
            choose(later, profile, first.pendingChoice!.instance, 'learn'),
        ).toThrow()
    })
    test.each([
        [21105, 20907],
        [21106, 20908],
        [21107, 20909],
        [20813, 20902],
        [20827, 20903],
        [20825, 20904],
    ])('route marker %i influences ending %i', (marker, ending) => {
        const state = createState({
            ...allocation,
            intelligence: 35,
            charm: 25,
            money: 20,
            strength: 15,
            spirit: 15,
        })
        state.props.current.age = 35
        state.events.add(marker)
        expect(next(state, profile).events).toContain(ending)
    })
})
