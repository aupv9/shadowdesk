import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('shared_profiles', (table) => {
    table.uuid('id').primary()
    table.uuid('team_id').notNullable().references('id').inTable('teams').onDelete('CASCADE')
    table.string('profile_id', 255).notNullable()
    table.string('profile_name', 255)
    table.uuid('shared_by_user_id').notNullable().references('id').inTable('users')
    table.uuid('shared_to_user_id').notNullable().references('id').inTable('users')
    table.enum('permission', ['read', 'write']).defaultTo('read')
    table.timestamp('shared_at').defaultTo(knex.fn.now())
    table.timestamps(true, true)

    table.unique(['profile_id', 'shared_by_user_id', 'shared_to_user_id'])
    table.index('team_id')
    table.index('shared_to_user_id')
    table.index('shared_by_user_id')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('shared_profiles')
}
