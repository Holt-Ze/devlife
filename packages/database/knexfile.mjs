import { fileURLToPath } from 'node:url'
import { readFileSync, existsSync } from 'node:fs'

export const localConfigPath = fileURLToPath(new URL('../../.local/runtime.json', import.meta.url))
export function localConfig() { return existsSync(localConfigPath) ? JSON.parse(readFileSync(localConfigPath, 'utf8')) : null }

// No implicit connection to a locally installed database.
export function config(connection = process.env.DATABASE_URL || localConfig()?.ownerUrl) {
    if (!connection) throw new Error('请设置 DATABASE_URL，指向要迁移的 PostgreSQL 数据库。')
    return {
        client: 'pg',
        connection,
        pool: { min: 0, max: 5 },
        migrations: {
            directory: fileURLToPath(new URL('./migrations/', import.meta.url)),
            loadExtensions: ['.mjs'],
            tableName: 'knex_migrations',
        },
        seeds: {
            directory: fileURLToPath(new URL('./seeds36/', import.meta.url)),
            loadExtensions: ['.mjs'],
        },
    }
}

// Deferred until Knex CLI has selected this environment.
export default async function () { return config() }
