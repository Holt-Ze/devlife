-- PostgreSQL 16+; ordered SQL migration, executed by Knex in a transaction.
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(32) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(10) NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'admin')),
    auth_version INTEGER NOT NULL DEFAULT 0 CHECK (auth_version >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT users_username_nonblank CHECK (length(btrim(username)) BETWEEN 3 AND 32),
    CONSTRAINT users_password_nonblank CHECK (length(password_hash) > 0)
);
COMMENT ON TABLE users IS '用户：预置玩家和管理员；归属与授权由服务端核验';
COMMENT ON COLUMN users.id IS '用户唯一标识，由数据库生成 UUID';
COMMENT ON COLUMN users.username IS '登录名，区分大小写，去空白后长度 3–32，唯一';
COMMENT ON COLUMN users.password_hash IS 'scrypt 口令哈希，含算法参数和随机盐，禁止保存明文';
COMMENT ON COLUMN users.role IS '用户角色：player 玩家 / admin 管理员';
COMMENT ON COLUMN users.auth_version IS '会话失效版本，非负整数，修改口令后递增';
COMMENT ON COLUMN users.created_at IS '创建时间，带时区';

CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(40) NOT NULL UNIQUE CHECK (length(btrim(code)) > 0),
    text TEXT NOT NULL CHECK (length(btrim(text)) > 0),
    choices JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(choices) = 'array'),
    effects JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(effects) = 'object'),
    revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE events IS '管理员可编辑的事件草稿；发布时复制到内容快照，不直接驱动旧存档';
COMMENT ON COLUMN events.id IS '事件草稿 UUID';
COMMENT ON COLUMN events.code IS '稳定业务编码，例如 first-review；发布快照内按编码引用';
COMMENT ON COLUMN events.text IS '事件叙述，非空文本';
COMMENT ON COLUMN events.choices IS '选项数组：code、label、effects；嵌套结构与编码唯一性在发布时校验';
COMMENT ON COLUMN events.effects IS '基础效果对象：tech、health、mood 为整数点，cash_cents 为整数分';
COMMENT ON COLUMN events.revision IS '草稿乐观锁版本，服务端用 expectedRevision 比较后递增';
COMMENT ON COLUMN events.updated_at IS '最近修改时间；服务端更新草稿时显式刷新';

CREATE TABLE content_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
    checksum CHAR(64) NOT NULL UNIQUE CHECK (checksum ~ '^[0-9a-f]{64}$'),
    created_by UUID NOT NULL REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX content_versions_created_by_idx ON content_versions(created_by);
COMMENT ON TABLE content_versions IS '已发布的不可变内容快照；只允许插入和读取，包含全部事件、季度表及结局规则';
COMMENT ON COLUMN content_versions.id IS '内容版本 UUID，存档固定引用此版本';
COMMENT ON COLUMN content_versions.snapshot IS '完整 JSON 快照：formatVersion、careerQuarters、initialState、schedule、events、endings';
COMMENT ON COLUMN content_versions.checksum IS '应用按键排序并序列化快照后计算的 SHA-256，小写十六进制';
COMMENT ON COLUMN content_versions.created_by IS '发布者用户 UUID，外键 RESTRICT；管理员权限在服务端核验';
COMMENT ON COLUMN content_versions.created_at IS '发布时间，带时区';

