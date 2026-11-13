// SQL definitions and Chinese comments for the complete, existing 36-quarter game.
const c = (name, sql, comment) => ({ name, sql, comment })
const fk = (table, key = 'id') => `REFERENCES ${table}(${key}) ON UPDATE RESTRICT ON DELETE RESTRICT`
export const newTables = [
    { name: 'talents', comment: '天赋目录，ID 与现有 TypeScript 内容完全一致', columns: [
        c('id', 'INTEGER PRIMARY KEY CHECK (id > 0)', '源天赋 ID'),
        c('name', 'TEXT NOT NULL', '天赋名称'), c('description', 'TEXT NOT NULL', '原始天赋说明'),
        c('grade', 'SMALLINT NOT NULL CHECK (grade BETWEEN 0 AND 3)', '稀有度 0 普通、1 稀有、2 史诗、3 传说'),
        c('definition', "JSONB NOT NULL CHECK (jsonb_typeof(definition) = 'object')", '完整原始定义，保留 effect、condition、max、exclude、replacement、points 等规则'),
    ] },
    { name: 'achievements', comment: '跨局成就目录，保留原始条件表达式及触发时机', columns: [
        c('id', 'INTEGER PRIMARY KEY CHECK (id > 0)', '源成就 ID'), c('name', 'TEXT NOT NULL', '成就名称'),
        c('description', 'TEXT NOT NULL', '成就说明'), c('grade', 'SMALLINT NOT NULL CHECK (grade BETWEEN 0 AND 3)', '成就稀有度 0 到 3'),
        c('condition', 'TEXT NOT NULL', '原引擎条件表达式，不转换为 SQL 执行'),
        c('opportunity', "VARCHAR(16) NOT NULL CHECK (opportunity IN ('START','TRAJECTORY','SUMMARY','END'))", '判定时机 START、TRAJECTORY、SUMMARY、END'),
        c('hidden', 'BOOLEAN NOT NULL DEFAULT FALSE', '是否为隐藏成就'),
    ] },
    { name: 'characters', comment: '预置职业出身，保留原始四项初始属性', columns: [
        c('id', 'INTEGER PRIMARY KEY CHECK (id > 0)', '源职业出身 ID'), c('name', 'TEXT NOT NULL', '职业出身名称'),
        c('properties', "JSONB NOT NULL CHECK (jsonb_typeof(properties) = 'object')", 'CHR 沟通、INT 技术、STR 健康、MNY 积蓄的初始点数'),
    ] },
    { name: 'character_talents', comment: '职业出身与天赋的多对多关联，同时保存原始顺序', columns: [
        c('character_id', `INTEGER NOT NULL ${fk('characters')}`, '所属职业出身 ID'),
        c('talent_id', `INTEGER NOT NULL ${fk('talents')}`, '绑定天赋 ID'),
        c('position', 'SMALLINT NOT NULL CHECK (position >= 0)', '天赋在该出身中的零起点顺序'),
    ], constraints: ['PRIMARY KEY (character_id, talent_id)', 'UNIQUE (character_id, position)'], indexes: ['talent_id'] },
    { name: 'event_choices', comment: '八个关键决策场景的选项，关联实际后续结果事件', columns: [
        c('event_id', `UUID NOT NULL ${fk('events')}`, '选项所属事件 UUID'), c('code', 'VARCHAR(40) NOT NULL', '源选项字符串 ID，在同一事件内唯一'),
        c('position', 'SMALLINT NOT NULL CHECK (position >= 0)', '原始选项顺序，零起点'), c('label', 'TEXT NOT NULL', '按钮文案'),
        c('description', 'TEXT NOT NULL', '选择说明'), c('condition', 'TEXT', '选项解锁表达式；无条件时为空'),
        c('locked_reason', 'TEXT', '未解锁时的原始提示'), c('effects', "JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(effects) = 'object')", '选项直接属性变化，保留原始 INT、CHR 等键'),
        c('outcome_event_id', `UUID NOT NULL ${fk('events')}`, '选择后触发的结果事件 UUID'),
    ], constraints: ['PRIMARY KEY (event_id, code)', 'UNIQUE (event_id, position)'], indexes: ['outcome_event_id'] },
    { name: 'event_branches', comment: '事件自动分支，按原始顺序判定条件', columns: [
        c('event_id', `UUID NOT NULL ${fk('events')}`, '起始事件 UUID'), c('position', 'SMALLINT NOT NULL CHECK (position >= 0)', '分支判定顺序，零起点'),
        c('condition', 'TEXT NOT NULL', '原引擎条件表达式'), c('target_event_id', `UUID NOT NULL ${fk('events')}`, '条件满足时跳转到的事件 UUID'),
    ], constraints: ['PRIMARY KEY (event_id, position)'], indexes: ['target_event_id'] },
    { name: 'quarter_events', comment: '第 0 到 36 季度的分层事件池，完整保留层级、顺序与权重', columns: [
        c('quarter', 'SMALLINT NOT NULL CHECK (quarter BETWEEN 0 AND 36)', '季度编号，0 为入职日，36 为九年复盘'),
        c('pool_level', 'SMALLINT NOT NULL CHECK (pool_level >= 0)', '事件池层级，数值顺序等同源数组'),
        c('position', 'SMALLINT NOT NULL CHECK (position >= 0)', '同层事件顺序'),
        c('event_id', `UUID NOT NULL ${fk('events')}`, '池内事件 UUID'), c('weight', 'DOUBLE PRECISION NOT NULL CHECK (weight > 0)', '源事件抽取权重，不改写或取整'),
    ], constraints: ['PRIMARY KEY (quarter, pool_level, position)'], indexes: ['event_id'] },
    { name: 'endings', comment: '六类职业结局，每类均引用原始结局事件', columns: [
        c('event_id', `UUID PRIMARY KEY ${fk('events')}`, '结局事件 UUID'), c('name', 'TEXT NOT NULL', '结局名称'), c('description', 'TEXT NOT NULL', '结局叙述'),
    ] },
    { name: 'player_profiles', comment: '玩家跨局档案及浏览器迁移状态；软件自动使用本机玩家账号', columns: [
        c('user_id', `UUID PRIMARY KEY ${fk('users')}`, '玩家 UUID，与 users 一对零或一'), c('times', 'INTEGER NOT NULL DEFAULT 0 CHECK (times >= 0)', '已完成生涯次数'),
        c('locked_talent_id', `INTEGER ${fk('talents')}`, '保留到下局的一项天赋；无保留时为空'),
        c('unique_character', "JSONB CHECK (unique_character IS NULL OR jsonb_typeof(unique_character) = 'object')", '原生成角色：property 和 talent；不转换为预置职业出身'),
        c('highest', "JSONB CHECK (highest IS NULL OR jsonb_typeof(highest) = 'object')", '已有档案的历史最高属性，可空'),
        c('lowest', "JSONB CHECK (lowest IS NULL OR jsonb_typeof(lowest) = 'object')", '已有档案的历史最低属性，可空'),
        c('version', 'INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0)', '档案乐观锁版本，成功写入后加一'),
        c('initialized', 'BOOLEAN NOT NULL DEFAULT FALSE', '是否已首次读取或导入浏览器档案'),
        c('updated_at', 'TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP', '最近保存时间，带时区'),
    ], indexes: ['locked_talent_id'] },
    ...[['profile_talents', 'talent_id', 'talents', '曾拥有的天赋'], ['profile_events', 'event_id', 'events', '曾经历的事件'], ['profile_achievements', 'achievement_id', 'achievements', '已达成的成就']].map(([name, column, target, desc]) => ({
        name, comment: `玩家${desc}，以联合主键去重`, columns: [
            c('user_id', `UUID NOT NULL ${fk('player_profiles', 'user_id')}`, '所属玩家 UUID'),
            c(column, `${target === 'events' ? 'UUID' : 'INTEGER'} NOT NULL ${fk(target)}`, `${desc}的目录 ID`),
        ], constraints: [`PRIMARY KEY (user_id, ${column})`], indexes: [column],
    })),
    { name: 'archive_imports', comment: '档案导入审计与原始 JSON 备份；同一玩家同一内容仅登记一次', columns: [
        c('id', 'UUID PRIMARY KEY DEFAULT gen_random_uuid()', '导入记录 UUID'), c('user_id', `UUID NOT NULL ${fk('users')}`, '接收档案的玩家 UUID'),
        c('source', 'VARCHAR(40) NOT NULL', '来源 browser-localStorage 或明确标记的验证数据'),
        c('checksum', "CHAR(64) NOT NULL CHECK (checksum ~ '^[0-9a-f]{64}$')", '规范化导入载荷的 SHA-256'),
        c('payload', "JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object')", '未覆盖的原始浏览器 profile 与 unique 值，便于追溯'),
        c('imported_at', 'TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP', '实际导入时间，带时区'),
    ], constraints: ['UNIQUE (user_id, checksum)'] },
]

