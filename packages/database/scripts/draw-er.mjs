import { readFile,writeFile } from 'node:fs/promises'
import { pathToFileURL,fileURLToPath } from 'node:url'
import path from 'node:path'
const modulePath=process.env.VIZ_MODULE
const {instance}=modulePath?await import(pathToFileURL(modulePath)):await import('@viz-js/viz')
const viz=await instance()
const out=fileURLToPath(new URL('../../../docs/database/',import.meta.url))
const schema=JSON.parse(await readFile(path.join(out,'schema.json'),'utf8'))
const groups={overview:schema.tables.map(t=>t.name.replace('public.','')),static:['events','event_choices','event_branches','quarter_events','endings','talents','achievements','characters','character_talents'],storage:['users','content_versions','career_runs','run_actions','player_profiles','profile_talents','profile_events','profile_achievements','archive_imports','events','talents','achievements']}
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
const cardinality={zero_or_more:'0..N',one_or_more:'1..N',zero_or_one:'0..1',exactly_one:'1'}
for(const [group,names]of Object.entries(groups)){
 const included=new Set(names.map(x=>'public.'+x))
 const lines=['digraph ER {','graph [rankdir=TB, bgcolor="white", pad="0.2", nodesep="0.35", ranksep="0.85", splines=polyline];','node [shape=plain,fontname="Arial"];','edge [fontname="Arial",fontsize=10,color="#6c839e",arrowsize=0.75,dir=both];']
 for(const t of schema.tables.filter(t=>included.has(t.name))){
  const name=t.name.replace('public.','')
  const selected=t.columns.filter(c=>t.constraints.some(k=>['PRIMARY KEY','FOREIGN KEY','UNIQUE'].includes(k.type)&&k.columns?.includes(c.name)))
  const color=names.includes(name)&&['users','content_versions','career_runs','run_actions','player_profiles','archive_imports'].includes(name)?'#dfeee8':'#e1ebf8'
  lines.push(`"${t.name}" [label=<<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="7" COLOR="#b8c8da"><TR><TD COLSPAN="3" BGCOLOR="${color}"><FONT POINT-SIZE="17"><B>${name}</B></FONT></TD></TR>${selected.map(c=>{
   const flags=t.constraints.filter(k=>['PRIMARY KEY','FOREIGN KEY','UNIQUE'].includes(k.type)&&k.columns?.includes(c.name)).map(k=>({'PRIMARY KEY':'PK','FOREIGN KEY':'FK','UNIQUE':'UQ'})[k.type]).join('/')
   return `<TR><TD><FONT POINT-SIZE="11">${flags}</FONT></TD><TD ALIGN="LEFT" PORT="${c.name}"><FONT POINT-SIZE="14">${c.name}</FONT></TD><TD><FONT POINT-SIZE="11">${esc(c.type.replace('timestamp with time zone','timestamptz'))}</FONT></TD></TR>`
  }).join('')}</TABLE>>];`)
 }
 for(const r of schema.relations.filter(r=>included.has(r.table)&&included.has(r.parent_table))){
  const card=cardinality[r.cardinality]||'0..N',parent=cardinality[r.parent_cardinality]||'1'
  const head=card.includes('N')?'crowodot':card==='1'?'teetee':'teeodot'
  const tail=parent==='1'?'teetee':'teeodot'
  lines.push(`"${r.parent_table}":"${r.parent_columns[0]}" -> "${r.table}":"${r.columns[0]}" [arrowhead="${head}",arrowtail="${tail}",tooltip="${esc(r.def)}"];`)
 }
 lines.push('}')
 const dot=lines.join('\n')
 const basename=group==='overview'?'er':`er-${group}`
 await writeFile(path.join(out,basename+'.dot'),dot)
 const svg=viz.renderString(dot,{format:'svg',engine:'dot'})
 await writeFile(path.join(out,basename+'.svg'),svg)
 console.log(basename+': '+svg.match(/<svg width="[^"]+" height="[^"]+"/)?.[0])
}