CREATE TABLE career_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    content_version_id UUID NOT NULL REFERENCES content_versions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    quarter SMALLINT NOT NULL DEFAULT 0 CHECK (quarter BETWEEN 0 AND 24),
    state JSONB NOT NULL,
    rng_state TEXT NOT NULL CHECK (length(btrim(rng_state)) > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'awaiting_choice', 'ended')),
    version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT career_runs_state_object CHECK (jsonb_typeof(state) = 'object'),
    CONSTRAINT career_runs_state_values CHECK (
        jsonb_exists_all(state, ARRAY['tech', 'health', 'mood', 'cash_cents'])
        AND COALESCE(jsonb_typeof(state->'tech') = 'number' AND (state->>'tech') ~ '^[0-9]+$', FALSE)
        AND COALESCE(jsonb_typeof(state->'health') = 'number' AND (state->>'health') ~ '^[0-9]+$', FALSE)
        AND COALESCE(jsonb_typeof(state->'mood') = 'number' AND (state->>'mood') ~ '^[0-9]+$', FALSE)
        AND COALESCE(jsonb_typeof(state->'cash_cents') = 'number' AND (state->>'cash_cents') ~ '^(-|)[0-9]+$', FALSE)
    )
);
CREATE INDEX career_runs_user_created_idx ON career_runs(user_id, created_at DESC);
CREATE INDEX career_runs_content_version_idx ON career_runs(content_version_id);
COMMENT ON TABLE career_runs IS '单局职业存档；归属固定，24 季度课程基础版，与浏览器 36 季度版本分开';
COMMENT ON COLUMN career_runs.id IS '存档 UUID';
COMMENT ON COLUMN career_runs.user_id IS '存档所有者 UUID，服务端每次读写均核验归属';
COMMENT ON COLUMN career_runs.content_version_id IS '开局时固定的内容版本 UUID，后续发布不替换';
COMMENT ON COLUMN career_runs.quarter IS '已进入季度，0 为开局，取值 0–24';
COMMENT ON COLUMN career_runs.state IS '状态对象：tech 技术、health 健康、mood 心态、cash_cents 现金分；待选时附 pendingEvent';
COMMENT ON COLUMN career_runs.rng_state IS '可恢复的伪随机状态，由后续服务端结算器读写';
COMMENT ON COLUMN career_runs.status IS 'ready 可推进 / awaiting_choice 待选择 / ended 已结束';
COMMENT ON COLUMN career_runs.version IS '动作乐观锁版本，成功结算后递增';
COMMENT ON COLUMN career_runs.created_at IS '开局时间，带时区';
COMMENT ON COLUMN career_runs.updated_at IS '最后成功保存时间，服务端显式更新';

