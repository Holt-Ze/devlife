import { describe, test, expect } from 'bun:test'
import { pull, exclude, additionalPoints, trigger } from './talent'
import { createState } from './state'
import { talents } from '@remake/data'
import { next } from './game'
const profile = { times: 0, talents: new Set<number>(), events: new Set<number>(), achievements: new Set<number>() }
const allocation = { charm: 5, intelligence: 5, strength: 5, money: 5, spirit: 5 }
const options = { count: 10, rate: { base: new Map([[0, 65], [1, 25], [2, 8], [3, 2]]), additions: {} } }
describe('Programmer talents', () => {
    test('always draws ten distinct talents with rare grades exhausted', () => {
        for (let i = 0; i < 100; i++) {
            const result = pull(options, profile)
            expect(result.length).toBe(10)
            expect(new Set(result).size).toBe(10)
            expect(result.every(id => talents.has(id))).toBe(true)
        }
    })
    test('locked talent remains in next draw', () => {
        const result = pull(options, { ...profile, locked: [1027] })
        expect(result).toContain(1027)
        expect(result.length).toBe(10)
    })
    test('mutual exclusions work in both directions', () => {
        expect(exclude(1003, [1004])).toBe(1004)
        expect(exclude(1004, [1003])).toBe(1003)
    })
    test('background talents add allocation points', () => {
        expect(additionalPoints([1007, 1019]).points).toBe(6)
    })
    test('max three talent fires exactly three times', () => {
        let state = createState(allocation, [1006])
        state.props.current.age = 2
        const counts: number[] = []
        for (let i = 0; i < 5; i++) {
            const result = trigger(state, profile)
            state = result.state
            counts.push(result.triggers.length)
        }
        expect(counts).toEqual([1, 1, 1, 0, 0])
        expect(state.props.current.intelligence).toBe(8)
        expect(state.talentTriggers.get(1006)).toBe(3)
    })
    test('unconditional talents apply once at entry', () => {
        const first = next(createState(allocation, [1001]), profile)
        const second = next(first.state, profile)
        expect(first.talents).toContain(1001)
        expect(second.talents).not.toContain(1001)
    })
})
