from pathlib import Path
import json, hashlib, html, re
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, A3, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, PageBreak, NextPageTemplate, LongTable, TableStyle, KeepTogether, Image
from reportlab.graphics import renderPDF
from svglib.svglib import svg2rlg
from pypdf import PdfReader, PdfWriter

ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / 'docs/database'
PRIVATE = ROOT / '.local'
OUTPUT = ROOT / 'output/pdf'
OUTPUT.mkdir(parents=True, exist_ok=True)
SCHEMA = json.loads((DATA/'schema.json').read_text(encoding='utf-8'))
EVIDENCE = json.loads((DATA/'migration-evidence.json').read_text(encoding='utf-8'))
PERSIST = json.loads((PRIVATE/'persistence-report.json').read_text(encoding='utf-8'))
SOURCE = json.loads((DATA/'seed-content.json').read_text(encoding='utf-8'))
TITLES = {'users':'用户','events':'事件目录','content_versions':'内容版本','career_runs':'生涯历史','run_actions':'选择记录','talents':'天赋','achievements':'成就','characters':'职业出身','character_talents':'出身天赋','event_choices':'事件选项','event_branches':'自动分支','quarter_events':'季度事件池','endings':'职业结局','player_profiles':'玩家档案','profile_talents':'已收集天赋','profile_events':'已经历事件','profile_achievements':'已达成成就','archive_imports':'档案导入审计'}
ORDER = ['users','content_versions','events','event_choices','event_branches','quarter_events','endings','talents','achievements','characters','character_talents','player_profiles','profile_talents','profile_events','profile_achievements','career_runs','run_actions','archive_imports']
TABLES = {t['name'].replace('public.',''):t for t in SCHEMA['tables']}
pdfmetrics.registerFont(TTFont('CN','C:/Windows/Fonts/msyh.ttc',subfontIndex=0))
pdfmetrics.registerFont(TTFont('CNB','C:/Windows/Fonts/msyhbd.ttc',subfontIndex=0))
pdfmetrics.registerFontFamily('CN',normal='CN',bold='CNB')
for name, filename in [('Arial','arial.ttf'),('Arial-Bold','arialbd.ttf')]:
    pdfmetrics.registerFont(TTFont(name,'C:/Windows/Fonts/'+filename))
pdfmetrics.registerFontFamily('Arial',normal='Arial',bold='Arial-Bold')
NAVY=colors.HexColor('#173956'); BLUE=colors.HexColor('#2a6796'); PALE=colors.HexColor('#eaf1f8'); INK=colors.HexColor('#26374b'); GRAY=colors.HexColor('#64778c')
styles={
 'Body':ParagraphStyle('Body',fontName='CN',fontSize=9.1,leading=15,spaceAfter=8,textColor=INK,wordWrap='CJK'),
 'Lead':ParagraphStyle('Lead',fontName='CN',fontSize=9,leading=14,spaceAfter=8,textColor=GRAY,wordWrap='CJK',keepWithNext=True),
 'H1':ParagraphStyle('H1',fontName='CNB',fontSize=18,leading=26,spaceBefore=6,spaceAfter=15,textColor=NAVY,keepWithNext=True,wordWrap='CJK'),
 'H2':ParagraphStyle('H2',fontName='CNB',fontSize=11.4,leading=18,spaceBefore=14,spaceAfter=7,textColor=BLUE,keepWithNext=True,wordWrap='CJK'),
 'Small':ParagraphStyle('Small',fontName='CN',fontSize=7.8,leading=12,spaceAfter=6,textColor=GRAY,wordWrap='CJK'),
 'Cell':ParagraphStyle('Cell',fontName='CN',fontSize=8.1,leading=12,wordWrap='CJK',textColor=INK),
 'TH':ParagraphStyle('TH',fontName='CNB',fontSize=8.2,leading=12,wordWrap='CJK',textColor=colors.white),
 'Code':ParagraphStyle('Code',fontName='CN',fontSize=8.1,leading=13,spaceAfter=8,backColor=PALE,borderPadding=8,wordWrap='CJK'),
 'Cover':ParagraphStyle('Cover',fontName='CNB',fontSize=28,leading=43,textColor=NAVY,spaceAfter=20,wordWrap='CJK'),
 'Subtitle':ParagraphStyle('Subtitle',fontName='CN',fontSize=16,leading=26,textColor=BLUE,spaceAfter=16,wordWrap='CJK'),
}
def p(text,style='Body'):
    return Paragraph(html.escape(str(text)).replace('\n','<br/>'),styles[style])
