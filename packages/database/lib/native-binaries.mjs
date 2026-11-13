import { access, mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'

export async function nativeBinaries() {
    try { return await import('@embedded-postgres/windows-x64') } catch {}
    const tools = fileURLToPath(new URL('../../../.tools/',import.meta.url))
    const entry = path.join(tools,'postgres-package/package/dist/index.js')
    if (!await access(entry).then(()=>true,()=>false)) {
        await mkdir(path.join(tools,'postgres-package'),{recursive:true})
        const response = await fetch('https://registry.npmjs.org/@embedded-postgres/windows-x64/-/windows-x64-18.6.0-beta.19.tgz',{signal:AbortSignal.timeout(180000)})
        if (!response.ok) throw new Error('PostgreSQL 安装包下载失败')
        const bytes = Buffer.from(await response.arrayBuffer())
        const integrity = createHash('sha512').update(bytes).digest('base64')
        if (integrity !== 'fp8d8f+6WfJQftX0D+l1vUTLPwCN5hlhV/g/KI5zDBwHURmta6ph3/kJeEOVirtbczO/pKQlqM4cELB2c7Sp7Q==') throw new Error('PostgreSQL 安装包完整性校验失败')
        const archive = path.join(tools,'pg-windows18.tgz')
        await writeFile(archive,bytes)
        await promisify(execFile)('tar.exe',['-xzf',archive,'-C',path.join(tools,'postgres-package')],{windowsHide:true})
    }
    return import(pathToFileURL(entry))
}
