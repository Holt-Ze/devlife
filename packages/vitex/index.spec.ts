import { describe, test, expect } from 'bun:test'
import { pickWeight } from './index'
import { transformers } from '../data/src/age.types'
describe('Weighted selection regression', () => {
    test('both halves of a decimal pool are selectable', () => {
        const pool = [
            ['a', 0.5],
            ['b', 0.5],
        ] as const
        expect(pickWeight([...pool], () => 0)).toBe('a')
        expect(pickWeight([...pool], (max) => max!)).toBe('b')
        const converted = transformers.event(['100*0.5', '200*0.5'])[0]!
        expect(pickWeight(converted, () => 0)).toBe(100)
        expect(pickWeight(converted, (max) => max!)).toBe(200)
    })
    test('zero and negative weights cannot select invalid items', () => {
        expect(pickWeight([['a', 0]])).toBe(null)
        expect(
            pickWeight(
                [
                    ['a', 0],
                    ['b', 1],
                ],
                () => 0,
            ),
        ).toBe('b')
        expect(() => pickWeight([['a', -1]])).toThrow()
    })
})