def table(headers, rows, widths, small=False):
    content=[[p(x,'TH') for x in headers]]+[[p(x,'Cell' if not small else 'Small') for x in row] for row in rows]
    t=LongTable(content,colWidths=widths,repeatRows=1,hAlign='LEFT')
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),NAVY),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),('LINEBELOW',(0,0),(-1,0),0.8,NAVY),('LINEBELOW',(0,1),(-1,-1),0.35,colors.HexColor('#dce5ee')),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#f7f9fc')])]))
    return t

class Report(BaseDocTemplate):
    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph) and flowable.style.name=='H1':
            key='section'+str(self.seq.nextf('section'))
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(flowable.getPlainText(),key,0)
def decoration(c,doc):
    w,h=c._pagesize
    c.setStrokeColor(colors.HexColor('#d2dce8')); c.setLineWidth(.5)
    c.line(40,h-33,w-40,h-33); c.line(40,35,w-40,35)
    c.setFont('CN',7.5); c.setFillColor(GRAY)
    c.drawString(42,h-24,'DEVLIFE  |  数据库设计与真实迁移')
    c.drawRightString(w-42,h-24,'PostgreSQL 18.6  /  2026-11-10')
    c.drawString(42,22,'完整 36 季度版 - 依据源码及实际数据库生成')
    c.drawRightString(w-42,22,str(doc.page))
draft=PRIVATE/'database-report-base.pdf'
doc=Report(str(draft),pagesize=A4,leftMargin=44,rightMargin=44,topMargin=47,bottomMargin=48,title='程序员职业生涯模拟系统 - 数据库设计与真实迁移报告',author='刘泽浩',subject='数据库选型、完整 ER 图、数据字典、迁移、种子及真实验证')
for name,size in [('A4',A4),('A3L',landscape(A3))]:
    w,h=size
    doc.addPageTemplates(PageTemplate(id=name,pagesize=size,frames=[Frame(44,48,w-88,h-95,leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)],onPage=decoration))
W=A4[0]-88
story=[]
def add(text,style='Body'):story.append(p(text,style))
def section(title,new=True):
    if new:story.append(PageBreak())
    add(title,'H1')
def figure(filename,width,height):
    d=svg2rlg(str(DATA/filename))
    factor=min(width/d.width,height/d.height)
    d.scale(factor,factor);d.width*=factor;d.height*=factor
    story.append(d)

story += [Spacer(1,43)]
add('程序员职业生涯\n模拟系统','Cover')
add('数据库设计与真实迁移报告','Subtitle')
add('选型分析  /  完整 ER 图  /  数据字典\n实际迁移  /  种子数据  /  软件初始化与验证','Body')
story += [Spacer(1,24)]
story.append(table(['数据库','业务表','字段','外键','软件范围'],[['PostgreSQL 18.6','18','98','21','36 季度']], [123,76,76,76,W-351]))
story += [Spacer(1,28)]
add('本次交付结论','H2')
add('已建立本机独立 PostgreSQL 持久实例，导入现有软件的完整真实内容，并接通软件内容读取、跨局档案保存、首次本地档案导入和已完成生涯归档。图与字典以实际数据库元数据为依据。')
add('已迁移：98 个事件、25 个选项、28 个天赋、20 个成就、6 种职业出身、6 类结局及第 0 至 36 季度的全部事件池。')
add('已验证：原生 PostgreSQL 集成测试 16/16 通过；真实并发写入、实例重启、18 表逻辑备份恢复、软件 36 季度生涯归档与重载均通过。')
add('作者：刘泽浩    学号：230341320\n编制日期：2026-11-10    版本：完整软件迁移版','Small')
add('说明：本报告以本轮明确选择的现有 36 季度软件为准，替代先前用于课程简化设计的 24 季度范围。MNY 继续表示游戏积蓄点数。','Small')

