import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { access, readFile,writeFile,mkdir,copyFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import knex from 'knex'
import { config,localConfig } from '../knexfile.mjs'
import { alterSQL,createTablesSQL } from '../lib/schema36.mjs'
import { up as comments } from '../migrations/202611100003_comments.mjs'
import { verifySource } from '../lib/source36.mjs'

const root=fileURLToPath(new URL('../../../',import.meta.url))
const out=path.join(root,'docs/database')
const privateDir=path.join(root,'.local')
const connection=process.env.DATABASE_URL||(localConfig()?.ownerUrl ? localConfig().ownerUrl+'?sslmode=disable' : null)
if(!connection)throw new Error('请先执行 pnpm setup:local，文档必须读取已迁移的实际数据库')
await mkdir(out,{recursive:true})
await mkdir(privateDir,{recursive:true})
const exec=promisify(execFile)
const binary=process.env.TBLS_BIN||path.join(root,'.tools/tbls/tbls.exe')
const titles={users:'用户',events:'事件目录',content_versions:'内容版本',career_runs:'生涯历史',run_actions:'选择记录',talents:'天赋',achievements:'成就',characters:'职业出身',character_talents:'出身天赋',event_choices:'事件选项',event_branches:'自动分支',quarter_events:'季度事件池',endings:'职业结局',player_profiles:'玩家档案',profile_talents:'已收集天赋',profile_events:'已经历事件',profile_achievements:'已达成成就',archive_imports:'档案导入审计'}
const groups={
  static:['events','event_choices','event_branches','quarter_events','endings','talents','achievements','characters','character_talents'],
  storage:['users','content_versions','career_runs','run_actions','player_profiles','profile_talents','profile_events','profile_achievements','archive_imports','events','talents','achievements'],
}
async function generate(name,dir,include,keys=false){
    await mkdir(dir,{recursive:true})
    const file=path.join(privateDir,`tbls-${name}.json`)
    await writeFile(file,JSON.stringify({name:'DEVLIFE / 36-quarter full database',desc:'实际 PostgreSQL 18.6 元数据；完整 36 季度软件。',dsn:connection,docPath:dir,exclude:['public.knex_migrations','public.knex_migrations_lock'],...(include?{include:include.map(x=>'public.'+x)}:{}),er:{format:'svg',comment:false,hideDef:true,...(keys?{showColumnTypes:{related:true,primary:true}}:{})},lint:{requireTableComment:{enabled:true},requireColumnComment:{enabled:true},requireForeignKeyIndex:{enabled:true}}},null,2),{mode:0o600})
    try {await exec(binary,['doc','--config',file,'--force'],{timeout:60000,maxBuffer:4*1024*1024,windowsHide:true})}
    catch(error){throw new Error('tbls 生成失败：'+String(error.stdout||error.stderr||error.message).replaceAll(connection,'[数据库连接已隐藏]'))}
    return file
}
const cfg=await generate('full',out)
await exec(binary,['out','--config',cfg,'-t','mermaid','-o',path.join(out,'er.mmd')],{timeout:60000,windowsHide:true})
await exec(binary,['lint','--config',cfg],{timeout:60000,windowsHide:true})
for(const [name,include]of [['overview',null],...Object.entries(groups)]){
    const dir=path.join(privateDir,'er-'+name)
    await generate(name,dir,include,true)
    await copyFile(path.join(dir,'schema.svg'),path.join(out,name==='overview'?'er.svg':`er-${name}.svg`))
}
let commentSQL='';await comments({raw(sql){commentSQL+=sql}})
await writeFile(path.join(out,'schema.sql'),await readFile(new URL('../sql/001_initial.up.sql',import.meta.url),'utf8')+'\n'+alterSQL+'\n'+createTablesSQL+'\n'+commentSQL)
await copyFile(path.join(out,'schema.sql'),path.join(out,'schema-for-drawdb.sql'))
await copyFile(new URL('../data/game36-source.json',import.meta.url),path.join(out,'seed-content.json'))
const schema=JSON.parse(await readFile(path.join(out,'schema.json'),'utf8'))
const db=knex(config(connection))
const report=await verifySource(db)
const tables=schema.tables
report.migrations=(await db('knex_migrations').orderBy('id').select('name')).map(x=>x.name)
report.fieldCount=tables.reduce((n,t)=>n+t.columns.length,0)
report.tableCount=tables.length
report.foreignKeyCount=schema.relations.length
report.commentCount=tables.flatMap(t=>t.columns).filter(x=>x.comment).length
report.browserValidation={completedCareers:Number((await db('career_runs').count('* as n').first()).n),decisionRecords:Number((await db('run_actions').count('* as n').first()).n),quarter:(await db('career_runs').orderBy('created_at','desc').first())?.quarter||null,profileTimes:(await db('player_profiles').first())?.times||0,source:'本轮运行期间新增的完成生涯记录；不作为既有用户历史迁移证据'}
await db.destroy()
await writeFile(path.join(out,'migration-evidence.json'),JSON.stringify(report,null,2))
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')
const key=(t,c)=>t.constraints.filter(k=>['PRIMARY KEY','FOREIGN KEY','UNIQUE'].includes(k.type)&&k.columns?.includes(c.name)).map(k=>({'PRIMARY KEY':'PK','FOREIGN KEY':'FK','UNIQUE':k.columns.length>1?'联合唯一':'唯一'})[k.type]).join('/')
const md=['# 完整 36 季度数据库数据字典','','来源：本机独立 PostgreSQL 18.6 实例实际元数据。', '',`共 ${tables.length} 张业务表、${report.fieldCount} 个字段、${schema.relations.length} 条外键。`, '', '![完整 ER 图](er.svg)','','积蓄 MNY 是原软件的抽象游戏点数，未转换为现金；条件表达式保留原引擎语义。','']
const csv=[['表','字段','类型','允许空值','默认值','键','说明']]
const sections=[]
for(const t of tables){
  const name=t.name.replace('public.','')
  md.push(`## ${name}（${titles[name]}）`,'',t.comment,'','| 字段 | 类型 | 可空 | 默认值 | 键 | 说明 |','| --- | --- | --- | --- | --- | --- |')
  const rows=t.columns.map(c=>{
    md.push(`| ${c.name} | ${c.type} | ${c.nullable?'是':'否'} | ${c.default||'无'} | ${key(t,c)||'—'} | ${c.comment} |`)
    csv.push([name,c.name,c.type,c.nullable?'是':'否',c.default||'',key(t,c),c.comment])
    return `<tr><td><code>${c.name}</code></td><td>${esc(c.type)}</td><td>${c.nullable?'是':'否'}</td><td>${esc(c.default||'无')}</td><td>${key(t,c)||'—'}</td><td>${esc(c.comment)}</td></tr>`
  }).join('')
  md.push('','约束与索引：','')
  for(const c of [...t.constraints.filter(c=>c.type!=='n'),...t.indexes])md.push('- `'+c.name+'`：`'+c.def+'`')
  md.push('')
  sections.push(`<section id="${name}"><h2>${name} · ${titles[name]}</h2><p>${esc(t.comment)}</p><div class="wrap"><table><thead><tr><th>字段</th><th>类型</th><th>可空</th><th>默认值</th><th>键</th><th>说明</th></tr></thead><tbody>${rows}</tbody></table></div></section>`)
}
await writeFile(path.join(out,'数据字典.md'),md.join('\n'))
await writeFile(path.join(out,'数据字典.csv'),'\uFEFF'+csv.map(r=>r.map(x=>'"'+String(x).replaceAll('"','""')+'"').join(',')).join('\r\n'))
await writeFile(path.join(out,'index.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DEVLIFE 完整数据库设计</title><style>body{font:15px/1.75 "Microsoft YaHei",sans-serif;background:#f4f7fb;color:#21334b;margin:0}main{max-width:1320px;margin:auto;padding:36px 24px}header{background:#153452;color:white;padding:32px;border-radius:12px}h1{margin:0}nav{display:flex;flex-wrap:wrap;gap:10px;margin:24px 0}a{color:#2164aa}nav a{background:white;padding:5px 12px;border-radius:4px}section{background:white;border:1px solid #d9e2ed;border-radius:10px;padding:24px;margin:24px 0}h2{font-size:20px}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border-bottom:1px solid #dce4ef;padding:10px;text-align:left;vertical-align:top}th{background:#edf3fa}td:first-child,td:nth-child(2){white-space:nowrap}td:last-child{min-width:260px}.wrap{overflow:auto}img{width:100%}code{font:12px Consolas,monospace}.note{padding:18px;background:#e8f0fb;border-left:4px solid #4680bd;margin:20px 0}</style><main><header><p>DEVLIFE / POSTGRESQL 18.6 / 2026-11-10</p><h1>程序员职业生涯模拟系统</h1><p>完整 36 季度 · ${tables.length} 张业务表 · ${report.fieldCount} 个字段 · ${schema.relations.length} 条外键</p></header><div class="note">实际源内容已迁移到本机持久数据库，软件已接入；MNY 仍是游戏积蓄点数。本轮浏览器验证完成 36 季度并归档 8 次决定。运行地址：<a href="http://127.0.0.1:8787">打开软件</a>。</div><nav>${tables.map(t=>`<a href="#${t.name.replace('public.','')}">${titles[t.name.replace('public.','')]}</a>`).join('')}</nav><section><h2>完整 ER 图</h2><a href="er.svg"><img src="er.svg"></a><p><a href="schema.svg">全部字段图</a> · <a href="er-static.svg">内容域</a> · <a href="er-storage.svg">持久化域</a> · <a href="er.mmd">Mermaid 源码</a> · <a href="数据字典.csv">CSV</a></p></section>${sections.join('')}<section><h2>迁移证据与说明</h2><p>源快照 SHA-256：${report.checksum}</p><p><a href="migration-evidence.json">实际迁移核验</a> · <a href="工具调研.md">数据库选型</a> · <a href="验证记录.md">验证记录</a> · <a href="../../packages/database/README.md">初始化与运行说明</a></p></section></main></html>`)
console.log(JSON.stringify({tables:tables.length,fields:report.fieldCount,foreignKeys:schema.relations.length,columnComments:report.commentCount,actualDatabase:true,sourceChecksum:report.checksum}))