const quote = value => "'" + value.replaceAll("'", "''") + "'"
export const createTablesSQL = newTables.map(table => [
    `CREATE TABLE ${table.name} (\n${[...table.columns.map(column => `  ${column.name} ${column.sql}`), ...(table.constraints || []).map(item => `  ${item}`)].join(',\n')}\n);`,
    `COMMENT ON TABLE ${table.name} IS ${quote(table.comment)};`,
    ...table.columns.map(column => `COMMENT ON COLUMN ${table.name}.${column.name} IS ${quote(column.comment)};`),
    ...(table.indexes || []).map(column => `CREATE INDEX ${table.name}_${column}_idx ON ${table.name}(${column});`),
].join('\n')).join('\n\n')

export const alterSQL = `
ALTER TABLE events ADD COLUMN source_id INTEGER UNIQUE CHECK (source_id > 0);
ALTER TABLE events ADD COLUMN definition JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(definition) = 'object');
COMMENT ON TABLE events IS '完整 36 季度游戏的事件目录；草稿和完整定义，已发布快照独立保存';
COMMENT ON COLUMN events.source_id IS 'TypeScript 原事件整数 ID，旧 24 季度条目可空';
COMMENT ON COLUMN events.definition IS '完整原事件定义，保留 grade、dialogue、branch、choices、include、exclude、NoRandom 等';
COMMENT ON COLUMN events.effects IS '原引擎属性效果：CHR 沟通、INT 技术、STR 健康、MNY 积蓄、SPR 心态等；均为游戏点数';
ALTER TABLE content_versions ADD COLUMN source_tag VARCHAR(64) NOT NULL DEFAULT 'course24';
ALTER TABLE content_versions ADD COLUMN career_quarters SMALLINT NOT NULL DEFAULT 24 CHECK (career_quarters IN (24,36));
COMMENT ON COLUMN content_versions.source_tag IS '内容来源与格式标识，game36 表示当前软件完整内容';
COMMENT ON COLUMN content_versions.career_quarters IS '内容适用的季度总数，当前软件为 36';
ALTER TABLE career_runs DROP CONSTRAINT career_runs_quarter_check;
ALTER TABLE career_runs ADD CONSTRAINT career_runs_quarter_check CHECK (quarter BETWEEN 0 AND 36);
ALTER TABLE career_runs DROP CONSTRAINT career_runs_state_values;
COMMENT ON TABLE career_runs IS '职业生涯历史，保存当前 36 季度原引擎状态快照；客户端计算，服务端归档';
COMMENT ON COLUMN career_runs.quarter IS '原引擎已完成季度，当前软件 0 到 36';
COMMENT ON COLUMN career_runs.state IS '原 GameState 的 JSON 表示：props、life、talents、events、achievements、talentTriggers、pendingChoice、decisions';
COMMENT ON COLUMN career_runs.rng_state IS '随机状态标识；client-unavailable 表示客户端未提供可恢复随机状态';
COMMENT ON COLUMN run_actions.result IS '原始选择决定及结果快照；客户端历史导入记录不等于服务端权威结算';
`