section('01  需求与数据库选型')
add('分析对象是已有 React / TypeScript 职业模拟器。源内容存在事件引用、选项结果、职业出身与天赋、跨局成就和玩家档案；需要保留原始 ID、规则语义与内容版本，而不是只保存几段叙述文本。')
story.append(table(['候选','适用性','本项目判断'],[
 ['PostgreSQL','关系约束、事务、行锁和 JSONB 可共同使用。[1][2]','推荐。适合目录关系、内容快照、档案归属与并发版本控制，也延续现有迁移工具。'],
 ['MySQL 8.4','具备原生 JSON 类型，能够实现本项目。[3]','可选，但需改写现有 JSONB、触发器与 PostgreSQL SQL；本轮没有迁移收益。'],
 ['SQLite','适合安装简单的本地单机应用；同库同时只有一个写入者。[4]','纯离线版可选。当前计划包含服务端存档和并发演示，选择客户端/服务器数据库更合适。'],
], [88,197,W-285]))
add('选型结论','H2')
add('使用 PostgreSQL 18.6。该判断基于当前项目需求和已有 SQL，不声称 PostgreSQL 在所有场景下都优于其他数据库。此次运行的是独立 Windows 原生服务进程，数据写入磁盘目录；PGlite 仅保留为快速测试工具。')
add('关系与 JSONB 的分工','H2')
add('用关系表表达可验证的引用、唯一性和多对多关系；用 JSONB 保留事件与天赋的完整定义、不可变发布快照、原引擎状态和导入审计载荷。JSONB 内部仍需应用层校验，不能把一个 object 类型检查当作业务验证完成。')
add('版本选择与来源','H2')
add('Windows 原生程序由固定版本 @embedded-postgres/windows-x64 18.6.0-beta.19 提供，经 npm 公布的 SHA-512 完整性核对。beta 标识属于分发包装版本；实际 SELECT version() 返回 PostgreSQL 18.6。官方 Windows 下载入口也提供二进制归档。[5][6]')
add('保留边界','H2')
add('当前为本机单玩家模式，使用自动生成的 local_player。软件仍由客户端引擎计算事件结果，后端承担内容读取、档案和历史持久化；未宣称实现公网多用户登录、进行中刷新续玩或服务端权威结算。')

section('02  本机初始化与软件配置')
story.append(table(['项目','实际配置'],[
 ['数据库实例','PostgreSQL 18.6；127.0.0.1:55432；数据库 devlife；UTF-8；时区 Asia/Shanghai'],
 ['磁盘目录','仓库内 .local/postgres18；与系统已有数据库隔离，不注册系统服务，不对外网监听。'],
 ['数据库账号','devlife_owner 执行迁移；devlife_app 执行软件允许的 DML。两者均非超级用户。'],
 ['软件账号','local_admin 与 local_player；初始化生成独立随机口令，数据库内保存随机盐 scrypt 哈希。当前界面自动使用本机玩家，不开放登录入口。'],
 ['凭据保存','自动写入 .local/runtime.json，目录 ACL 限当前用户及 SYSTEM；不入 Git，不写入本报告。'],
 ['网页配置','apps/web/.env.local 自动设置 VITE_STORAGE_MODE=postgres；Vite 开发模式代理 /api 到本机服务。'],
 ['软件地址','http://127.0.0.1:8787；API 与构建后的网页同源提供。'],
], [100,W-100]))
add('以后重新启动','H2')
add('在仓库根目录运行：\npnpm install --frozen-lockfile\npnpm setup:local\npnpm start:local','Code')
add('setup:local 按顺序导出当前 TypeScript 内容、初始化专用实例、执行未应用迁移、装载源内容种子、设置网页存储模式并构建网页。重复运行不会重置已有玩家档案或已发布快照。start:local 启动实例及本机网页服务。')
add('诊断与生命周期','H2')
add('pnpm db:status     查看已应用迁移\npnpm db:test:real  在独立临时库验证真实 PostgreSQL\npnpm db:docs       从实际数据库重新生成图与字典\npnpm db:stop       停止专用实例并保留磁盘数据','Code')
add('运行时权限验证已通过：devlife_app 可以读取内容目录，但不能更新发布版本、读取用户口令哈希或创建表。若今后开放公网或多人访问，需要另行补充登录与会话、授权、HTTPS 和部署维护。','Small')

