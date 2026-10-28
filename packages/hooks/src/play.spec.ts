import { describe, test, expect } from 'bun:test'
import { createStore } from 'jotai'
import { createState } from '@remake/core/state'
import { advanceAtom, gameStateAtom, logsAtom } from './play'
import { profileAtom } from './profile'

describe('Decision submission transaction', () => {
    test('double clicks commit a choice and its log exactly once', () => {
        const store = createStore()
        store.set(profileAtom, {
            times: 0,
            events: new Set(),
            talents: new Set(),
            achievements: new Set(),
        })
        const state = createState({
            charm: 5,
            intelligence: 5,
            strength: 5,
            money: 5,
            spirit: 5,
        })
        state.props.current.age = 0
        store.set(gameStateAtom, state)
        store.set(advanceAtom, { type: 'next' })
        const token = store.get(gameStateAtom)!.pendingChoice!.instance
        store.set(advanceAtom, { type: 'next' })
        expect(store.get(logsAtom).length).toBe(1)
        store.set(advanceAtom, {
            type: 'choose',
            instance: token,
            choice: 'learn',
        })
        store.set(advanceAtom, {
            type: 'choose',
            instance: token,
            choice: 'learn',
        })
        expect(store.get(gameStateAtom)!.decisions.length).toBe(1)
        expect(store.get(gameStateAtom)!.props.current.intelligence).toBe(8)
        expect(store.get(logsAtom).length).toBe(2)
    })
})
