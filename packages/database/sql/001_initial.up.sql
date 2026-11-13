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