section('03  真实迁移的数据与映射')
rows=[['事件','98','events；source_id 保留原整数 ID，id 使用数据库 UUID'],['事件选项','25','event_choices；保留源字符串选项 ID，关联结果事件'],['自动分支','16','event_branches；保留条件与原始判定顺序'],['季度事件池条目','338','quarter_events；保留季度、层级、顺序、权重'],['天赋','28','talents；完整保留 effect、condition、max 等定义'],['成就','20','achievements；保留四类判定时机与条件'],['职业出身及天赋关联','6 / 18','characters、character_talents'],['职业结局','6','endings；引用真实结局事件'],['完整内容版本','1','content_versions；formatVersion=2，source=game36'],['本机账号与档案','2 / 1','users、player_profiles；初始化账号和空档案，不伪造既有玩家经历']]
story.append(table(['源数据','数量','数据库落点'],rows,[100,55,W-155]))
add('源文件与完整性','H2')
add('数据从 packages/data/src/index.ts 导出的实际 Map 和数组生成，不从旧版 Excel、24 季度演示种子或手工编造事件读取。原始定义存入 events.definition、talents.definition，所有目录一起进入完整内容快照。')
add('规范化内容 SHA-256：\n'+EVIDENCE['checksum'],'Code')
add('本轮核验：发布快照与源内容哈希相同；全部事件定义、全部天赋定义与源数组逐项相同；所有事件结果、分支、出身天赋及事件池引用经源校验与外键校验。空事件池层保留在完整快照的 ages 数组中。')
add('数值语义','H2')
add('CHR=沟通，INT=技术，STR=健康，MNY=积蓄点数，SPR=心态，AGE=季度，LIF=生命周期标记。未将 MNY 转为工资或现金。条件表达式留给原游戏条件引擎解释，不作为 SQL 拼接执行。')

for title, filename, description in [
 ('04  完整 ER 图','er.svg','覆盖全部 18 张业务表及 21 条物理外键。图中显示主键、外键及参与唯一约束的关键字段；所有其他字段见后续完整数据字典。'),
 ('05  内容域 ER 图','er-static.svg','事件、选项、自动分支、季度事件池、结局、天赋、成就与职业出身。条件表达式与完整定义保存在对应 JSONB 或文本字段中。'),
 ('06  持久化域 ER 图','er-storage.svg','用户、发布版本、生涯历史、选择记录、玩家档案、收集关联和导入审计。events、talents、achievements 是本图引用的内容目录。'),
]:
 story.extend([NextPageTemplate('A3L'),PageBreak()])
 add(title,'H1');add(description,'Body')
 figure(filename,landscape(A3)[0]-88,landscape(A3)[1]-220)
 story.append(Spacer(1,16))
 add('图例：PK 主键；FK 外键；UQ 唯一约束。双短线表示一，圆圈表示可选，三叉表示多。全部物理外键的列名和基数在关系总表中列出。','Small')
 add('events 与 content_versions.snapshot 之间是“校验后复制内容”的业务关系，没有物理外键；完整快照使旧生涯不受后来目录更新影响。该关系未伪画成数据库外键。','Small')

story.extend([NextPageTemplate('A4'),PageBreak()])
add('07  完整数据字典','H1')
add('共 18 张表、98 个字段。以下类型、空值、默认值、键和中文说明来自已迁移的原生 PostgreSQL；98/98 个字段及 18/18 张表均有注释。表内 UQ 表示参与唯一约束；联合唯一列需要结合下方约束说明理解。')
for n,name in enumerate(ORDER,1):
 t=TABLES[name]
 add(f'{n:02d}. {name}  /  {TITLES[name]}','H2');add(t.get('comment',''),'Lead')
 rows=[]
 for col in t['columns']:
  flags=[]
  for constraint in t.get('constraints',[]):
   if col['name'] in constraint.get('columns',[]) and constraint['type'] in ['PRIMARY KEY','FOREIGN KEY','UNIQUE']:
    flag={'PRIMARY KEY':'PK','FOREIGN KEY':'FK','UNIQUE':'UQ'}[constraint['type']]
    if flag not in flags:flags.append(flag)
  typ=col['type'].replace('timestamp with time zone','timestamptz').replace('double precision','float8').replace('character(','char(')
  default=col.get('default','无').replace('::character varying','').replace('::jsonb','')
  rows.append([col['name'],typ,'是' if col['nullable'] else '否',default or '无','/'.join(flags) or '无',col.get('comment','')])
 story.append(table(['字段','类型','可空','默认值','键','业务说明'],rows,[104,68,25,66,36,W-299]))
 constraints=[]
 for constraint in t.get('constraints',[]):
  if constraint['type'] in ['PRIMARY KEY','UNIQUE']:
   constraints.append(('主键' if constraint['type']=='PRIMARY KEY' else '唯一')+'('+', '.join(constraint.get('columns',[]))+')')
 add('键约束：'+'；'.join(constraints)+'。','Small')
 indexes=[i['name'] for i in t.get('indexes',[]) if not any(i['name']==c['name'] and c['type'] in ['PRIMARY KEY','UNIQUE'] for c in t.get('constraints',[]))]
 if indexes:add('补充索引：'+'；'.join(indexes)+'。','Small')

