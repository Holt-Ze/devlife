import { describe, test, expect } from 'bun:test'
import { pullChara, uniqueGenerate } from './character'
import { characters, talents } from '@remake/data'
describe('Programmer backgrounds', () => {
    test('draw count is capped by the six available backgrounds', () => {
        const result = pullChara({ count: 10, knife: 10 })
        expect(result.characters.length).toBe(characters.size)
        expect(new Set(result.characters).size).toBe(characters.size)
        expect(result.characters.every(id => characters.has(id))).toBe(true)
        expect(result.times.times).toBe(characters.size)
    })
    test('repeated draws preserve valid records', () => {
        let result = pullChara({ count: 3, knife: 10 })
        for (let i = 0; i < 20; i++) {
            result = pullChara({ count: 3, knife: 10 }, result.times)
            expect(result.characters.length).toBe(3)
            expect(result.characters.every(id => characters.has(id))).toBe(true)
        }
    })
    test('generated unique character references valid talents', () => {
        const result = uniqueGenerate({ prop: [[5, 1]], talent: [[3, 1]] })
        expect(result.property).toEqual({ CHR: 5, INT: 5, STR: 5, MNY: 5 })
        expect(result.talent.length).toBe(3)
        expect(result.talent.every(id => talents.has(id))).toBe(true)
    })
})
