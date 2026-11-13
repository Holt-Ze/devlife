export async function up(knex) {
    await knex.raw(`COMMENT ON COLUMN events.code IS '稳定编码 event-源ID；与 source_id 唯一对应';
      COMMENT ON COLUMN events.choices IS '原始选项 JSON 数组，含 id、label、description、event、condition、effect；并投影到 event_choices';
      COMMENT ON COLUMN content_versions.snapshot IS '完整 36 季度源内容：events、talents、achievements、characters、ages、endings、specialThanks 及格式版本';
      COMMENT ON COLUMN career_runs.status IS 'ready、awaiting_choice、ended；当前接入保存的是 ended 生涯历史';
      COMMENT ON COLUMN career_runs.version IS '当前归档记录的决定数量；进行中动作版本控制尚未接入';`)
}
export async function down() {}