section('08  所有外键关系与取值约束')
rows=[]
for r in SCHEMA['relations']:
 parent=r['parent_table'].replace('public.','')
 child=r['table'].replace('public.','')
 parent_card={'exactly_one':'1','zero_or_one':'0..1'}.get(r['parent_cardinality'],r['parent_cardinality'])
 child_card={'zero_or_more':'0..N','one_or_more':'1..N','zero_or_one':'0..1','exactly_one':'1'}.get(r['cardinality'],r['cardinality'])
 rows.append([child+'.'+','.join(r['columns']),parent+'.'+','.join(r['parent_columns']),parent_card+' : '+child_card])
story.append(table(['子表及外键列','父表及被引用列','父 : 子'],rows,[220,207,W-427],small=True))
add('外键均为 ON UPDATE RESTRICT / ON DELETE RESTRICT，避免删除目录或用户时留下孤立引用；每条外键已具备可用索引，含复合主键、唯一索引前缀和显式辅助索引。')
add('关键取值域','H2')
story.append(table(['范围','约束'],[['用户','role 只能为 player/admin；auth_version 非负；用户名去空白后长度 3 至 32。'],['目录','天赋与成就 grade 为 0 至 3；事件源 ID 为正；事件池权重大于零；顺序字段非负。'],['档案与历史','times、version 非负；quarter 为 0 至 36；status 属于 ready/awaiting_choice/ended。'],['JSONB','完整定义及快照为 object；选项为 array；可空的角色与历史属性在非空时必须为 object。'],['校验和','checksum 和 payload_hash 为 64 位小写十六进制。数据库只检查格式，实际哈希由代码计算。'],['不可变版本','触发器拒绝 content_versions 的 UPDATE、DELETE、TRUNCATE。']],[100,W-100]))

section('09  JSONB 内部字典与快照语义')
story.append(table(['字段 / 对象','内部结构与意义'],[
 ['events.definition','原 Event：id、event、grade、effect、postEvent、NoRandom、include、exclude、branch[]、dialogue、choices[]；保留实际存在的可选键。'],
 ['talents.definition','原 Talent：id、name、description、grade、effect、condition、max、exclusive、points、exclude[]、replacement。'],
 ['content_versions.snapshot','formatVersion=2、source=game36、careerQuarters=36；events[]、talents[]、achievements[]、characters[]、ages[]、endings[]、specialThanks[]。'],
 ['career_runs.state.props','current、highest、lowest；每个属性对象含 age、charm、intelligence、strength、money、spirit。'],
 ['career_runs.state','props、life、talents[]、events[]、achievements[]、talentTriggers[[id,count]]、decisions[]；存在待选时含 pendingChoice。Set 转数组，Map 转键值对数组。'],
 ['pendingChoice / decisions','待选：instance、event、quarter。已选决定另含 choice、changes；changes 使用原引擎 Allocation 属性键。'],
 ['player_profiles.unique_character','property={CHR,INT,STR,MNY}；talent=[天赋ID]。与预置 characters 表区分。'],
 ['archive_imports.payload','{profile:原 localStorage 字符串或 null, unique:原字符串或 null}；保存原始内容以供追溯，不包含数据库凭据。'],
 ['run_actions.result','当前保存原始 Decision 及 changes；每次决定按生涯 ID 和 instance 派生稳定 request_id。它不是服务端结算 API 的响应回放证明。'],
], [143,W-143]))
add('应用层验证','H2')
add('导入要求已知事件、天赋和成就 ID，生涯次数为安全非负整数，保留天赋最多一项；生成角色要求四项属性为有限数值。未知引用或损坏 JSON 会拒绝导入，保留原本地内容。源内容导入先验证全部结果事件、分支、职业出身和事件池引用，再在事务中装载。')

