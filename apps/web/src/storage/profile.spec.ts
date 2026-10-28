import { describe, it, expect } from 'vitest'
import { parseProfile, parseUnique } from './profile'
describe('Programmer save recovery', () => {
    it('accepts only known IDs and safe counters', () => {
        const profile = parseProfile(
            JSON.stringify({
                times: 3,
                events: [20000, 999],
                talents: [1001, 999],
                achievements: [301, 1],
                locked: [1001, 1002],
            }),
        )
        expect(profile.times).toBe(3)
        expect([...profile.events]).toEqual([20000])
        expect([...profile.talents]).toEqual([1001])
        expect([...profile.achievements]).toEqual([301])
        expect(profile.locked).toEqual([1001])
    })
    it.each(['broken', 'null', '[]', '{"times":-1,"talents":"oops"}'])(
        'recovers invalid profile %s',
        (raw) => {
            const profile = parseProfile(raw)
            expect(profile.times).toBe(0)
            expect(profile.talents.size).toBe(0)
        },
    )
    it('rejects damaged unique characters', () => {
        expect(parseUnique('{"talent":[999]}')).toBeNull()
        expect(parseUnique('broken')).toBeNull()
        expect(
            parseUnique(
                JSON.stringify({
                    property: { CHR: 5, INT: 5, STR: 5, MNY: 5 },
                    talent: [1001],
                }),
            )?.talent,
        ).toEqual([1001])
    })
})
