import { readFile, writeFile } from 'node:fs/promises'

const escape = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const titles = { users: '用户', events: '事件草稿', content_versions: '已发布内容版本', career_runs: '职业存档', run_actions: '动作与幂等结果' }
const order = ['users', 'events', 'content_versions', 'career_runs', 'run_actions']

function keys(table, column) {
    return table.constraints.filter(c => ['PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE'].includes(c.type) && c.columns?.includes(column.name)).map(c => ({ 'PRIMARY KEY': 'PK', 'FOREIGN KEY': 'FK', UNIQUE: c.columns.length > 1 ? '联合唯一' : '唯一' })[c.type]).join(' / ')
}

function overview(schema) {
    const positions = { users: [50, 100, 390], events: [50, 490, 390], content_versions: [530, 100, 390], career_runs: [530, 440, 390], run_actions: [1010, 440, 380] }
    const svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900" viewBox="0 0 1440 900" role="img" aria-label="程序员职业生涯模拟系统 ER 图">',
        '<rect width="1440" height="900" fill="#f4f7fb"/>',
        '<style>text{font-family:"Microsoft YaHei","Noto Sans CJK SC",sans-serif;fill:#21334b}.title{font-weight:700}.field{font-family:Consolas,monospace;font-size:15px}.type{font-family:Consolas,monospace;font-size:13px;fill:#52647c}.label{font-size:13px;fill:#476080}.key{font-size:11px;font-weight:700;fill:#2867b8}</style>',
        '<text x="50" y="44" font-size="27" class="title">程序员职业生涯模拟系统 · ER 图</text>',
        '<text x="50" y="73" font-size="15">PostgreSQL / 五个核心实体 / 24 季度课程基础版</text>',
        '<g fill="none" stroke="#6d87a8" stroke-width="2">',
        '<path d="M440 180 H530"/><path d="M440 280 H485 V550 H530"/><path d="M725 314 V440"/><path d="M920 550 H1010"/></g>',
        '<g class="label"><text x="450" y="169">1</text><text x="493" y="169">0..N</text><text x="452" y="268">1</text><text x="493" y="538">0..N</text><text x="738" y="339">1</text><text x="738" y="423">0..N</text><text x="935" y="537">1</text><text x="968" y="537">0..N</text></g>']
    for (const name of order) {
        const table = schema.tables.find(t => t.name === `public.${name}`)
        if (!table) throw new Error(`缺少表 ${name}`)
        const [x, y, width] = positions[name]
        const height = 64 + table.columns.length * 26 + 20
        svg.push(`<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="12" fill="white" stroke="#c8d4e2"/>`,
            `<path d="M${x + 12} ${y} H${x + width - 12} Q${x + width} ${y} ${x + width} ${y + 12} V${y + 64} H${x} V${y + 12} Q${x} ${y} ${x + 12} ${y}" fill="#e8f0fb"/>`,
            `<text x="${x + 18}" y="${y + 27}" font-size="19" class="title">${name}</text>`,
            `<text x="${x + 18}" y="${y + 49}" font-size="14">${titles[name]}</text>`)
        for (const [index, column] of table.columns.entries()) {
            const yy = y + 86 + index * 26
            const flag = keys(table, column).split(' / ').filter(k => ['PK', 'FK'].includes(k)).join('/')
            const type = column.type.replace('timestamp with time zone', 'timestamptz').replace('character(', 'char(')
            svg.push(`<text x="${x + 16}" y="${yy}" class="key">${flag}</text><text x="${x + 52}" y="${yy}" class="field">${column.name}</text><text x="${x + width - 15}" y="${yy}" text-anchor="end" class="type">${escape(type)}</text>`)
        }
    }
    svg.push('<text x="50" y="799" font-size="14">events 经发布校验复制到 content_versions.snapshot；这是业务关系，没有数据库外键。</text>',
        '<text x="50" y="827" font-size="14">实线表示外键；1 / 0..N 表示一对零或多；PK 为主键，FK 为外键；全部字段均不允许 SQL NULL。</text>',
        '<text x="50" y="855" font-size="14">唯一键：users.username · events.code · content_versions.checksum · run_actions(run_id, request_id)</text>',
        '</svg>')
    return svg.join('\n')
}

