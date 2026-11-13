import pg from 'pg'
import knex from 'knex'
import { randomUUID, createHash } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { config,localConfig } from '../knexfile.mjs'
import { digest } from '../lib/content.mjs'
import { verifySource } from '../lib/source36.mjs'
import { postgresControl } from './local-postgres.mjs'

const tables=['users','events','talents','achievements','characters','character_talents','event_choices','event_branches','quarter_events','endings','content_versions','player_profiles','profile_talents','profile_events','profile_achievements','career_runs','run_actions','archive_imports']
const settings=localConfig()
const db=knex(config(settings.ownerUrl))
const backup={format:1,createdAt:new Date().toISOString(),tables:{},jsonColumns:{}}
const hashRows=rows=>digest(rows.map(digest).sort())
await db.transaction(async trx=>{
    await trx.raw('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
    for(const table of tables){
        backup.tables[table]=(await trx.raw(`SELECT row_to_json(t) AS row FROM ${table} t`)).rows.map(x=>x.row)
        backup.jsonColumns[table]=(await trx('information_schema.columns').where({table_schema:'public',table_name:table,data_type:'jsonb'}).select('column_name')).map(x=>x.column_name)
    }
})
await db.destroy()
const folder=new URL('../../../.local/backups/',import.meta.url)
await mkdir(folder,{recursive:true})
const backupFile=new URL('devlife-36-complete.json',folder)
await writeFile(backupFile,JSON.stringify(backup,null,2),{mode:0o600})
const bytes=await readFile(backupFile)
const admin=new pg.Client({connectionString:settings.adminUrl})
await admin.connect()
const name='devlife_restore_'+randomUUID().replaceAll('-','')
await admin.query(`CREATE DATABASE ${name} OWNER devlife_owner TEMPLATE template0`)
const restoreURL=new URL(settings.ownerUrl);restoreURL.pathname='/'+name
const restored=knex(config(restoreURL.toString()))
let restoredChecks
try{
    await restored.migrate.latest()
    await restored.transaction(async trx=>{
        for(const table of tables){
            const rows=backup.tables[table].map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,backup.jsonColumns[table].includes(key)&&value!==null?JSON.stringify(value):value])))
            for(let i=0;i<rows.length;i+=100) await trx(table).insert(rows.slice(i,i+100))
        }
    })
    for(const table of tables){
        const rows=(await restored.raw(`SELECT row_to_json(t) AS row FROM ${table} t`)).rows.map(x=>x.row)
        if(hashRows(rows)!==hashRows(backup.tables[table]))throw new Error('备份恢复行内容不一致：'+table)
    }
    restoredChecks=await verifySource(restored)
}finally{
    await restored.destroy()
    if(!/^devlife_restore_[0-9a-f]{32}$/.test(name))throw new Error('拒绝清理非恢复验证库')
    await admin.query(`DROP DATABASE ${name} WITH (FORCE)`)
    await admin.end()
}
await postgresControl('stop')
await postgresControl('start')
const reopened=knex(config(settings.ownerUrl))
try{
    for(const table of tables){
        const rows=(await reopened.raw(`SELECT row_to_json(t) AS row FROM ${table} t`)).rows.map(x=>x.row)
        if(hashRows(rows)!==hashRows(backup.tables[table]))throw new Error('重启后数据不一致：'+table)
    }
    const report={date:new Date().toISOString(),persistentAfterRestart:true,backupFormat:'repeatable-read logical JSON; 18 tables; original timestamps preserved',backupSha256:createHash('sha256').update(bytes).digest('hex'),backupBytes:bytes.length,restoreVerifiedAll18Tables:true,sourceChecksum:restoredChecks.checksum,counts:restoredChecks.counts}
    await writeFile(new URL('../../../.local/persistence-report.json',import.meta.url),JSON.stringify(report,null,2))
    console.log(JSON.stringify(report,null,2))
}finally{await reopened.destroy()}
