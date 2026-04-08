import {
  pgTable, uuid, text, boolean, integer, timestamptz,
  bytea, jsonb, uniqueIndex, index,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------
export const users = pgTable('users', {
  id:                 uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email:              text('email').notNull().unique(),
  name:               text('name').notNull(),
  avatarUrl:          text('avatar_url'),
  passwordHash:       text('password_hash').notNull(),
  emailVerified:      boolean('email_verified').default(false).notNull(),
  emailVerifiedAt:    timestamptz('email_verified_at'),
  createdAt:          timestamptz('created_at').defaultNow().notNull(),
  updatedAt:          timestamptz('updated_at').defaultNow().notNull(),
  deletedAt:          timestamptz('deleted_at'),  // soft delete
})

// ---------------------------------------------------------------------------
// sessions (refresh tokens — hashed)
// ---------------------------------------------------------------------------
export const sessions = pgTable('sessions', {
  id:           uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId:       uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash:    text('token_hash').notNull().unique(),  // SHA-256 of raw refresh token
  userAgent:    text('user_agent'),
  ipAddress:    text('ip_address'),
  lastUsedAt:   timestamptz('last_used_at').defaultNow().notNull(),
  expiresAt:    timestamptz('expires_at').notNull(),
  createdAt:    timestamptz('created_at').defaultNow().notNull(),
}, (t) => ({
  userIdx: index('sessions_user_idx').on(t.userId),
}))

// ---------------------------------------------------------------------------
// email_verifications / password_resets (one-time tokens)
// ---------------------------------------------------------------------------
export const oneTimeTokens = pgTable('one_time_tokens', {
  id:         uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId:     uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type:       text('type').notNull(),       // 'email_verify' | 'password_reset'
  tokenHash:  text('token_hash').notNull().unique(),
  expiresAt:  timestamptz('expires_at').notNull(),
  usedAt:     timestamptz('used_at'),
  createdAt:  timestamptz('created_at').defaultNow().notNull(),
}, (t) => ({
  userIdx: index('ott_user_idx').on(t.userId),
}))

// ---------------------------------------------------------------------------
// licenses
// ---------------------------------------------------------------------------
export const licenses = pgTable('licenses', {
  id:           uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId:       uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  licenseKey:   text('license_key').notNull().unique(),
  plan:         text('plan').notNull().default('free'),    // free|starter|professional|enterprise
  status:       text('status').notNull().default('active'), // active|expired|suspended
  validUntil:   timestamptz('valid_until'),                 // null = free (no expiry check)
  isTrial:      boolean('is_trial').default(false).notNull(),
  trialEndsAt:  timestamptz('trial_ends_at'),
  seatsMax:     integer('seats_max').default(1).notNull(),
  createdAt:    timestamptz('created_at').defaultNow().notNull(),
  updatedAt:    timestamptz('updated_at').defaultNow().notNull(),
}, (t) => ({
  userIdx: index('licenses_user_idx').on(t.userId),
}))

// ---------------------------------------------------------------------------
// license_devices (multi-machine activations)
// ---------------------------------------------------------------------------
export const licenseDevices = pgTable('license_devices', {
  id:          uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  licenseId:   uuid('license_id').notNull().references(() => licenses.id, { onDelete: 'cascade' }),
  machineId:   text('machine_id').notNull(),  // SHA256(MACs + CPU)
  label:       text('label'),
  os:          text('os'),
  lastSeenAt:  timestamptz('last_seen_at'),
  activatedAt: timestamptz('activated_at').defaultNow().notNull(),
}, (t) => ({
  unique: uniqueIndex('license_devices_unique').on(t.licenseId, t.machineId),
  licenseIdx: index('license_devices_license_idx').on(t.licenseId),
}))

// ---------------------------------------------------------------------------
// teams
// ---------------------------------------------------------------------------
export const teams = pgTable('teams', {
  id:        uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name:      text('name').notNull(),
  ownerId:   uuid('owner_id').notNull().references(() => users.id),
  createdAt: timestamptz('created_at').defaultNow().notNull(),
  updatedAt: timestamptz('updated_at').defaultNow().notNull(),
})

// ---------------------------------------------------------------------------
// team_members
// ---------------------------------------------------------------------------
export const teamMembers = pgTable('team_members', {
  id:       uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  teamId:   uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  userId:   uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role:     text('role').notNull().default('viewer'),  // admin|editor|viewer
  joinedAt: timestamptz('joined_at').defaultNow().notNull(),
}, (t) => ({
  unique:   uniqueIndex('team_members_unique').on(t.teamId, t.userId),
  teamIdx:  index('team_members_team_idx').on(t.teamId),
  userIdx:  index('team_members_user_idx').on(t.userId),
}))

// ---------------------------------------------------------------------------
// team_invites
// ---------------------------------------------------------------------------
export const teamInvites = pgTable('team_invites', {
  id:          uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  teamId:      uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  email:       text('email').notNull(),
  role:        text('role').notNull().default('viewer'),
  invitedBy:   uuid('invited_by').notNull().references(() => users.id),
  token:       text('token').notNull().unique(),  // secure random, sent in email link
  status:      text('status').notNull().default('pending'), // pending|accepted|expired
  expiresAt:   timestamptz('expires_at').notNull(),
  createdAt:   timestamptz('created_at').defaultNow().notNull(),
}, (t) => ({
  teamIdx: index('team_invites_team_idx').on(t.teamId),
}))

// ---------------------------------------------------------------------------
// shared_profiles
// ---------------------------------------------------------------------------
export const sharedProfiles = pgTable('shared_profiles', {
  id:          uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  teamId:      uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  profileId:   text('profile_id').notNull(),    // Desktop local UUID
  profileName: text('profile_name').notNull(),
  sharedBy:    uuid('shared_by').notNull().references(() => users.id),
  memberId:    uuid('member_id').notNull().references(() => users.id),
  permission:  text('permission').notNull().default('read'), // read|write
  sharedAt:    timestamptz('shared_at').defaultNow().notNull(),
}, (t) => ({
  unique:   uniqueIndex('shared_profiles_unique').on(t.teamId, t.profileId, t.memberId),
  teamIdx:  index('shared_profiles_team_idx').on(t.teamId),
}))

// ---------------------------------------------------------------------------
// sync_bundles (E2E encrypted — backend stores ciphertext only)
// ---------------------------------------------------------------------------
export const syncBundles = pgTable('sync_bundles', {
  id:           uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId:       uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  data:         bytea('data').notNull(),           // AES-256-GCM ciphertext
  checksum:     text('checksum').notNull(),         // SHA256 of plaintext (client-computed)
  profileCount: integer('profile_count').notNull().default(0),
  version:      integer('version').notNull().default(1),
  createdAt:    timestamptz('created_at').defaultNow().notNull(),
  updatedAt:    timestamptz('updated_at').defaultNow().notNull(),
})

// ---------------------------------------------------------------------------
// sync_logs
// ---------------------------------------------------------------------------
export const syncLogs = pgTable('sync_logs', {
  id:           uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId:       uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  direction:    text('direction').notNull(),  // push|pull
  profileCount: integer('profile_count').notNull().default(0),
  status:       text('status').notNull(),     // success|error
  errorMessage: text('error_message'),
  syncedAt:     timestamptz('synced_at').defaultNow().notNull(),
}, (t) => ({
  userIdx: index('sync_logs_user_idx').on(t.userId),
}))

// ---------------------------------------------------------------------------
// audit_logs
// ---------------------------------------------------------------------------
export const auditLogs = pgTable('audit_logs', {
  id:         uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  teamId:     uuid('team_id').references(() => teams.id, { onDelete: 'set null' }),
  userId:     uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  userName:   text('user_name'),
  action:     text('action').notNull(),
  targetId:   text('target_id'),
  targetName: text('target_name'),
  ipAddress:  text('ip_address'),
  createdAt:  timestamptz('created_at').defaultNow().notNull(),
}, (t) => ({
  teamIdx: index('audit_logs_team_idx').on(t.teamId, t.createdAt),
  userIdx: index('audit_logs_user_idx').on(t.userId, t.createdAt),
}))

// ---------------------------------------------------------------------------
// webhooks
// ---------------------------------------------------------------------------
export const webhooks = pgTable('webhooks', {
  id:                uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId:            uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name:              text('name').notNull(),
  url:               text('url').notNull(),
  events:            text('events').array().notNull(),  // ['profile.created', ...]
  secret:            text('secret'),                    // HMAC signing key
  enabled:           boolean('enabled').default(true).notNull(),
  lastTriggeredAt:   timestamptz('last_triggered_at'),
  lastStatus:        integer('last_status'),
  createdAt:         timestamptz('created_at').defaultNow().notNull(),
  updatedAt:         timestamptz('updated_at').defaultNow().notNull(),
}, (t) => ({
  userIdx: index('webhooks_user_idx').on(t.userId),
}))

// ---------------------------------------------------------------------------
// webhook_deliveries
// ---------------------------------------------------------------------------
export const webhookDeliveries = pgTable('webhook_deliveries', {
  id:             uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  webhookId:      uuid('webhook_id').notNull().references(() => webhooks.id, { onDelete: 'cascade' }),
  event:          text('event').notNull(),
  payload:        jsonb('payload').notNull(),
  responseStatus: integer('response_status'),
  responseBody:   text('response_body'),
  attempt:        integer('attempt').default(1).notNull(),
  deliveredAt:    timestamptz('delivered_at').defaultNow().notNull(),
}, (t) => ({
  webhookIdx: index('webhook_deliveries_webhook_idx').on(t.webhookId, t.deliveredAt),
}))

// ---------------------------------------------------------------------------
// Relations (for Drizzle query API)
// ---------------------------------------------------------------------------
export const usersRelations = relations(users, ({ many, one }) => ({
  sessions:     many(sessions),
  license:      one(licenses, { fields: [users.id], references: [licenses.userId] }),
  teamMember:   many(teamMembers),
  syncBundle:   one(syncBundles, { fields: [users.id], references: [syncBundles.userId] }),
  webhooks:     many(webhooks),
  auditLogs:    many(auditLogs),
}))

export const licensesRelations = relations(licenses, ({ one, many }) => ({
  user:    one(users, { fields: [licenses.userId], references: [users.id] }),
  devices: many(licenseDevices),
}))

export const teamsRelations = relations(teams, ({ one, many }) => ({
  owner:    one(users, { fields: [teams.ownerId], references: [users.id] }),
  members:  many(teamMembers),
  invites:  many(teamInvites),
  shared:   many(sharedProfiles),
  audit:    many(auditLogs),
}))

export const webhooksRelations = relations(webhooks, ({ one, many }) => ({
  user:       one(users, { fields: [webhooks.userId], references: [users.id] }),
  deliveries: many(webhookDeliveries),
}))

// ---------------------------------------------------------------------------
// Type exports (inferred from schema)
// ---------------------------------------------------------------------------
export type User          = typeof users.$inferSelect
export type NewUser       = typeof users.$inferInsert
export type Session       = typeof sessions.$inferSelect
export type License       = typeof licenses.$inferSelect
export type LicenseDevice = typeof licenseDevices.$inferSelect
export type Team          = typeof teams.$inferSelect
export type TeamMember    = typeof teamMembers.$inferSelect
export type TeamInvite    = typeof teamInvites.$inferSelect
export type SharedProfile = typeof sharedProfiles.$inferSelect
export type SyncBundle    = typeof syncBundles.$inferSelect
export type AuditLog      = typeof auditLogs.$inferSelect
export type Webhook       = typeof webhooks.$inferSelect
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect
