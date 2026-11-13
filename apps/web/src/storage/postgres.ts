import { events, talents, achievements, characters, ages, endings } from '@remake/data'
import type { Event, Talent, Achievement, Character, Age } from '@remake/data'

type Saved = { profile: string; unique: string | null; version: number; initialized: boolean }
type Content = { careerQuarters: number; events: Event[]; talents: Talent[]; achievements: Achievement[]; characters: Character[]; ages: Age[]; endings: { event: number; name: string; description: string }[] }
let saved: Saved
let pending: Promise<unknown> = Promise.resolve()
let initialization: Promise<void> | undefined
const profileKey = 'devlife:v1:profile'
const uniqueKey = 'devlife:v1:unique'

async function request<T>(url: string, body?: unknown, method = 'POST'): Promise<T> {
    const response = await fetch(url, body === undefined ? undefined : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const result = await response.json()
    if (!response.ok) throw new Error(result.message || '档案保存失败')
    return result as T
}
function load<T extends { id: number }>(map: Map<number,T>, rows: T[]) {
    map.clear()
    for (const row of rows) map.set(row.id, row)
}
async function initialize() {
    const { snapshot } = await request<{ snapshot: Content }>('/api/content')
    if (snapshot.careerQuarters !== 36) throw new Error('游戏内容版本不匹配')
    load(events, snapshot.events); load(talents, snapshot.talents)
    load(achievements, snapshot.achievements); load(characters, snapshot.characters)
    ages.clear(); for (const row of snapshot.ages) ages.set(row.age, row)
    endings.clear(); for (const row of snapshot.endings) endings.set(row.event, { name: row.name, description: row.description })
    saved = await request<Saved>('/api/profile')
    if (!saved.initialized) {
        // Read only this origin's existing DEVLIFE keys. The original values stay intact.
        saved = await request<Saved>('/api/profile/import', { profile: localStorage.getItem(profileKey), unique: localStorage.getItem(uniqueKey) })
    }
}
export function init() {
    initialization ??= initialize().catch(error => { initialization = undefined; throw error })
    return initialization
}
export async function get(key: string) { await init(); return key.endsWith(':profile') ? saved.profile : key.endsWith(':unique') ? saved.unique : localStorage.getItem(key) }
export async function set(key: string, value: string) {
    // A local backup is kept even if the database service becomes unavailable.
    localStorage.setItem(key, value)
    const field = key.endsWith(':profile') ? 'profile' : key.endsWith(':unique') ? 'unique' : null
    if (!field) return true
    const task = pending.then(async () => {
        saved = await request<Saved>('/api/profile', { key: field, value, expectedVersion: saved.version }, 'PATCH')
    })
    pending = task.catch(() => {})
    try { await task; return true } catch { return false }
}
export async function saveCareer(id: string, state: unknown) {
    if (import.meta.env.VITE_STORAGE_MODE !== 'postgres') return true
    const plain = JSON.parse(JSON.stringify(state, (_, value) => value instanceof Set ? [...value] : value instanceof Map ? [...value] : value))
    try { await request('/api/careers', { id, state: plain }); return true } catch { return false }
}