CREATE TABLE run_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES career_runs(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    request_id UUID NOT NULL,
    payload_hash CHAR(64) NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
    result JSONB NOT NULL CHECK (jsonb_typeof(result) = 'object'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT run_actions_request_unique UNIQUE (run_id, request_id)
);
COMMENT ON TABLE run_actions IS '已结算动作与幂等结果：同存档同 request_id 只允许一条';
COMMENT ON COLUMN run_actions.id IS '动作记录 UUID';
COMMENT ON COLUMN run_actions.run_id IS '所属存档 UUID，外键 RESTRICT；唯一索引前缀同时支持按存档查询';
COMMENT ON COLUMN run_actions.request_id IS '调用方生成的幂等 UUID，重试必须复用';
COMMENT ON COLUMN run_actions.payload_hash IS '规范化业务载荷的 SHA-256，用于拒绝同键异载荷';
COMMENT ON COLUMN run_actions.result IS '提交成功时的完整公开响应对象，幂等重试原样返回';
COMMENT ON COLUMN run_actions.created_at IS '成功提交时间，带时区';

-- Defense in depth: applies even when a writer bypasses application code.
CREATE FUNCTION reject_content_version_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Published content versions are immutable' USING ERRCODE = '55000';
END;
$$;
CREATE TRIGGER content_versions_immutable
    BEFORE UPDATE OR DELETE ON content_versions
    FOR EACH ROW EXECUTE FUNCTION reject_content_version_mutation();
CREATE TRIGGER content_versions_no_truncate
    BEFORE TRUNCATE ON content_versions
    FOR EACH STATEMENT EXECUTE FUNCTION reject_content_version_mutation();


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

CREATE TABLE talents (
  id INTEGER PRIMARY KEY CHECK (id > 0),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  grade SMALLINT NOT NULL CHECK (grade BETWEEN 0 AND 3),
  definition JSONB NOT NULL CHECK (jsonb_typeof(definition) = 'object')
);
COMMENT ON TABLE talents IS '天赋目录，ID 与现有 TypeScript 内容完全一致';
COMMENT ON COLUMN talents.id IS '源天赋 ID';
COMMENT ON COLUMN talents.name IS '天赋名称';
COMMENT ON COLUMN talents.description IS '原始天赋说明';
COMMENT ON COLUMN talents.grade IS '稀有度 0 普通、1 稀有、2 史诗、3 传说';
COMMENT ON COLUMN talents.definition IS '完整原始定义，保留 effect、condition、max、exclude、replacement、points 等规则';

CREATE TABLE achievements (
  id INTEGER PRIMARY KEY CHECK (id > 0),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  grade SMALLINT NOT NULL CHECK (grade BETWEEN 0 AND 3),
  condition TEXT NOT NULL,
  opportunity VARCHAR(16) NOT NULL CHECK (opportunity IN ('START','TRAJECTORY','SUMMARY','END')),
  hidden BOOLEAN NOT NULL DEFAULT FALSE
);
COMMENT ON TABLE achievements IS '跨局成就目录，保留原始条件表达式及触发时机';
COMMENT ON COLUMN achievements.id IS '源成就 ID';
COMMENT ON COLUMN achievements.name IS '成就名称';
COMMENT ON COLUMN achievements.description IS '成就说明';
COMMENT ON COLUMN achievements.grade IS '成就稀有度 0 到 3';
COMMENT ON COLUMN achievements.condition IS '原引擎条件表达式，不转换为 SQL 执行';
COMMENT ON COLUMN achievements.opportunity IS '判定时机 START、TRAJECTORY、SUMMARY、END';
COMMENT ON COLUMN achievements.hidden IS '是否为隐藏成就';

CREATE TABLE characters (
  id INTEGER PRIMARY KEY CHECK (id > 0),
  name TEXT NOT NULL,
  properties JSONB NOT NULL CHECK (jsonb_typeof(properties) = 'object')
);
COMMENT ON TABLE characters IS '预置职业出身，保留原始四项初始属性';
COMMENT ON COLUMN characters.id IS '源职业出身 ID';
COMMENT ON COLUMN characters.name IS '职业出身名称';
COMMENT ON COLUMN characters.properties IS 'CHR 沟通、INT 技术、STR 健康、MNY 积蓄的初始点数';

CREATE TABLE character_talents (
  character_id INTEGER NOT NULL REFERENCES characters(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  talent_id INTEGER NOT NULL REFERENCES talents(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  position SMALLINT NOT NULL CHECK (position >= 0),
  PRIMARY KEY (character_id, talent_id),
  UNIQUE (character_id, position)
);
COMMENT ON TABLE character_talents IS '职业出身与天赋的多对多关联，同时保存原始顺序';
COMMENT ON COLUMN character_talents.character_id IS '所属职业出身 ID';
COMMENT ON COLUMN character_talents.talent_id IS '绑定天赋 ID';
COMMENT ON COLUMN character_talents.position IS '天赋在该出身中的零起点顺序';
CREATE INDEX character_talents_talent_id_idx ON character_talents(talent_id);

CREATE TABLE event_choices (
  event_id UUID NOT NULL REFERENCES events(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  code VARCHAR(40) NOT NULL,
  position SMALLINT NOT NULL CHECK (position >= 0),
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  condition TEXT,
  locked_reason TEXT,
  effects JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(effects) = 'object'),
  outcome_event_id UUID NOT NULL REFERENCES events(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  PRIMARY KEY (event_id, code),
  UNIQUE (event_id, position)
);
COMMENT ON TABLE event_choices IS '八个关键决策场景的选项，关联实际后续结果事件';
COMMENT ON COLUMN event_choices.event_id IS '选项所属事件 UUID';
COMMENT ON COLUMN event_choices.code IS '源选项字符串 ID，在同一事件内唯一';
COMMENT ON COLUMN event_choices.position IS '原始选项顺序，零起点';
COMMENT ON COLUMN event_choices.label IS '按钮文案';
COMMENT ON COLUMN event_choices.description IS '选择说明';
COMMENT ON COLUMN event_choices.condition IS '选项解锁表达式；无条件时为空';
COMMENT ON COLUMN event_choices.locked_reason IS '未解锁时的原始提示';
COMMENT ON COLUMN event_choices.effects IS '选项直接属性变化，保留原始 INT、CHR 等键';
COMMENT ON COLUMN event_choices.outcome_event_id IS '选择后触发的结果事件 UUID';
CREATE INDEX event_choices_outcome_event_id_idx ON event_choices(outcome_event_id);

CREATE TABLE event_branches (
  event_id UUID NOT NULL REFERENCES events(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  position SMALLINT NOT NULL CHECK (position >= 0),
  condition TEXT NOT NULL,
  target_event_id UUID NOT NULL REFERENCES events(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  PRIMARY KEY (event_id, position)
);
COMMENT ON TABLE event_branches IS '事件自动分支，按原始顺序判定条件';
COMMENT ON COLUMN event_branches.event_id IS '起始事件 UUID';
COMMENT ON COLUMN event_branches.position IS '分支判定顺序，零起点';
COMMENT ON COLUMN event_branches.condition IS '原引擎条件表达式';
COMMENT ON COLUMN event_branches.target_event_id IS '条件满足时跳转到的事件 UUID';
CREATE INDEX event_branches_target_event_id_idx ON event_branches(target_event_id);

CREATE TABLE quarter_events (
  quarter SMALLINT NOT NULL CHECK (quarter BETWEEN 0 AND 36),
  pool_level SMALLINT NOT NULL CHECK (pool_level >= 0),
  position SMALLINT NOT NULL CHECK (position >= 0),
  event_id UUID NOT NULL REFERENCES events(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  weight DOUBLE PRECISION NOT NULL CHECK (weight > 0),
  PRIMARY KEY (quarter, pool_level, position)
);
COMMENT ON TABLE quarter_events IS '第 0 到 36 季度的分层事件池，完整保留层级、顺序与权重';
COMMENT ON COLUMN quarter_events.quarter IS '季度编号，0 为入职日，36 为九年复盘';
COMMENT ON COLUMN quarter_events.pool_level IS '事件池层级，数值顺序等同源数组';
COMMENT ON COLUMN quarter_events.position IS '同层事件顺序';
COMMENT ON COLUMN quarter_events.event_id IS '池内事件 UUID';
COMMENT ON COLUMN quarter_events.weight IS '源事件抽取权重，不改写或取整';
CREATE INDEX quarter_events_event_id_idx ON quarter_events(event_id);

CREATE TABLE endings (
  event_id UUID PRIMARY KEY REFERENCES events(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT NOT NULL
);
COMMENT ON TABLE endings IS '六类职业结局，每类均引用原始结局事件';
COMMENT ON COLUMN endings.event_id IS '结局事件 UUID';
COMMENT ON COLUMN endings.name IS '结局名称';
COMMENT ON COLUMN endings.description IS '结局叙述';

CREATE TABLE player_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  times INTEGER NOT NULL DEFAULT 0 CHECK (times >= 0),
  locked_talent_id INTEGER REFERENCES talents(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  unique_character JSONB CHECK (unique_character IS NULL OR jsonb_typeof(unique_character) = 'object'),
  highest JSONB CHECK (highest IS NULL OR jsonb_typeof(highest) = 'object'),
  lowest JSONB CHECK (lowest IS NULL OR jsonb_typeof(lowest) = 'object'),
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  initialized BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE player_profiles IS '玩家跨局档案及浏览器迁移状态；软件自动使用本机玩家账号';
COMMENT ON COLUMN player_profiles.user_id IS '玩家 UUID，与 users 一对零或一';
COMMENT ON COLUMN player_profiles.times IS '已完成生涯次数';
COMMENT ON COLUMN player_profiles.locked_talent_id IS '保留到下局的一项天赋；无保留时为空';
COMMENT ON COLUMN player_profiles.unique_character IS '原生成角色：property 和 talent；不转换为预置职业出身';
COMMENT ON COLUMN player_profiles.highest IS '已有档案的历史最高属性，可空';
COMMENT ON COLUMN player_profiles.lowest IS '已有档案的历史最低属性，可空';
COMMENT ON COLUMN player_profiles.version IS '档案乐观锁版本，成功写入后加一';
COMMENT ON COLUMN player_profiles.initialized IS '是否已首次读取或导入浏览器档案';
COMMENT ON COLUMN player_profiles.updated_at IS '最近保存时间，带时区';
CREATE INDEX player_profiles_locked_talent_id_idx ON player_profiles(locked_talent_id);

CREATE TABLE profile_talents (
  user_id UUID NOT NULL REFERENCES player_profiles(user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  talent_id INTEGER NOT NULL REFERENCES talents(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  PRIMARY KEY (user_id, talent_id)
);
COMMENT ON TABLE profile_talents IS '玩家曾拥有的天赋，以联合主键去重';
COMMENT ON COLUMN profile_talents.user_id IS '所属玩家 UUID';
COMMENT ON COLUMN profile_talents.talent_id IS '曾拥有的天赋的目录 ID';
CREATE INDEX profile_talents_talent_id_idx ON profile_talents(talent_id);

CREATE TABLE profile_events (
  user_id UUID NOT NULL REFERENCES player_profiles(user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  event_id UUID NOT NULL REFERENCES events(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  PRIMARY KEY (user_id, event_id)
);
COMMENT ON TABLE profile_events IS '玩家曾经历的事件，以联合主键去重';
COMMENT ON COLUMN profile_events.user_id IS '所属玩家 UUID';
COMMENT ON COLUMN profile_events.event_id IS '曾经历的事件的目录 ID';
CREATE INDEX profile_events_event_id_idx ON profile_events(event_id);

CREATE TABLE profile_achievements (
  user_id UUID NOT NULL REFERENCES player_profiles(user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  PRIMARY KEY (user_id, achievement_id)
);
COMMENT ON TABLE profile_achievements IS '玩家已达成的成就，以联合主键去重';
COMMENT ON COLUMN profile_achievements.user_id IS '所属玩家 UUID';
COMMENT ON COLUMN profile_achievements.achievement_id IS '已达成的成就的目录 ID';
CREATE INDEX profile_achievements_achievement_id_idx ON profile_achievements(achievement_id);

CREATE TABLE archive_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  source VARCHAR(40) NOT NULL,
  checksum CHAR(64) NOT NULL CHECK (checksum ~ '^[0-9a-f]{64}$'),
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, checksum)
);
COMMENT ON TABLE archive_imports IS '档案导入审计与原始 JSON 备份；同一玩家同一内容仅登记一次';
COMMENT ON COLUMN archive_imports.id IS '导入记录 UUID';
COMMENT ON COLUMN archive_imports.user_id IS '接收档案的玩家 UUID';
COMMENT ON COLUMN archive_imports.source IS '来源 browser-localStorage 或明确标记的验证数据';
COMMENT ON COLUMN archive_imports.checksum IS '规范化导入载荷的 SHA-256';
COMMENT ON COLUMN archive_imports.payload IS '未覆盖的原始浏览器 profile 与 unique 值，便于追溯';
COMMENT ON COLUMN archive_imports.imported_at IS '实际导入时间，带时区';
COMMENT ON COLUMN events.code IS '稳定编码 event-源ID；与 source_id 唯一对应';
      COMMENT ON COLUMN events.choices IS '原始选项 JSON 数组，含 id、label、description、event、condition、effect；并投影到 event_choices';
      COMMENT ON COLUMN content_versions.snapshot IS '完整 36 季度源内容：events、talents、achievements、characters、ages、endings、specialThanks 及格式版本';
      COMMENT ON COLUMN career_runs.status IS 'ready、awaiting_choice、ended；当前接入保存的是 ended 生涯历史';
      COMMENT ON COLUMN career_runs.version IS '当前归档记录的决定数量；进行中动作版本控制尚未接入';