import { describe, test, expect } from 'bun:test'
import { createState } from './state'
import { start, next, choose, summary, end } from './game'
import { availableChoices } from './event'
import { characters, endings, CareerQuarters } from '@remake/data'
const profile = { times: 0, talents: new Set<number>(), events: new Set<number>(), achievements: new Set<number>() }
const allocation = { charm: 5, intelligence: 5, strength: 5, money: 5, spirit: 5 }
const seeded = (initial: number) => {
    let seed = initial
    return (max = 1, min = 0) => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
        return min + Math.floor(seed / 4294967296 * (max - min + 1))
    }
}
describe('Programmer career lifecycle', () => {
    test('start unlocks hello world', () => {
        expect(start(profile, allocation, [1001]).achievements).toContain(301)
    })
    test.each([
        [20901, { intelligence: 30 }],
        [20902, { charm: 30 }],
        [20903, { money: 30 }],
        [20904, { strength: 12, spirit: 15 }],
        [20905, {}],
        [20906, { strength: 0 }],
    ])('ending %i is reachable', (id, patch) => {
        const state = createState({ ...allocation, ...patch })
        state.props.current.age = CareerQuarters - 1
        const result = next(state, profile)
        expect(result.end).toBe(true)
        expect(result.events).toContain(id)
        expect(() => next(result.state, profile)).toThrow('already complete')
        const reviewed = summary(result.state, profile)
        expect(Number.isFinite(reviewed.summary)).toBe(true)
        const saved = end(reviewed.state, profile, [1001])
        expect(saved.profile.times).toBe(1)
        expect(saved.profile.events.has(id)).toBe(true)
        expect(saved.profile.locked).toEqual([1001])
    })
    test('600 seeded careers complete with a single known ending', () => {
        const distribution = new Map<number, number>()
        for (let seed = 1; seed <= 600; seed++) {
            const chara = characters.get((seed % characters.size) + 1)!
            const p = chara.property
            let state = start(profile, { charm: p.CHR, intelligence: p.INT, strength: p.STR, money: p.MNY, spirit: 5 }, chara.talent).state
            const rng = seeded(seed)
            for (let turn = 0; state.life > 0 && turn <= CareerQuarters; turn++) {
                const result = next(state, profile, rng)
                state = result.state
                if (state.pendingChoice) {
                    const options = availableChoices(state, profile).filter(option => option.available)
                    const option = options[rng(options.length - 1, 0)]!
                    state = choose(state, profile, state.pendingChoice.instance, option.id).state
                }
                expect(result.events.length).toBeGreaterThan(0)
                expect(Object.values(state.props.current).every(Number.isFinite)).toBe(true)
            }
            expect(state.life).toBe(0)
            expect(state.pendingChoice).toBeUndefined()
            expect(state.decisions.length).toBeLessThanOrEqual(10)
            if (state.events.has(20036)) expect(state.decisions.length).toBe(10)
            const reached = [...endings.keys()].filter(id => state.events.has(id))
            expect(reached.length).toBe(1)
            distribution.set(reached[0]!, (distribution.get(reached[0]!) ?? 0) + 1)
        }
        console.log('600 seeded career endings:', Object.fromEntries(distribution))
        expect(distribution.size).toBeGreaterThanOrEqual(4)
    })
    test('zero health exits early, while unallocated reserves do not kill', () => {
        let state = next(createState({ ...allocation, strength: 0 }), profile).state
        const result = next(state, profile)
        expect(result.end).toBe(true)
        expect(result.events).toContain(20906)
        state = next(createState({ ...allocation, money: 0 }), profile).state
        expect(next(state, profile).end).toBe(false)
    })
})
