import { useCallback, useState } from 'react'
import { atom, useSetAtom, useAtomValue, useAtom } from 'jotai'
import { useConfig, useProfile, useReplaced, useAlloc } from '.'
import { useTalentReset, useAllocReset } from '.'
import {
    start,
    next,
    choose,
    summary,
    end,
    availableChoices,
} from '@remake/core'
import { profileAtom } from './profile'
import type { GameState, Properties, NextResult } from '@remake/core'
import type { MajorId, Talent } from '@remake/data'

export enum Step {
    Idle = 'idle',
    Major = 'major',
    Mode = 'mode',
    Chara = 'chara',
    Pick = 'pick',
    Alloc = 'alloc',
    Play = 'play',
    Summary = 'summary',
    Achv = 'achv',
    Thanks = 'thanks',
}

export enum Mode {
    Classic = 'classic',
    Celebrity = 'celebrity',
}

export type Log = Omit<NextResult, 'state'> & {
    props: Omit<Properties, 'age'>
}

export const modeAtom = atom<Mode>(Mode.Classic)
export const stepAtom = atom<Step>(Step.Idle)
export const gameStateAtom = atom<GameState | null>(null)
export const logsAtom = atom<Log[]>([])
export const summaryAtom = atom(0)
const majorAtom = atom<MajorId | undefined>(undefined)

type AdvanceAction =
    | { type: 'next' }
    | { type: 'choose'; instance: string; choice: string }
// 在同一次 Jotai 写入中读取最新状态并提交日志，重复点击不会重用旧快照。
export const advanceAtom = atom(null, (get, set, action: AdvanceAction) => {
    const state = get(gameStateAtom)
    const profile = get(profileAtom)
    if (!state || !profile || state.life <= 0) return []
    if (action.type === 'next' && state.pendingChoice) return []
    if (
        action.type === 'choose' &&
        state.pendingChoice?.instance !== action.instance
    )
        return []
    const { state: updated, ...result } =
        action.type === 'next'
            ? next(state, profile)
            : choose(state, profile, action.instance, action.choice)
    const { age: _age, ...props } = updated.props.current
    set(gameStateAtom, updated)
    set(logsAtom, (logs) => [...logs, { ...result, props }])
    return result.achievements
})

export const useStateReset = () => {
    const setGameState = useSetAtom(gameStateAtom)
    return useCallback(() => setGameState(null), [setGameState])
}
export const useLogsReset = () => {
    const setLogs = useSetAtom(logsAtom)
    return useCallback(() => setLogs([]), [setLogs])
}
export const useGameReset = () => {
    const resetTalent = useTalentReset()
    const resetAlloc = useAllocReset()
    const resetState = useStateReset()
    const resetLogs = useLogsReset()
    return useCallback(() => {
        resetTalent()
        resetAlloc()
        resetState()
        resetLogs()
    }, [resetTalent, resetAlloc, resetState, resetLogs])
}

export const useMode = () => useAtomValue(modeAtom)
export const useIsClassic = () => useAtomValue(modeAtom) === Mode.Classic
export const useStep = () => useAtomValue(stepAtom)
export const useSetStep = () => useSetAtom(stepAtom)
export const useGameState = () => useAtomValue(gameStateAtom)
export const useSetGameState = () => useSetAtom(gameStateAtom)
export const useSummary = () => useAtomValue(summaryAtom)
export const useLogs = () => useAtomValue(logsAtom)
export const useSelectedMajor = () => useAtomValue(majorAtom)

export const useRemake = (chooseMajor = false) => {
    const { mode } = useConfig()
    const [{ times }] = useProfile()
    const setStep = useSetAtom(stepAtom)
    const setMajor = useSetAtom(majorAtom)
    const setMode = useSetAtom(modeAtom)
    const reset = useGameReset()
    return useCallback(() => {
        reset()
        setMajor(undefined)
        setMode(Mode.Classic)
        if (chooseMajor) return setStep(Step.Major)
        setStep(times < mode ? Step.Pick : Step.Mode)
    }, [chooseMajor, mode, times, setStep, setMajor, setMode, reset])
}

