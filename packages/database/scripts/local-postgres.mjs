import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, readFile, writeFile, access, unlink } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import pg from 'pg'
import knex from 'knex'
import { localConfig, localConfigPath, config } from '../knexfile.mjs'
import { verifySource } from '../lib/source36.mjs'
import { nativeBinaries } from '../lib/native-binaries.mjs'

const exec = promisify(execFile)
const root = fileURLToPath(new URL('../../../', import.meta.url))
const privateDir = path.join(root, '.local')
const dataDir = path.join(privateDir, 'postgres18')
const exists = value => access(value).then(() => true, () => false)
const secret = () => randomBytes(32).toString('hex')
const literal = value => "'" + value.replaceAll("'", "''") + "'"
const run = (binary, args) => exec(binary, args, { windowsHide: true, timeout: 60000, maxBuffer: 1024 * 1024 })
const runDetachedOutput = (binary, args) => new Promise((resolve, reject) => {
    // pg_ctl's Windows child may retain inherited pipes; ignore those handles.
    const child = spawn(binary, args, { windowsHide: true, stdio: 'ignore' })
    child.once('error', reject)
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`PostgreSQL 控制命令退出码 ${code}`)))
})

export async function postgresControl(command = 'start') {
    if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('自动安装脚本适用于 Windows x64；其他平台可使用外部 PostgreSQL 和 DATABASE_URL')
    const binaries = await nativeBinaries()
    await mkdir(privateDir, { recursive: true })
    let settings = localConfig()
    if (!settings) {
        if (await exists(path.join(dataDir, 'PG_VERSION'))) throw new Error('已有数据目录但配置丢失，拒绝重新初始化')
        const adminPassword = secret(), ownerPassword = secret(), appPassword = secret()
        settings = {
            host: '127.0.0.1', port: 55432, database: 'devlife', dataDir,
            adminUrl: `postgresql://postgres:${adminPassword}@127.0.0.1:55432/postgres`,
            ownerUrl: `postgresql://devlife_owner:${ownerPassword}@127.0.0.1:55432/devlife`,
            appUrl: `postgresql://devlife_app:${appPassword}@127.0.0.1:55432/devlife`,
            ownerPassword, appPassword, adminPassword,
            seedAdminPassword: secret(), seedPlayerPassword: secret(), apiPort: 8787,
        }
        await writeFile(localConfigPath, JSON.stringify(settings, null, 2), { mode: 0o600, flag: 'wx' })
        const account = (await run('whoami.exe', [])).stdout.trim()
        await run('icacls.exe', [privateDir, '/inheritance:r', '/grant:r', `${account}:(OI)(CI)F`, '*S-1-5-18:(OI)(CI)F'])
    }
    if (path.resolve(settings.dataDir).toLowerCase() !== path.resolve(dataDir).toLowerCase()) throw new Error('配置中的数据目录与专用目录不一致')
    if (!await exists(path.join(dataDir, 'PG_VERSION'))) {
        const passwordFile = path.join(privateDir, 'initdb-password.tmp')
        await writeFile(passwordFile, settings.adminPassword, { mode: 0o600 })
        try {
            await run(binaries.initdb, ['-D', dataDir, '-U', 'postgres', '--encoding=UTF8', '--locale=C', '--auth=scram-sha-256', `--pwfile=${passwordFile}`])
        } finally { await unlink(passwordFile) }
        await writeFile(path.join(dataDir, 'postgresql.auto.conf'), "listen_addresses = '127.0.0.1'\nport = 55432\nmax_connections = 40\nshared_buffers = '64MB'\npassword_encryption = 'scram-sha-256'\ntimezone = 'Asia/Shanghai'\n")
    }
    const running = await run(binaries.pg_ctl, ['-D', dataDir, 'status']).then(() => true, () => false)
    if (command === 'stop') {
        if (running) await run(binaries.pg_ctl, ['-D', dataDir, '-m', 'fast', '-w', 'stop'])
        console.log('专用 PostgreSQL 已停止；数据目录保留')
        return settings
    }
    if (!running) await runDetachedOutput(binaries.pg_ctl, ['-D', dataDir, '-l', path.join(privateDir, 'postgres.log'), '-w', '-t', '30', 'start'])
    const admin = new pg.Client({ connectionString: settings.adminUrl })
    await admin.connect()
    try {
        const realDir = (await admin.query('SHOW data_directory')).rows[0].data_directory
        if (path.resolve(realDir).toLowerCase() !== path.resolve(dataDir).toLowerCase()) throw new Error('数据库端口指向其他实例，已停止初始化')
        if (command === 'setup') {
            for (const [name, password] of [['devlife_owner', settings.ownerPassword], ['devlife_app', settings.appPassword]]) {
                if (!(await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [name])).rowCount) await admin.query(`CREATE ROLE ${name} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD ${literal(password)}`)
            }
            if (!(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', ['devlife'])).rowCount) await admin.query('CREATE DATABASE devlife OWNER devlife_owner ENCODING \'UTF8\' TEMPLATE template0')
        }
        console.log(`PostgreSQL ${(await admin.query('SHOW server_version')).rows[0].server_version} 已运行于 127.0.0.1:55432`)
    } finally { await admin.end() }
    return settings
}

export async function setup() {
    const settings = await postgresControl('setup')
    const db = knex(config(settings.ownerUrl))
    try {
        const [, migrations] = await db.migrate.latest()
        process.env.SEED_ADMIN_PASSWORD = settings.seedAdminPassword
        process.env.SEED_PLAYER_PASSWORD = settings.seedPlayerPassword
        await db.seed.run()
        await db.raw(`GRANT CONNECT ON DATABASE devlife TO devlife_app;
          GRANT USAGE ON SCHEMA public TO devlife_app;
          GRANT SELECT ON events, event_choices, event_branches, quarter_events, talents, achievements, characters, character_talents, endings, content_versions TO devlife_app;
          GRANT SELECT (id, username, role) ON users TO devlife_app;
          GRANT SELECT, INSERT, UPDATE ON player_profiles TO devlife_app;
          GRANT SELECT, INSERT, DELETE ON profile_events, profile_talents, profile_achievements TO devlife_app;
          GRANT SELECT, INSERT ON archive_imports, career_runs, run_actions TO devlife_app;`)
        const report = { date: new Date().toISOString(), server: (await db.raw('SELECT version() AS value')).rows[0].value, host: settings.host, port: settings.port, database: settings.database, migrationsAppliedThisRun: migrations, migrationsInstalled: (await db('knex_migrations').orderBy('id').select('name')).map(x=>x.name), ...await verifySource(db) }
        await writeFile(path.join(privateDir, 'migration-report.json'), JSON.stringify(report, null, 2))
        const envFile = path.join(root, 'apps/web/.env.local')
        let env = await readFile(envFile, 'utf8').catch(() => '')
        env = env.replace(/^VITE_STORAGE_MODE=.*\r?\n?/gm, '') + '\nVITE_STORAGE_MODE=postgres\n'
        await writeFile(envFile, env)
        console.log(JSON.stringify(report, null, 2))
    } finally { await db.destroy() }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const command = process.argv[2] || 'setup'
    try { if (command === 'setup') await setup(); else await postgresControl(command) }
    catch (error) { console.error(error.message); process.exitCode = 1 }
}
