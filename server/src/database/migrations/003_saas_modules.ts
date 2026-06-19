import { Knex } from 'knex'

/**
 * Phase: Common SaaS modules — user-profile, notifications, remote-config,
 * api-keys, analytics, cloud-profiles, support, billing.
 *
 * Relational data only. Binary blobs (avatars, ticket attachments) live in
 * Supabase Storage and are referenced here by URL. Cloud-profile fingerprint
 * JSON is small text and is stored inline (unencrypted, for cross-device
 * sharing — matching the desktop client's documented semantics).
 */
export async function up(knex: Knex): Promise<void> {
  // ── User profiles ────────────────────────────────────────────────────────
  await knex.schema.createTable('user_profiles', (table) => {
    table.uuid('user_id').primary().references('id').inTable('users').onDelete('CASCADE')
    table.string('display_name', 255)
    table.text('bio')
    table.string('timezone', 64)
    table.string('language', 16)
    table.text('avatar_url')
    table.string('avatar_path', 512)
    table.jsonb('metadata')
    table.timestamps(true, true)
  })

  // ── Notifications ────────────────────────────────────────────────────────
  await knex.schema.createTable('notifications', (table) => {
    table.uuid('id').primary()
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.string('type', 32).notNullable()
    table.string('title', 255).notNullable()
    table.text('body')
    table.text('action_url')
    table.jsonb('metadata')
    table.timestamp('read_at')
    table.timestamp('created_at').defaultTo(knex.fn.now())

    table.index(['user_id', 'read_at'])
    table.index('created_at')
  })

  // ── Remote config: feature flags, settings, announcements, preset updates ──
  await knex.schema.createTable('feature_flags', (table) => {
    table.string('key', 128).primary()
    table.boolean('enabled').defaultTo(false)
    table.string('variant', 64)
    table.jsonb('metadata')
    table.timestamps(true, true)
  })

  await knex.schema.createTable('remote_settings', (table) => {
    table.string('key', 128).primary()
    table.jsonb('value')
    table.timestamps(true, true)
  })

  await knex.schema.createTable('announcements', (table) => {
    table.uuid('id').primary()
    table.enum('type', ['info', 'warning', 'critical', 'maintenance']).defaultTo('info')
    table.string('title', 255).notNullable()
    table.text('message').notNullable()
    table.text('action_url')
    table.string('action_label', 128)
    table.boolean('dismissible').defaultTo(true)
    table.timestamp('starts_at').defaultTo(knex.fn.now())
    table.timestamp('ends_at')
    table.timestamp('created_at').defaultTo(knex.fn.now())

    table.index('starts_at')
  })

  await knex.schema.createTable('announcement_dismissals', (table) => {
    table.uuid('id').primary()
    table.uuid('announcement_id').notNullable().references('id').inTable('announcements').onDelete('CASCADE')
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.timestamp('dismissed_at').defaultTo(knex.fn.now())

    table.unique(['announcement_id', 'user_id'])
    table.index('user_id')
  })

  await knex.schema.createTable('preset_updates', (table) => {
    table.uuid('id').primary()
    table.string('preset_key', 128).notNullable()
    table.integer('version').notNullable()
    table.jsonb('changes')
    table.text('description')
    table.timestamp('published_at').defaultTo(knex.fn.now())

    table.index('preset_key')
  })

  // ── API keys ───────────────────────────────────────────────────────────────
  await knex.schema.createTable('api_keys', (table) => {
    table.uuid('id').primary()
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.string('name', 255).notNullable()
    table.string('key_hash', 128).unique().notNullable()
    table.string('prefix', 16).notNullable()
    table.jsonb('scopes')
    table.timestamp('expires_at')
    table.timestamp('last_used_at')
    table.timestamp('revoked_at')
    table.timestamp('created_at').defaultTo(knex.fn.now())

    table.index('user_id')
    table.index('key_hash')
  })

  await knex.schema.createTable('api_key_usage', (table) => {
    table.uuid('id').primary()
    table.uuid('api_key_id').notNullable().references('id').inTable('api_keys').onDelete('CASCADE')
    table.string('endpoint', 255)
    table.timestamp('created_at').defaultTo(knex.fn.now())

    table.index('api_key_id')
    table.index('created_at')
  })

  // ── Analytics ────────────────────────────────────────────────────────────
  await knex.schema.createTable('usage_snapshots', (table) => {
    table.uuid('id').primary()
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.string('machine_id', 128)
    table.string('app_version', 64)
    table.integer('profile_count').defaultTo(0)
    table.integer('active_session_count').defaultTo(0)
    table.integer('proxy_count').defaultTo(0)
    table.integer('workflow_count').defaultTo(0)
    table.float('detection_avg_score')
    table.string('os_platform', 32)
    table.timestamp('created_at').defaultTo(knex.fn.now())

    table.index('user_id')
    table.index('created_at')
  })

  await knex.schema.createTable('detection_scores', (table) => {
    table.uuid('id').primary()
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.string('profile_id', 255)
    table.string('profile_name', 255)
    table.float('overall_score').notNullable()
    table.integer('vector_count').defaultTo(0)
    table.integer('passed_count').defaultTo(0)
    table.integer('warned_count').defaultTo(0)
    table.integer('failed_count').defaultTo(0)
    table.timestamp('tested_at')
    table.timestamp('created_at').defaultTo(knex.fn.now())

    table.index('user_id')
    table.index('created_at')
  })

  await knex.schema.createTable('feature_events', (table) => {
    table.uuid('id').primary()
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.string('feature', 128).notNullable()
    table.string('action', 128).notNullable()
    table.jsonb('metadata')
    table.timestamp('created_at').defaultTo(knex.fn.now())

    table.index('user_id')
    table.index('feature')
    table.index('created_at')
  })

  // ── Cloud profiles ──────────────────────────────────────────────────────────
  await knex.schema.createTable('cloud_profiles', (table) => {
    table.uuid('id').primary()
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.string('local_id', 255)
    table.string('name', 255).notNullable()
    table.string('fingerprint_hash', 128).notNullable()
    table.string('preset', 128)
    table.jsonb('proxy_config')
    table.jsonb('tags')
    table.text('notes')
    table.text('fingerprint').notNullable()
    table.text('cookies')
    table.integer('size_bytes').defaultTo(0)
    table.timestamps(true, true)

    table.index('user_id')
    table.index('fingerprint_hash')
  })

  // ── Support ──────────────────────────────────────────────────────────────
  await knex.schema.createTable('support_tickets', (table) => {
    table.uuid('id').primary()
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.string('subject', 255).notNullable()
    table.string('category', 32).notNullable()
    table.string('priority', 16).defaultTo('normal')
    table.string('status', 32).defaultTo('open')
    table.timestamp('last_reply_at')
    table.jsonb('diagnostics')
    table.timestamps(true, true)

    table.index('user_id')
    table.index('status')
  })

  await knex.schema.createTable('ticket_messages', (table) => {
    table.uuid('id').primary()
    table.uuid('ticket_id').notNullable().references('id').inTable('support_tickets').onDelete('CASCADE')
    table.string('author_type', 16).notNullable()
    table.string('author_name', 255)
    table.text('content').notNullable()
    table.timestamp('created_at').defaultTo(knex.fn.now())

    table.index('ticket_id')
  })

  await knex.schema.createTable('ticket_attachments', (table) => {
    table.uuid('id').primary()
    table.uuid('ticket_id').notNullable().references('id').inTable('support_tickets').onDelete('CASCADE')
    table.uuid('message_id')
    table.string('filename', 255).notNullable()
    table.integer('size_bytes').defaultTo(0)
    table.string('content_type', 128)
    table.text('url')
    table.text('storage_path')
    table.timestamp('created_at').defaultTo(knex.fn.now())

    table.index('ticket_id')
  })

  await knex.schema.createTable('feedback', (table) => {
    table.uuid('id').primary()
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.string('type', 32).notNullable()
    table.text('message').notNullable()
    table.integer('rating')
    table.string('context', 255)
    table.string('app_version', 64)
    table.string('platform', 64)
    table.timestamp('created_at').defaultTo(knex.fn.now())

    table.index('user_id')
  })

  // ── Billing (stub) ─────────────────────────────────────────────────────────
  await knex.schema.createTable('subscriptions', (table) => {
    table.uuid('id').primary()
    table.uuid('user_id').notNullable().unique().references('id').inTable('users').onDelete('CASCADE')
    table.string('plan_id', 64)
    table.string('plan_name', 128)
    table.string('status', 32).defaultTo('none')
    table.string('interval', 16)
    table.timestamp('current_period_start')
    table.timestamp('current_period_end')
    table.boolean('cancel_at_period_end').defaultTo(false)
    table.timestamp('trial_end')
    table.timestamps(true, true)

    table.index('user_id')
  })

  await knex.schema.createTable('invoices', (table) => {
    table.uuid('id').primary()
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.string('number', 64).notNullable()
    table.string('status', 32).defaultTo('paid')
    table.integer('amount_due').defaultTo(0)
    table.integer('amount_paid').defaultTo(0)
    table.string('currency', 8).defaultTo('usd')
    table.timestamp('paid_at')
    table.text('pdf_url')
    table.text('hosted_url')
    table.timestamp('created_at').defaultTo(knex.fn.now())

    table.index('user_id')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('invoices')
  await knex.schema.dropTableIfExists('subscriptions')
  await knex.schema.dropTableIfExists('feedback')
  await knex.schema.dropTableIfExists('ticket_attachments')
  await knex.schema.dropTableIfExists('ticket_messages')
  await knex.schema.dropTableIfExists('support_tickets')
  await knex.schema.dropTableIfExists('cloud_profiles')
  await knex.schema.dropTableIfExists('feature_events')
  await knex.schema.dropTableIfExists('detection_scores')
  await knex.schema.dropTableIfExists('usage_snapshots')
  await knex.schema.dropTableIfExists('api_key_usage')
  await knex.schema.dropTableIfExists('api_keys')
  await knex.schema.dropTableIfExists('preset_updates')
  await knex.schema.dropTableIfExists('announcement_dismissals')
  await knex.schema.dropTableIfExists('announcements')
  await knex.schema.dropTableIfExists('remote_settings')
  await knex.schema.dropTableIfExists('feature_flags')
  await knex.schema.dropTableIfExists('notifications')
  await knex.schema.dropTableIfExists('user_profiles')
}