section('10  迁移、种子与软件接入')
story.append(table(['迁移','作用','回滚边界'],[
 ['202611090001_initial.mjs','保留历史五实体 SQL 基线，便于追溯。','删除基础表；只在可丢弃临时库测试。'],
 ['202611100002_game36.mjs','扩展到 36 季度，增加完整目录和玩家关联，共 18 表。','检测到生涯数据时拒绝直接降回 24 季度；先备份和迁移数据。'],
 ['202611100003_comments.mjs','独立修订沿用字段的实际语义与说明。','仅注释修订；down 不改变数据。'],
], [171,182,W-353]))
add('实际应用记录','H2')
for name in EVIDENCE['migrations']:add(name,'Code')
add('种子规则','H2')
add('当前种子入口为 seeds36/001_source.mjs。按原源 ID 更新只读内容目录，重建对应事件池和关系投影；相同校验和的发布版本只插入一次。已有玩家档案、导入审计和生涯历史不被清空或重置。旧的 24 季度示例种子不进入当前运行配置。')
add('软件初始化与保存链路','H2')
add('启动时 GET /api/content 从 PostgreSQL 读取已发布快照，填充原软件内容 Map；GET /api/profile 还原关联表为原档案结构。首次未初始化时读取当前浏览器同源的 devlife:v1:profile、devlife:v1:unique，再 POST 导入并保留原始审计。')
add('跨局保存使用 PATCH /api/profile：事务先 SELECT FOR UPDATE 锁定档案，比较 expectedVersion，再原子更新档案及收集关联。软件排队提交同一窗口的写入；失败保留本地副本并提示。已完成生涯通过 POST /api/careers 持久化状态及八次决定。')
add('本地档案的边界','H2')
add('localStorage 按浏览器和网址隔离。软件只能自动读取当前浏览器同一地址下的旧值，不能跨浏览器或跨端口扫描私人档案。本次新开的验收地址没有既有个人档案，验收生涯是本轮验证新生成的记录；没有把它称作旧历史迁移。')

section('11  真实验证与备份恢复')
story.append(table(['验证项','已观察到的结果'],[
 ['原生数据库集成','16 个 Node 测试全部通过，覆盖 15 个子项及总测试；运行于独立原生 PostgreSQL 临时库。'],
 ['真实源内容','98 个事件、28 个天赋的完整定义与源文件相同；完整发布快照 SHA-256 相同。'],
 ['重复迁移 / 种子','未应用迁移才执行；重复种子不增加发布版本，不覆盖玩家档案或生涯记录。'],
 ['并发写入','两个真实事务用相同 expectedVersion 更新同一档案：一项成功、一项 409，版本只增一次。'],
 ['约束与失败回滚','重复选项和孤立引用被拒绝；无效档案不改变原数据；事务中故意抛错后档案及关联均回滚。'],
 ['账号权限','运行账号不能改发布版本、读口令哈希或创建表。'],
 ['软件验收','完成第 0 至 36 季度、8 次关键决定；生成 1 段生涯历史和 8 条选择记录；重新载入后仍显示已完成 1 段生涯。'],
 ['代码检查','网页存档测试 7/7 通过；pnpm typecheck 与生产构建通过。'],
 ['迁移回滚重放','独立空验证库撤销全部迁移后重新执行，业务表重新创建成功。'],
 ['持久化与恢复','专用实例停止并启动后数据一致；18 张表的逻辑备份恢复到隔离数据库后逐行规范化哈希一致。'],
], [111,W-111]))
add('备份格式与位置','H2')
add(f"截至本轮数据库摘要生成，已保存 {EVIDENCE['browserValidation']['completedCareers']} 段完成生涯、{EVIDENCE['browserValidation']['decisionRecords']} 条选择记录，玩家档案完成次数为 {EVIDENCE['browserValidation']['profileTimes']}。这些是本轮运行期新增记录；上表的软件验收描述对应其中已观察到的完整一局。")
add('备份脚本使用 REPEATABLE READ / READ ONLY 事务读取所有 18 张业务表，保留原时间戳与 JSONB 内容，写入受 ACL 保护的 .local/backups/devlife-36-complete.json。恢复时先重放迁移，再按外键依赖顺序插入，逐表比较行哈希。恢复验证库采用固定前缀和随机名称，校验后才删除。')
add('备份 SHA-256：\n'+PERSIST['backupSha256'],'Code')
add('本报告不附带包含账号哈希或玩家记录的真实备份文件；凭据和个人档案也不写入公开说明。附带的是结构、真实源内容种子及公开验证摘要。','Small')

