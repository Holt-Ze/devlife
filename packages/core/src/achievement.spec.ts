import { describe, test, expect } from 'bun:test'
import { createState } from './state'
import { trigger } from './achievement'
import { AchievementOpportunity as Ao } from '@remake/data'
const profile = { times: 0, talents: new Set<number>(), events: new Set<number>(), achievements: new Set<number>() }
const allocation = { charm: 5, intelligence: 5, strength: 5, money: 5, spirit: 5 }
describe('Programmer achievements', () => {
    test('end count uses the completed run plus stored runs', () => {
        expect(trigger(Ao.End, createState(allocation), { ...profile, times: 3 }).triggers).not.toContain(318)
        expect(trigger(Ao.End, createState(allocation), { ...profile, times: 4 }).triggers).toContain(318)
    })
    test('ending achievement appears on summary and does not repeat', () => {
        const state = createState(allocation)
        state.events.add(20902)
        const result = trigger(Ao.Summary, state, profile)
        expect(result.triggers).toContain(312)
        expect(result.triggers).not.toContain(311)
        expect(trigger(Ao.Summary, result.state, profile).triggers).not.toContain(312)
        expect(trigger(Ao.Summary, state, { ...profile, achievements: new Set([312]) }).triggers).not.toContain(312)
    })
})
