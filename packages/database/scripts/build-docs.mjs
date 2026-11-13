import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { testDatabase } from '../lib/test-database.mjs'
import { makeSnapshot } from '../lib/content.mjs'
import { readableArtifacts } from './readable-artifacts.mjs'

const exec = promisify(execFile)
const output = fileURLToPath(new URL('../../../docs/database/', import.meta.url))
const configFile = fileURLToPath(new URL('../tbls.yml', import.meta.url))
const portable = fileURLToPath(new URL(`../../../.tools/tbls/tbls${process.platform === 'win32' ? '.exe' : ''}`, import.meta.url))
let binary = process.env.TBLS_BIN
if (!binary) {
    binary = await access(portable).then(() => portable, () => 'tbls')
}
async function run(args) {
    try {
        const { stdout, stderr } = await exec(binary, args, { timeout: 60000, maxBuffer: 4 * 1024 * 1024 })
        if (stdout.trim()) console.log(stdout.trim())
        if (stderr.trim()) console.log(stderr.trim())
    } catch (error) {
        throw new Error(`tbls 生成失败，请先安装 tbls 或设置 TBLS_BIN。${error.stderr || error.stdout || error.message}`, { cause: error })
    }
}
await mkdir(output, { recursive: true })
const fixture = await testDatabase({ maxConnections: 8 })
try {
    await fixture.sql.migrate.latest()
    await fixture.sql.destroy()
    const args = ['--config', configFile]
    await run(['doc', fixture.connection, output, ...args, '--force'])
    await run(['out', fixture.connection, ...args, '-t', 'mermaid', '-o', `${output}/er.mmd`])
    await run(['lint', fixture.connection, ...args])
    await run(['coverage', fixture.connection, ...args])
    await copyFile(new URL('../sql/001_initial.up.sql', import.meta.url), `${output}/schema.sql`)
    const ddl = await readFile(`${output}/schema.sql`, 'utf8')
    await writeFile(`${output}/schema-for-drawdb.sql`, ddl.split('-- Defense in depth:')[0])
    await writeFile(`${output}/seed-content.json`, JSON.stringify(makeSnapshot(), null, 2) + '\n')
    await readableArtifacts(output)
    console.log(`已生成数据库文档：${output}`)
} finally {
    await fixture.close()
}
