import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // Users table
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary()
    table.string('email', 255).unique().notNullable()
    table.string('password_hash', 255).notNullable()
    table.string('full_name', 255)
    table.boolean('email_verified').defaultTo(false)
    table.timestamp('email_verified_at')
    table.enum('status', ['active', 'suspended', 'deleted']).defaultTo('active')
    table.timestamp('last_login_at')
    table.string('last_login_ip', 45)
    table.timestamp('deletion_requested_at')
    table.text('deletion_reason')
    table.timestamps(true, true)
    table.timestamp('deleted_at')

    table.index('email')
    table.index('status')
  })

  // Auth tokens (blacklist/refresh token storage)
  await knex.schema.createTable('auth_tokens', (table) => {
    table.uuid('id').primary()
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.string('refresh_token_hash', 255).unique().notNullable()
    table.timestamp('expires_at').notNullable()
    table.timestamp('revoked_at')
    table.string('ip_address', 45)
    table.text('user_agent')
    table.timestamps(true, true)

    table.index('user_id')
    table.index('expires_at')
  })

  // Teams table
  await knex.schema.createTable('teams', (table) => {
    table.uuid('id').primary()
    table.uuid('owner_id').notNullable().references('id').inTable('users')
    table.string('name', 255).notNullable()
    table.integer('max_members').defaultTo(-1)
    table.boolean('profile_sharing_enabled').defaultTo(true)
    table.boolean('audit_logging_enabled').defaultTo(true)
    table.timestamps(true, true)
    table.timestamp('deleted_at')

    table.index('owner_id')
    table.index('deleted_at')
  })

  // Team members
  await knex.schema.createTable('team_members', (table) => {
    table.uuid('id').primary()
    table.uuid('team_id').notNullable().references('id').inTable('teams').onDelete('CASCADE')
    table.uuid('user_id').notNullable().references('id').inTable('users')
    table.enum('role', ['owner', 'admin', 'member']).defaultTo('member')
    table.timestamp('joined_at').defaultTo(knex.fn.now())
    table.timestamp('last_action_at')
    table.integer('action_count').defaultTo(0)

    table.unique(['team_id', 'user_id'])
    table.index('user_id')
  })

  // Team invites
  await knex.schema.createTable('team_invites', (table) => {
    table.uuid('id').primary()
    table.uuid('team_id').notNullable().references('id').inTable('teams').onDelete('CASCADE')
    table.uuid('invited_by_user_id').notNullable().references('id').inTable('users')
    table.string('email', 255).notNullable()
    table.enum('role', ['admin', 'member']).defaultTo('member')
    table.string('token', 64).unique().notNullable()
    table.timestamp('expires_at').notNullable()
    table.timestamp('accepted_at')
    table.timestamps(true, true)

    table.unique(['team_id', 'email'])
    table.index('token')
    table.index('expires_at')
  })

  // Licenses
  await knex.schema.createTable('licenses', (table) => {
    table.uuid('id').primary()
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.string('license_key', 64).unique().notNullable()
    table.enum('plan', ['free', 'pro', 'enterprise']).defaultTo('free')
    table.integer('max_profiles').defaultTo(5)
    table.integer('max_team_members').defaultTo(1)
    table.boolean('cloud_sync_enabled').defaultTo(false)
    table.timestamp('activated_at')
    table.string('activated_machine_id', 32)
    table.timestamp('valid_until')
    table.enum('status', ['active', 'suspended', 'expired']).defaultTo('active')
    table.timestamps(true, true)

    table.index('user_id')
    table.index('license_key')
    table.index('valid_until')
  })

  // License devices
  await knex.schema.createTable('license_devices', (table) => {
    table.uuid('id').primary()
    table.uuid('license_id').notNullable().references('id').inTable('licenses').onDelete('CASCADE')
    table.string('machine_id', 32).notNullable()
    table.string('machine_name', 255)
    table.timestamp('activated_at').defaultTo(knex.fn.now())
    table.timestamp('last_used_at')

    table.unique(['license_id', 'machine_id'])
    table.index('machine_id')
  })

  // Sync bundles (encrypted)
  await knex.schema.createTable('sync_bundles', (table) => {
    table.uuid('id').primary()
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.binary('data').notNullable()
    table.string('checksum', 64).notNullable()
    table.integer('profile_count').defaultTo(0)
    table.integer('bundle_version').defaultTo(1)
    table.timestamps(true, true)

    table.index('user_id')
  })

  // Sync history
  await knex.schema.createTable('sync_history', (table) => {
    table.uuid('id').primary()
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.enum('direction', ['push', 'pull']).notNullable()
    table.integer('profile_count').defaultTo(0)
    table.enum('status', ['success', 'error']).notNullable()
    table.text('error_message')
    table.string('ip_address', 45)
    table.text('user_agent')
    table.timestamp('created_at').defaultTo(knex.fn.now())

    table.index('user_id')
    table.index('created_at')
  })

  // Audit log
  await knex.schema.createTable('audit_log', (table) => {
    table.uuid('id').primary()
    table.uuid('team_id').references('id').inTable('teams').onDelete('SET NULL')
    table.uuid('user_id').notNullable().references('id').inTable('users')
    table.string('action', 64).notNullable()
    table.string('resource_type', 64)
    table.string('resource_id', 255)
    table.jsonb('changes')
    table.string('ip_address', 45)
    table.text('user_agent')
    table.enum('status', ['success', 'failure']).notNullable()
    table.text('error_message')
    table.timestamp('created_at').defaultTo(knex.fn.now())

    table.index('team_id')
    table.index('user_id')
    table.index('action')
    table.index('created_at')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('audit_log')
  await knex.schema.dropTableIfExists('sync_history')
  await knex.schema.dropTableIfExists('sync_bundles')
  await knex.schema.dropTableIfExists('license_devices')
  await knex.schema.dropTableIfExists('licenses')
  await knex.schema.dropTableIfExists('team_invites')
  await knex.schema.dropTableIfExists('team_members')
  await knex.schema.dropTableIfExists('teams')
  await knex.schema.dropTableIfExists('auth_tokens')
  await knex.schema.dropTableIfExists('users')
}
