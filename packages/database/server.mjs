import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import knex from 'knex'
import { config, localConfig } from './knexfile.mjs'
import { profileService, ProfileError } from './lib/profiles.mjs'

import { reviewCareer } from './lib/review.mjs'

const envFile = fileURLToPath(new URL('../../.local/deepseek.env', import.meta.url))
try { process.loadEnvFile(envFile) } catch (error) { if (error.code !== 'ENOENT') throw error }

const root = fileURLToPath(new URL('../../', import.meta.url))
const staticRoot = path.join(root, 'apps/web/dist')
export async function createApp({ connection, userId, port = 8787 } = {}) {
    const settings = localConfig()
    const db = knex(config(connection || settings?.appUrl))
    const player = userId ? { id: userId } : await db('users').where({ username: 'local_player' }).select('id').first()
    const profiles = await profileService(db, player.id)
    const allowed = new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`, 'http://127.0.0.1:5173', 'http://localhost:5173'])
    const server = http.createServer(async (req, res) => {
        const send = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(body)) }
        try {
            if (req.headers.origin && !allowed.has(req.headers.origin)) throw new ProfileError('请求来源不受支持', 403)
            if (req.headers['sec-fetch-site'] === 'cross-site') throw new ProfileError('请求来源不受支持', 403)
            const url = new URL(req.url, 'http://127.0.0.1')
            let body = null
            if (['POST','PATCH'].includes(req.method)) {
                if (req.headers['content-type']?.split(';')[0] !== 'application/json') throw new ProfileError('需要 JSON 请求')
                let input = ''
                for await (const chunk of req) { input += chunk; if (Buffer.byteLength(input) > 1024 * 1024) throw new ProfileError('请求过大', 413) }
                try { body = JSON.parse(input) } catch { throw new ProfileError('请求格式不正确') }
            }
            if (url.pathname === '/api/review' && req.method === 'POST') return send(200, await reviewCareer(body))
            if (url.pathname === '/healthz' && req.method === 'GET') { await db.raw('SELECT 1'); return send(200, { status: 'ok', storage: 'postgresql', gameQuarters: 36 }) }
            if (url.pathname === '/api/content' && req.method === 'GET') { const row = await db('content_versions').where({ source_tag: 'game36' }).orderBy('created_at','desc').first(); return send(200, { checksum: row.checksum, snapshot: row.snapshot }) }
            if (url.pathname === '/api/profile' && req.method === 'GET') return send(200, await profiles.get())
            if (url.pathname === '/api/profile' && req.method === 'PATCH') return send(200, await profiles.save(body))
            if (url.pathname === '/api/profile/import' && req.method === 'POST') return send(200, await profiles.importArchive(body))
            if (url.pathname === '/api/careers' && req.method === 'POST') return send(200, await profiles.archiveCareer(body))
            if (url.pathname.startsWith('/api/')) return send(404, { message: '接口不存在' })
            if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, { message: '请求方法不支持' })
            const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html'
            let target = path.resolve(staticRoot, relative)
            if (!target.startsWith(staticRoot + path.sep) && target !== path.join(staticRoot, 'index.html')) return send(403, { message: '路径不受支持' })
            if (!await stat(target).then(s => s.isFile(), () => false)) target = path.join(staticRoot, 'index.html')
            const types = { '.html': 'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.json':'application/json' }
            const file = await readFile(target)
            res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(req.method === 'HEAD' ? undefined : file)
        } catch (error) { send(error.status || 500, { message: error.status ? error.message : '档案服务暂时不可用，请稍后重试' }) }
    })
    return { server, db, async close() { await new Promise(resolve => server.close(resolve)); await db.destroy() } }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const app = await createApp()
    app.server.listen(8787, '127.0.0.1', () => console.log('大学生生涯模拟器 http://127.0.0.1:8787'))
    for (const signal of ['SIGINT','SIGTERM']) process.on(signal, async () => { await app.close(); process.exit(0) })
}
