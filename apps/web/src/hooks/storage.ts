import { useEffect, useCallback, useTransition } from 'react'
import { atom, useAtom } from 'jotai'
import { useConfigInject, useProfileInject, useRawProfile } from '@remake/hooks'
import { useUniqueInject, useUnique } from '@remake/hooks'
import { init, get, set } from '@/storage'
import { config } from '@/config'
import { parseProfile, parseUnique } from '@/storage/profile'

const initedAtom = atom(false)

export const useInit = () => {
    const configInject = useConfigInject()
    const profileInject = useProfileInject()
    const uniqueInject = useUniqueInject()
    const [inited, setInited] = useAtom(initedAtom)
    const loader = useCallback(async () => {
        if (inited) return
        configInject(config)
        await init()
        const profile = await get('profile')
        profileInject(parseProfile(profile))
        const unique = parseUnique(await get('unique'))
        if (unique) uniqueInject(unique)
        setInited(true)
    }, [inited, configInject, profileInject, uniqueInject, setInited])
    return [inited, loader] as const
}

export const useWatcher = () => {
    const [profile] = useRawProfile()
    const unique = useUnique()
    const [inited] = useAtom(initedAtom)
    const [p, saveProfile] = useTransition()
    const [u, saveUnique] = useTransition()
    useEffect(() => {
        if (!inited || !profile) return
        const str = JSON.stringify({
            ...profile,
            times: profile.times,
            achievements: Array.from(profile.achievements),
            events: Array.from(profile.events),
            talents: Array.from(profile.talents),
        })
        saveProfile(async () => {
            await set('profile', str)
        })
    }, [inited, profile, saveProfile])
    useEffect(() => {
        if (!inited || !unique) return
        const str = JSON.stringify(unique)
        saveUnique(async () => {
            await set('unique', str)
        })
    }, [inited, unique, saveUnique])

    return p || u
}
