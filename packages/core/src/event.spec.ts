import { describe, test, expect } from 'bun:test'
import { createState } from './state'
import { trigger, check } from './event'

const profile = { times: 0, talents: new Set<number>(), events: new Set<number>(), achievements: new Set<number>() }
const allocation = { charm: 5, intelligence: 5, strength: 5, money: 5, spirit: 5 }
describe('Programmer events', () => {
    test('probation branches reflect starting ability', () => {
        const technical = trigger(20002, createState({ ...allocation, intelligence: 8 }), profile)
        expect(technical.triggers).toEqual([20002, 20801])
        expect(technical.state.props.current.money).toBe(7)
        const social = trigger(20002, createState({ ...allocation, charm: 8 }), profile)
        expect(social.triggers).toEqual([20002, 20802])
        const beginner = createState(allocation)
        beginner.props.current.age = 2
        expect(trigger(20002, beginner, profile).triggers).toEqual([20002, 20803])
    })
    test('one-time open source event cannot repeat', () => {
        const state = createState({ ...allocation, intelligence: 12 })
        expect(check(20208, state, profile)).toBe(true)
        const result = trigger(20208, state, profile)
        expect(check(20208, result.state, profile)).toBe(false)
    })
    test('ending ends a career without mutating the input', () => {
        const state = createState(allocation)
        const result = trigger(20901, state, profile)
        expect(result.state.life).toBe(0)
        expect(state.life).toBe(1)
        expect(result.state.events.has(20901)).toBe(true)
    })
})
