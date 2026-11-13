import { useEffect, useCallback, useTransition, useState } from 'react'
import { atom, useAtom } from 'jotai'
import { useConfigInject, useProfileInject, useRawProfile } from '@remake/hooks'
import { useUniqueInject, useUnique } from '@remake/hooks'
import { init, get, set } from '@/storage'
import { config } from '@/config'
import { parseProfile, parseUnique } from '@/storage/profile'
import { toastMsg } from '@/toast'

const initedAtom = atom(false)

export const useInit = () => {
    const configInject = useConfigInject()
    const profileInject = useProfileInject()
    const uniqueInject = useUniqueInject()
    const [inited, setInited] = useAtom(initedAtom)
    const [error, setError] = useState<string | null>(null)
    const loader = useCallback(async () => {
        if (inited) return
        setError(null)
        try {
            configInject(config)
            await init()
            const profile = await get('profile')
            profileInject(parseProfile(profile))
            const unique = parseUnique(await get('unique'))
            if (unique) uniqueInject(unique)
            setInited(true)
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : '档案服务暂时无法连接')
        }
    }, [inited, configInject, profileInject, uniqueInject, setInited])
    return [inited, loader, error] as const
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
            if (!await set('profile', str)) toastMsg('档案未保存到服务端，本地副本已保留，请刷新后重试', 'profile-save-error')
        })
    }, [inited, profile, saveProfile])
    useEffect(() => {
        if (!inited || !unique) return
        const str = JSON.stringify(unique)
        saveUnique(async () => {
            if (!await set('unique', str)) toastMsg('角色档案未保存成功，本地副本已保留，请刷新后重试', 'unique-save-error')
        })
    }, [inited, unique, saveUnique])

    return p || u
}