export const useChooseMajor = () => {
    const setMajor = useSetAtom(majorAtom)
    const setStep = useSetAtom(stepAtom)
    return useCallback((major: MajorId) => {
        setMajor(major)
        setStep(Step.Pick)
    }, [setMajor, setStep])
}

export const useModeChoose = () => {
    const setMode = useSetAtom(modeAtom)
    const setStep = useSetAtom(stepAtom)
    const choose = useCallback(
        (mode: Mode) => {
            setMode(mode)
            /* prettier-ignore */
            switch (mode) {
                case Mode.Classic: return setStep(Step.Pick)
                case Mode.Celebrity: return setStep(Step.Chara)
            }
        },
        [setMode, setStep],
    )
    return [Mode, choose] as const
}

export const useStart = () => {
    const { spirit } = useConfig()
    const [profile] = useProfile()
    const setStep = useSetAtom(stepAtom)
    const setState = useSetAtom(gameStateAtom)
    const { final: allocate } = useAlloc()
    const { talents: tr } = useReplaced()
    const major = useSelectedMajor()
    return useCallback(() => {
        const alloc = { ...allocate, spirit }
        const result = start(profile, alloc, tr.talents, major)
        setState(result.state)
        setStep(Step.Play)
        return result.achievements
    }, [profile, allocate, spirit, tr, major, setStep, setState])
}

export const useNext = () => {
    const [profile] = useProfile()
    const state = useAtomValue(gameStateAtom)
    const logs = useAtomValue(logsAtom)
    const dispatch = useSetAtom(advanceAtom)
    if (!state) throw new Error('Game state is not available.')
    const nexter = useCallback(() => dispatch({ type: 'next' }), [dispatch])
    const chooser = useCallback(
        (instance: string, choice: string) =>
            dispatch({ type: 'choose', instance, choice }),
        [dispatch],
    )
    return [
        {
            logs,
            ended: state.life <= 0,
            pending: state.pendingChoice,
            choices: availableChoices(state, profile),
        },
        nexter,
        chooser,
    ] as const
}

export const useGotoSummary = () => {
    const [profile] = useProfile()
    const [state, setState] = useAtom(gameStateAtom)
    const setStep = useSetAtom(stepAtom)
    const setSummary = useSetAtom(summaryAtom)
    return useCallback(() => {
        if (!state) throw new Error('Game state is not available.')
        const result = summary(state, profile)
        setSummary(result.summary)
        setState(result.state)
        setStep(Step.Summary)
        return result.achievements
    }, [state, profile, setStep, setState, setSummary])
}

export const useEnd = () => {
    const { lock } = useConfig()
    const [profile, setProfile] = useProfile()
    const setStep = useSetAtom(stepAtom)
    const state = useAtomValue(gameStateAtom)
    const reset = useGameReset()
    const isClassic = useIsClassic()
    const [locked, setLocked] = useState<Set<Talent['id']>>(new Set())
    const picker = useCallback(
        (talent: Talent['id']) => {
            setLocked((prev) => {
                if (!isClassic) return prev
                if (prev.has(talent)) {
                    const next = new Set(prev)
                    next.delete(talent)
                    return next
                }
                if (lock == 1) return new Set([talent])
                const next = new Set(prev)
                if (next.size >= lock) return prev
                next.add(talent)
                return next
            })
        },
        [lock, isClassic, setLocked],
    )
    const ender = useCallback(() => {
        if (!state)
            throw new Error('Game state is not available or already ended.')
        const l = isClassic
            ? locked.size > 0
                ? Array.from(locked)
                : undefined
            : profile.locked
        const result = end(state, profile, l)
        setStep(Step.Idle)
        setProfile(result.profile)
        reset()
        return result.achievements
    }, [state, profile, locked, isClassic, setStep, setProfile, reset])
    return [locked, picker, ender] as const
}

export const useGoHome = () => {
    const setStep = useSetAtom(stepAtom)
    return useCallback(() => setStep(Step.Idle), [setStep])
}

export const useGoThanks = () => {
    const setStep = useSetAtom(stepAtom)
    return useCallback(() => setStep(Step.Thanks), [setStep])
}

export const useFeatures = () => {
    const { features } = useConfig()
    const [{ times }] = useProfile()
    return times >= features
}
