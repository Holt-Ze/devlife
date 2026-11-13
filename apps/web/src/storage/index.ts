import * as biliToy from '@remake/thirdparty-bili-toy'
import * as local from './local'
import * as postgres from './postgres'

interface Storage {
    init(): Promise<void>
    get(key: string): Promise<string | null>
    set(key: string, value: string): Promise<boolean>
}
const storage = {} as Storage

if (import.meta.env.VITE_CHANNEL === 'bili') {
    storage.init = biliToy.init
    storage.get = biliToy.get
    storage.set = biliToy.set
} else if (import.meta.env.VITE_STORAGE_MODE === 'postgres') {
    storage.init = postgres.init
    storage.get = postgres.get
    storage.set = postgres.set
} else {
    storage.init = async () => {}
    storage.get = local.get
    storage.set = local.set
}

export const init = storage.init
// 与人生重开原版隔离，所有渠道都使用同一版本命名空间。
export const get = (key: string) => storage.get(`devlife:v1:${key}`)
export const set = (key: string, value: string) => storage.set(`devlife:v1:${key}`, value)
