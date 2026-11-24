export async function up(db) {
    await db.raw(`
        ALTER TABLE quarter_events ADD COLUMN track VARCHAR(32) NOT NULL DEFAULT 'programmer'
            CHECK (track ~ '^[a-z][a-z-]{0,31}$');
        ALTER TABLE quarter_events DROP CONSTRAINT quarter_events_pkey;
        ALTER TABLE quarter_events ADD PRIMARY KEY (track, quarter, pool_level, position);
        COMMENT ON TABLE quarter_events IS '各专业与程序员职场篇的分层季度事件池';
        COMMENT ON COLUMN quarter_events.track IS '目录中的专业标识，programmer 表示原程序员职场篇';
        COMMENT ON COLUMN quarter_events.quarter IS '当前路线的季度编号，0 为报到或入职日';
    `)
}

export async function down(db) {
    await db.raw(`
        DELETE FROM quarter_events WHERE track <> 'programmer';
        ALTER TABLE quarter_events DROP CONSTRAINT quarter_events_pkey;
        ALTER TABLE quarter_events DROP COLUMN track;
        ALTER TABLE quarter_events ADD PRIMARY KEY (quarter, pool_level, position);
        COMMENT ON TABLE quarter_events IS '第 0 到 36 季度的分层事件池，完整保留层级、顺序与权重';
        COMMENT ON COLUMN quarter_events.quarter IS '季度编号，0 为入职日，36 为九年复盘';
    `)
}
