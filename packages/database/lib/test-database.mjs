import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import knex from 'knex'
import { config } from '../knexfile.mjs'

// Disposable embedded PostgreSQL. Never reads DATABASE_URL or touches an existing DB.
export async function testDatabase({ maxConnections = 1 } = {}) {
    const db = await PGlite.create()
    const server = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0, maxConnections })
    try {
        await server.start()
        const connection = `postgresql://postgres:postgres@${server.getServerConn()}/postgres?sslmode=disable`
        const sql = knex(config(connection))
        return {
            sql, connection,
            async close() {
                await sql.destroy()
                await server.stop()
                await db.close()
            },
        }
    } catch (error) {
        await server.stop().catch(() => {})
        await db.close()
        throw error
    }
}