export async function readableArtifacts(output) {
    const schema = JSON.parse(await readFile(`${output}/schema.json`, 'utf8'))
    const tables = order.map(name => schema.tables.find(t => t.name === `public.${name}`))
    const fieldCount = tables.reduce((n, t) => n + t.columns.length, 0)
    const md = ['# 程序员职业生涯模拟系统：数据字典', '', '依据第一阶段开题稿制作的 PostgreSQL、24 季度、五实体课程基础版。数据库结构与中文说明均从已执行的迁移读取。', '', '现有浏览器游戏为 36 季度、抽象积蓄点数；本设计采用整数分现金，未接入现有网页。', '', `共 ${tables.length} 张业务表、${fieldCount} 个字段、${schema.relations.length} 条外键。全部字段 NOT NULL，外键更新与删除均为 RESTRICT。`, '', '![ER 图](er.svg)', '', 'events → content_versions 是“发布校验并复制到快照”的业务关系，不是外键。', '']
    const csv = [['表', '字段', '类型', '允许空值', '默认值', '键', '说明']]
    const sections = []
    for (const table of tables) {
        const name = table.name.replace('public.', '')
        md.push(`## ${name}（${titles[name]}）`, '', table.comment, '', '| 字段 | 类型 | 默认值 | 键 | 说明 |', '| --- | --- | --- | --- | --- |')
        const rows = table.columns.map(column => {
            const key = keys(table, column)
            md.push(`| ${column.name} | ${column.type} | ${column.default || '无'} | ${key || '—'} | ${column.comment} |`)
            csv.push([name, column.name, column.type, column.nullable ? '是' : '否', column.default || '', key, column.comment])
            return `<tr><td><code>${column.name}</code></td><td><code>${escape(column.type)}</code></td><td>${escape(column.default || '无')}</td><td>${escape(key || '—')}</td><td>${escape(column.comment)}</td></tr>`
        }).join('')
        md.push('', '约束与索引：', '')
        const constraints = table.constraints.filter(c => c.type !== 'n')
        for (const constraint of constraints) md.push('- `' + constraint.name + '`：`' + constraint.def + '`')
        for (const index of table.indexes) md.push('- 索引 `' + index.name + '`：`' + index.def + '`')
        md.push('')
        sections.push(`<section id="${name}"><h2>${name}<span>${titles[name]}</span></h2><p>${escape(table.comment)}</p><div class="table-wrap"><table><thead><tr><th>字段</th><th>类型</th><th>默认值</th><th>键</th><th>说明（全部 NOT NULL）</th></tr></thead><tbody>${rows}</tbody></table></div><details><summary>查看 ${constraints.length} 条约束及 ${table.indexes.length} 个索引</summary>${[...constraints, ...table.indexes].map(c => `<p><code>${escape(c.name)}</code><br><code class="definition">${escape(c.def)}</code></p>`).join('')}</details></section>`)
    }
    md.push('## JSONB 内部结构与责任边界', '', '| 对象 | 结构 / 语义 | 校验位置 |', '| --- | --- | --- |', '| events.choices[] | code 唯一、label 非空、effects 合法；选择事件 2–6 项 | 发布校验器 |', '| events.effects / choices[].effects | tech、health、mood 为整数点；cash_cents 为整数分；效果可为负 | 发布校验器 |', '| content_versions.snapshot | formatVersion=1、careerQuarters=24、initialState、schedule、events、endings | 发布校验器；数据库检查顶层 object |', '| career_runs.state | tech/health/mood 非负整数，cash_cents 有符号整数；待选时含 pendingEvent={code,instanceId} | 必要数值由 CHECK；待选状态对应关系由后续服务端验证 |', '| run_actions.result | 提交时完整公开响应；重试回放原响应 | 后续服务端负责生成与回放 |', '', '已发布快照的 UPDATE、DELETE、TRUNCATE 被触发器拒绝。用户名区分大小写。checksum 和 payload_hash 的格式由数据库检查，哈希与实际载荷是否一致由服务端计算。管理员发布权限、存档归属、版本比较、动作状态机、并发锁和幂等响应需要后续 API 实现。', '', '## 迁移与种子', '', '参见 [数据库运行说明](../../packages/database/README.md)。种子包含 2 个账号、12 个事件、6 个选择事件、3 类结局、1 个版本、1 个待选存档和 1 条动作记录。重复执行不重置口令，不覆盖事件草稿及存档进度。示例正文见 [seed-content.json](seed-content.json)。', '')
    await writeFile(`${output}/er.svg`, overview(schema))
    await writeFile(`${output}/数据字典.md`, md.join('\n'))
    await writeFile(`${output}/数据字典.csv`, '\uFEFF' + csv.map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\r\n'))
    const hero = `<header><div class="eyebrow">DEVLIFE · DATABASE DESIGN · 2026-11-09</div><h1>程序员职业生涯模拟系统</h1><p>ER 图与数据字典</p><div class="stats"><b>${tables.length}<small>核心实体</small></b><b>${fieldCount}<small>字段</small></b><b>${schema.relations.length}<small>外键关系</small></b><b>24<small>季度基础版</small></b></div></header>`
    const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>程序员职业生涯模拟系统 · ER 图与数据字典</title><style>
*{box-sizing:border-box}body{margin:0;background:#f4f7fb;color:#21334b;font:15px/1.75 "Microsoft YaHei",system-ui,sans-serif}main{max-width:1260px;margin:auto;padding:44px 28px}header{background:#152f50;color:white;padding:36px 42px;border-radius:16px}.eyebrow{color:#aac5e7;font:12px/1.5 Consolas,monospace;letter-spacing:2px}h1{margin:12px 0 0;font-size:32px}header p{color:#c9d9ee;font-size:20px;margin:8px 0 24px}.stats{display:flex;gap:60px}.stats b{font-size:28px;font-weight:600}.stats small{display:block;font-size:12px;font-weight:400;color:#b7cde5}nav{display:flex;gap:12px;flex-wrap:wrap;margin:24px 0}a{color:#2164aa;text-decoration:none}nav a{border:1px solid #ccd9e9;background:white;padding:6px 13px;border-radius:6px}.note{background:#e8f0fb;border-left:4px solid #4782c0;padding:16px 20px;margin:20px 0}section{background:white;border:1px solid #dbe3ef;border-radius:12px;margin:24px 0;padding:24px 28px;scroll-margin-top:20px}h2{font:600 23px/1.5 Consolas,"Microsoft YaHei",monospace;margin:0 0 10px}h2 span{font:15px "Microsoft YaHei",sans-serif;color:#6b7b91;margin-left:16px}h3{font-size:17px}section>p{color:#556981;margin:8px 0 16px}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;font-size:13px}th{text-align:left;background:#edf3fa;color:#385579;font-weight:600}td,th{padding:11px 12px;border-bottom:1px solid #e5ebf3;vertical-align:top}td:first-child,td:nth-child(2){white-space:nowrap}td:last-child{min-width:280px}td:nth-child(3){max-width:190px;overflow-wrap:anywhere}code{font:12px/1.6 Consolas,monospace}details{margin-top:16px;color:#526884}summary{cursor:pointer;font-size:13px}.definition{overflow-wrap:anywhere}img{width:100%;height:auto;display:block}.links{font-size:13px;color:#65758a}footer{font-size:13px;color:#697b92;margin:24px 0}li{margin:6px 0}@media(max-width:700px){main{padding:16px}header{padding:24px}h1{font-size:24px}.stats{gap:22px}.stats b{font-size:23px}section{padding:18px}}@media print{body{background:white}main{max-width:none;padding:0}header{print-color-adjust:exact}nav{display:none}section{break-inside:avoid;border-radius:0}details{display:none}a{color:inherit}.note{print-color-adjust:exact}h1{font-size:25px}}
</style></head><body><main>${hero}<nav>${order.map(n => `<a href="#${n}">${titles[n]}</a>`).join('')}<a href="数据字典.csv">下载 CSV</a><a href="er.mmd">Mermaid 源码</a></nav><div class="note">依据已提交的第一阶段开题稿制作：PostgreSQL、五个核心实体、24 季度。现有网页为 36 季度本地游戏；本次完成数据库设计与脚本，网页尚未接入。</div><section id="er"><h2>实体关系图</h2><a href="er.svg"><img src="er.svg" alt="五个核心实体和四条外键关系"></a><p class="links"><a href="schema.svg">查看含字段注释的完整 ER 图</a> · <a href="schema-for-drawdb.sql">DrawDB 导入 SQL</a> · <a href="schema.sql">完整建库 SQL</a></p></section>${sections.join('')}<section><h2>JSONB 与规则边界</h2><ul><li><code>choices[]</code>：code、label、effects。事件内 code 唯一，选择事件 2–6 项。</li><li><code>effects</code>：tech / health / mood 为整数点，cash_cents 为整数分。效果可为负。</li><li><code>snapshot</code>：formatVersion=1、careerQuarters=24、initialState、schedule、events、endings。</li><li><code>state</code>：tech、health、mood 为非负整数，cash_cents 为有符号整数。待选时保存 pendingEvent={code,instanceId}。</li><li><code>result</code>：动作成功提交时的完整公开响应，用于同键重试回放。</li></ul><p>发布快照禁止 UPDATE / DELETE / TRUNCATE。数据库检查必要数值和哈希格式；完整内容结构由发布校验器检查。存档归属、发布权限、版本比较、状态机与并发动作语义由后续服务端实现。</p></section><section><h2>迁移、种子与复用工具</h2><p>已有可回滚迁移；种子包含 2 个账号、12 个事件、6 个选择节点、3 类结局，以及 1 份待选存档和动作示例。重复执行保留已有账号、草稿和进度。</p><p><a href="../../packages/database/README.md">运行说明</a> · <a href="seed-content.json">种子内容</a> · <a href="工具调研.md">社区工具调研</a> · <a href="验证记录.md">验证记录</a></p><p>社区方案：<a href="https://github.com/drawdb-io/drawdb">DrawDB</a>（可视化编辑）、<a href="https://github.com/k1LoW/tbls">tbls</a>（逆向图与字典）、<a href="https://knexjs.org/guide/migrations">Knex</a>（迁移与种子）。</p></section><footer>结构来源：实际迁移后的 PostgreSQL 元数据，经 tbls 1.96.1 提取。文档不包含口令或真实业务数据。</footer></main></body></html>`
    await writeFile(`${output}/index.html`, html)
}
