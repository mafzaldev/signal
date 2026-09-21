import type { Rule, Serve, Target, Variation } from '@feature-flags/core';
import type { FlagKind } from '@feature-flags/core/schemas';
import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { organization, user } from './auth.js';

// Millisecond precision so timestamps round-trip through JS Dates (used as pagination cursors).
const createdAt = () =>
  timestamp('created_at', { withTimezone: true, precision: 3 }).defaultNow().notNull();
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true, precision: 3 })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull();

export const project = pgTable(
  'project',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    name: text('name').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [unique().on(table.organizationId, table.key)],
);

export const environment = pgTable(
  'environment',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    name: text('name').notNull(),
    createdAt: createdAt(),
  },
  (table) => [unique().on(table.projectId, table.key)],
);

export const flag = pgTable(
  'flag',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    kind: text('kind').$type<FlagKind>().notNull(),
    variations: jsonb('variations').$type<Variation[]>().notNull(),
    salt: text('salt')
      .notNull()
      .default(sql`gen_random_uuid()::text`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [unique().on(table.projectId, table.key)],
);

/** A flag's targeting for one environment. */
export const flagConfig = pgTable(
  'flag_config',
  {
    flagId: uuid('flag_id')
      .notNull()
      .references(() => flag.id, { onDelete: 'cascade' }),
    environmentId: uuid('environment_id')
      .notNull()
      .references(() => environment.id, { onDelete: 'cascade' }),
    enabled: boolean('enabled').notNull().default(false),
    offVariation: integer('off_variation').notNull(),
    targets: jsonb('targets').$type<Target[]>().notNull().default([]),
    rules: jsonb('rules').$type<Rule[]>().notNull().default([]),
    fallthrough: jsonb('fallthrough').$type<Serve>().notNull(),
    /** Bumped on every change to the flag or this config, so SDKs can tell what's newer. */
    version: integer('version').notNull().default(1),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({ columns: [table.flagId, table.environmentId] }),
    index('flag_config_environment_id_idx').on(table.environmentId),
  ],
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    /** Kept when the user is deleted so history stays intact. */
    actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    /** Plain ids, not foreign keys: entries must survive the project being deleted. */
    projectId: uuid('project_id'),
    environmentId: uuid('environment_id'),
    before: jsonb('before'),
    after: jsonb('after'),
    createdAt: createdAt(),
  },
  (table) => [index('audit_log_org_created_idx').on(table.organizationId, table.createdAt)],
);

/** Lets an SDK read one environment's flags. Only a hash of the key is stored. */
export const sdkKey = pgTable(
  'sdk_key',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    environmentId: uuid('environment_id')
      .notNull()
      .references(() => environment.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** `server` keys receive full rulesets. Client keys come with browser support. */
    kind: text('kind').$type<'server'>().notNull().default('server'),
    keyHash: text('key_hash').notNull().unique(),
    /** First characters of the key, so people can tell keys apart. */
    keyPrefix: text('key_prefix').notNull(),
    createdAt: createdAt(),
  },
  (table) => [index('sdk_key_environment_id_idx').on(table.environmentId)],
);