section('12  交付清单、限制与参考')
story.append(table(['交付','内容'],[['本 PDF','选型、实际配置、三张完整/分域 ER 图、98 字段字典、21 外键表、JSONB 字典、迁移与种子、真实验证。'],['PDF 内嵌附件','完整 schema.sql、36 季度实际源内容 JSON、源种子入口、Mermaid 与 DOT 图源、中文数据字典、迁移核验摘要、运行说明。'],['仓库可复现流程','setup:local / start:local / db:status / db:test:real / db:docs / db:verify-persistence。']],[102,W-102]))
add('需要明确的限制','H2')
add('当前软件仍使用客户端引擎结算，后端负责持久保存，不提供防作弊保证。已完成生涯可以归档；进行中的一局刷新续玩、可重放 RNG 状态及服务端权威事件结算尚未实现。rng_state=client-unavailable 如实表示客户端没有提供可恢复随机状态。')
add('本机自动配置使用单玩家账号。其他机器、公网、多用户身份和安全会话需要独立设计；本次未修改 Windows 开机服务或其他已安装数据库，也未对外发布站点。')
add('实际资料来源','H2')
refs=[
 '[1] PostgreSQL 18 JSON Types：https://www.postgresql.org/docs/18/datatype-json.html',
 '[2] PostgreSQL 18 Explicit Locking：https://www.postgresql.org/docs/18/explicit-locking.html',
 '[3] MySQL 8.4 JSON Data Type：https://dev.mysql.com/doc/refman/8.4/en/json.html',
 '[4] SQLite Appropriate Uses：https://www.sqlite.org/whentouse.html',
 '[5] PostgreSQL Windows Downloads：https://www.postgresql.org/download/windows/',
 '[6] Embedded Postgres 项目：https://github.com/leinelissen/embedded-postgres',
 '[7] Knex Migrations：https://knexjs.org/guide/migrations',
 '[8] tbls：https://github.com/k1LoW/tbls；Graphviz / Viz.js：https://viz-js.com/api/',
]
for text in refs:add(text,'Small')
add('源码依据：packages/data/src/programmer/、packages/core/src/state.ts、apps/web/src/storage/；结构依据：实际 PostgreSQL 元数据及已应用迁移。AI 辅助整理模型、编写脚本与执行检查；本报告不宣称已获得作者逐行复核或教师评审。','Small')

doc.build(story)
writer=PdfWriter()
writer.append(PdfReader(str(draft)))
attachments=[('schema.sql',DATA/'schema.sql'),('game36-source.json',DATA/'seed-content.json'),('seed36.mjs',ROOT/'packages/database/seeds36/001_source.mjs'),('er.mmd',DATA/'er.mmd'),('er.dot',DATA/'er.dot'),('data-dictionary.md',DATA/'数据字典.md'),('migration-evidence.json',DATA/'migration-evidence.json'),('README.md',ROOT/'packages/database/README.md')]
for name,file in attachments:writer.add_attachment(name,file.read_bytes())
writer.add_metadata({'/Title':'程序员职业生涯模拟系统 - 数据库设计与真实迁移报告','/Author':'刘泽浩','/Subject':'18 张表、98 个字段、21 条外键；完整 36 季度；真实 PostgreSQL 迁移与软件初始化'})
final=OUTPUT/'程序员职业生涯模拟系统_数据库设计与真实迁移报告.pdf'
with final.open('wb')as f:writer.write(f)
reader=PdfReader(str(final))
text='\n'.join(page.extract_text()or'' for page in reader.pages)
missing=[name for name in ORDER if name not in text]
if missing:raise RuntimeError('PDF 缺少表：'+str(missing))
result={'file':str(final),'pages':len(reader.pages),'attachments':len(attachments),'tableCount':18,'fieldCount':98,'foreignKeyCount':21,'missingTables':missing,'sha256':hashlib.sha256(final.read_bytes()).hexdigest(),'bytes':final.stat().st_size}
(OUTPUT/'PDF检查记录.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False))
