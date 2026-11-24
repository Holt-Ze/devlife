import { describe, test, expect } from 'bun:test'
import { ages, events, talents, characters, CareerQuarters, CampusQuarters, majors } from './index'
import { parse } from '../../condition/index'

describe('Programmer content integrity', () => {
    test('every quarter has a valid default pool and branch targets exist', () => {
        expect(ages.size).toBe(CareerQuarters + 1)
        for (const major of majors.values()) {
            expect(major.ages).toHaveLength(CampusQuarters + 1)
            major.ages.forEach((age, quarter) => expect(age.age).toBe(quarter))
        }
        const schedule = [...ages.values(), ...[...majors.values()].flatMap(major => major.ages)]
        for (const age of schedule) {
            expect(age.event[0]!.length).toBeGreaterThan(0)
            for (const [id, weight] of age.event.flat()) {
                expect(events.has(id)).toBe(true)
                expect(weight).toBeGreaterThan(0)
                expect(events.get(id)!.NoRandom).not.toBe(true)
            }
            expect(age.event[0]!.some(([id]) => !events.get(id)!.include)).toBe(
                true,
            )
        }
        for (const event of events.values()) {
            for (const branch of event.branch ?? [])
                expect(events.has(branch.event)).toBe(true)
            if (event.choices) {
                expect(event.branch).toBeUndefined()
                expect(event.dialogue).toBeDefined()
                expect(event.choices.some(choice => !choice.condition)).toBe(true)
                expect(new Set(event.choices.map(choice => choice.id)).size).toBe(event.choices.length)
                for (const choice of event.choices) expect(events.has(choice.event)).toBe(true)
            }
        }
    })
    test('event branches contain no cycles', () => {
        const walk = (id: number, path = new Set<number>()) => {
            expect(path.has(id)).toBe(false)
            const next = new Set(path).add(id)
            for (const branch of events.get(id)!.branch ?? [])
                walk(branch.event, next)
            for (const choice of events.get(id)!.choices ?? []) walk(choice.event, next)
        }
        for (const id of events.keys()) walk(id)
    })
    test('conditions use literal numbers or sets supported by the engine', () => {
        const checkNode = (node: ReturnType<typeof parse>[number]): void => {
            if (Array.isArray(node)) return node.forEach(checkNode)
            if (node === '&' || node === '|') return
            expect(node).toMatch(/^[A-Z]+[><!?=]+(-?\d+(\.\d+)?|\[[\d, ]*\])$/)
            const refs = node.match(/^EVT[!?]\[([\d, ]+)\]$/)
            if (refs)
                for (const id of refs[1]!.split(',').map(Number))
                    expect(events.has(id)).toBe(true)
        }
        for (const event of events.values()) {
            for (const condition of [
                event.include,
                event.exclude,
                ...(event.branch?.map((b) => b.condition) ?? []),
                ...(event.choices?.map(choice => choice.condition) ?? []),
            ]) {
                if (condition) parse(condition).forEach(checkNode)
            }
        }
    })
    test('backgrounds and talent exclusions reference known talents', () => {
        for (const chara of characters.values()) {
            expect(chara.talent.every((id) => talents.has(id))).toBe(true)
            expect(chara.talent.length).toBe(3)
        }
        for (const talent of talents.values()) {
            for (const id of talent.exclude ?? [])
                expect(talents.has(id)).toBe(true)
        }
    })
})
