import { achievements, events, talents } from '@remake/data'
import type { BaseChara, ProfileState } from '@remake/hooks'

export function parseProfile(raw: string | null): ProfileState {
    let data: Record<string, unknown> = {}
    try {
        const parsed = JSON.parse(raw ?? '{}')
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
            data = parsed
    } catch {
        /* 保留损坏的原始档案，使用空档案继续启动。 */
    }
    const ids = (value: unknown, known: ReadonlyMap<number, unknown>) =>
        Array.isArray(value)
            ? value.filter(
                  (id): id is number => Number.isInteger(id) && known.has(id),
              )
            : []
    return {
        times:
            typeof data.times === 'number' &&
            Number.isSafeInteger(data.times) &&
            data.times >= 0
                ? data.times
                : 0,
        achievements: new Set(ids(data.achievements, achievements)),
        events: new Set(ids(data.events, events)),
        talents: new Set(ids(data.talents, talents)),
        locked: ids(data.locked, talents).slice(0, 1),
    }
}

export function parseUnique(raw: string | null): BaseChara | null {
    try {
        const data = JSON.parse(raw ?? 'null')
        if (!data || !Array.isArray(data.talent) || !data.talent.length)
            return null
        if (!data.talent.every((id: number) => talents.has(id))) return null
        if (
            !['CHR', 'INT', 'STR', 'MNY'].every((key) =>
                Number.isFinite(data.property?.[key]),
            )
        )
            return null
        return {
            property: data.property,
            talent: [...new Set<number>(data.talent)],
        }
    } catch {
        return null
    }
}
