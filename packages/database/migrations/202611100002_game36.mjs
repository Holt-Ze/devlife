import { alterSQL, createTablesSQL, newTables } from '../lib/schema36.mjs'
export async function up(knex) { await knex.raw(alterSQL + createTablesSQL) }
export async function down(knex) {
    const count = Number((await knex('career_runs').count('* as n').first()).n)
    if (count) throw new Error('已有生涯数据，不能直接降级到 24 季度；请先备份并迁移数据')
    for (const table of [...newTables].reverse()) await knex.schema.dropTable(table.name)
    await knex.raw(`ALTER TABLE events DROP COLUMN definition, DROP COLUMN source_id;
      ALTER TABLE content_versions DROP COLUMN source_tag, DROP COLUMN career_quarters;
      ALTER TABLE career_runs DROP CONSTRAINT career_runs_quarter_check;
      ALTER TABLE career_runs ADD CONSTRAINT career_runs_quarter_check CHECK (quarter BETWEEN 0 AND 24);`)
}
