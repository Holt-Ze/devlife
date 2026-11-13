import { readFile } from 'node:fs/promises'

export async function up(knex) {
    await knex.raw(await readFile(new URL('../sql/001_initial.up.sql', import.meta.url), 'utf8'))
}

export async function down(knex) {
    await knex.raw(await readFile(new URL('../sql/001_initial.down.sql', import.meta.url), 'utf8'))
}
