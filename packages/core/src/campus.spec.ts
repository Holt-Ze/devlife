import { describe, expect, test } from 'bun:test'
import { CampusQuarters, endings, events, majors } from '@remake/data'
import { campusEventIds } from '../../data/src/campus/shared'
import { availableChoices } from './event'
import { start, next, choose, summary, end } from './game'
import { createState } from './state'

const profile = { times: 0, talents: new Set<number>(), events: new Set<number>(), achievements: new Set<number>() }
const allocation = { charm: 5, intelligence: 5, strength: 6, money: 4, spirit: 5 }
const firstInPool = (_max: number, min = 0) => min
const paths = [...majors.values()].flatMap(major =>
    major.endingEvents.map((id, index) => [endings.get(id)!.name, major, index] as const),
)

describe('Campus journeys', () => {
    test.each(paths)('%s is reachable through its choices and follow-ups', (_, major, path) => {
        let state = start(profile, allocation, [], major.id).state
        for (let quarter = 0; quarter <= CampusQuarters; quarter++) {
            const action = next(state, profile, firstInPool)
            expect(action.age).toBe(quarter)
            expect(action.events.length).toBeGreaterThan(0)
            state = action.state
            if (quarter === 9 || quarter === 18) expect(action.events).toHaveLength(2)
            if (quarter === 17) {
                expect(action.events).toHaveLength(2)
                expect(events.get(action.events[1]!)?.dialogue).toBeDefined()
            }
            if (!state.pendingChoice) continue
            const options = availableChoices(state, profile)
            const index = [3, 8, 11, 15].includes(quarter) ? path : options.length - 1
            const option = options[index]!
            expect(option.available).toBe(true)
            state = choose(state, profile, state.pendingChoice.instance, option.id).state
            expect(state.events.has(option.event)).toBe(true)
        }
        expect(state.major).toBe(major.id)
        expect(state.life).toBe(0)
        expect(state.decisions.map(decision => decision.quarter)).toEqual([1, 3, 5, 6, 8, 11, 12, 15, 17])
        expect([...endings.keys()].filter(id => state.events.has(id))).toEqual([major.endingEvents[path]!])
        const saved = end(summary(state, profile).state, profile).profile
        expect(saved.events.has(major.endingEvents[path]!)).toBe(true)
        expect(saved.achievements.has(323)).toBe(true)
        expect(saved.achievements.has(324)).toBe(true)
    })

    test('graduation checks experience in the chosen discipline and accepts a change of direction at the capstone', () => {
        const major = majors.get('visual-design')!
        const accounting = majors.get('accounting')!
        const state = createState({ ...allocation, intelligence: 30, charm: 30 }, [], major.id)
        state.props.current.age = 14
        state.events.add(accounting.pathways[0]!.evidence[0]!)
        expect(availableChoices(next(state, profile).state, profile).map(option => option.available)).toEqual([false, false, true])
        const qualified = {
            ...state,
            events: new Set([...state.events, major.pathways[0]!.evidence[0]!, major.pathways[1]!.evidence[1]!]),
        }
        expect(availableChoices(next(qualified, profile).state, profile).map(option => option.available)).toEqual([true, true, true])
    })

    test('early exhaustion reaches the shared campus ending and keeps the actual quarter', () => {
        const state = createState({ ...allocation, strength: 0 }, [], 'nursing')
        const arrived = next(state, profile).state
        const stopped = next(arrived, profile)
        expect(stopped.age).toBe(1)
        expect(stopped.end).toBe(true)
        expect(stopped.events).toContain(campusEventIds.restEnding)
        expect(stopped.state.major).toBe('nursing')
    })
})
