import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, lt, or, type SQL } from 'drizzle-orm';
import type { Database, Transaction } from '../db/client.js';
import { auditLog, project } from '../db/schema/index.js';
import type { Actor } from '../common/actor.decorator.js';
import { DB } from '../database/database.module.js';

export type AuditEntityType = 'project' | 'environment' | 'flag' | 'flag_config';

export interface AuditEntry {
  action: string;
  entityType: AuditEntityType;
  entityId: string;
  projectId?: string;
  environmentId?: string;
  before?: unknown;
  after?: unknown;
}

export interface AuditQuery {
  projectKey?: string;
  entityType?: AuditEntityType;
  entityId?: string;
  actorId?: string;
  limit: number;
  cursor?: string;
}

function encodeCursor(row: { createdAt: Date; id: string }) {
  return `${row.createdAt.toISOString()}_${row.id}`;
}

function decodeCursor(cursor: string) {
  const [createdAt, id] = cursor.split('_');
  const date = new Date(createdAt ?? '');
  return id && !Number.isNaN(date.getTime()) ? { createdAt: date, id } : undefined;
}

@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Call inside the transaction that makes the change, so the change and its log commit together. */
  async record(tx: Transaction, actor: Actor, entry: AuditEntry) {
    await tx.insert(auditLog).values({
      organizationId: actor.organizationId,
      actorId: actor.userId,
      ...entry,
    });
  }

  /** Newest first. Pass the returned `nextCursor` back as `cursor` for the next page. */
  async list(organizationId: string, query: AuditQuery) {
    const filters: (SQL | undefined)[] = [eq(auditLog.organizationId, organizationId)];

    if (query.projectKey) {
      const [match] = await this.db
        .select({ id: project.id })
        .from(project)
        .where(and(eq(project.organizationId, organizationId), eq(project.key, query.projectKey)));
      if (!match) return { items: [], nextCursor: null };
      filters.push(eq(auditLog.projectId, match.id));
    }
    if (query.entityType) filters.push(eq(auditLog.entityType, query.entityType));
    if (query.entityId) filters.push(eq(auditLog.entityId, query.entityId));
    if (query.actorId) filters.push(eq(auditLog.actorId, query.actorId));

    const cursor = query.cursor ? decodeCursor(query.cursor) : undefined;
    if (cursor) {
      filters.push(
        or(
          lt(auditLog.createdAt, cursor.createdAt),
          and(eq(auditLog.createdAt, cursor.createdAt), lt(auditLog.id, cursor.id)),
        ),
      );
    }

    const rows = await this.db
      .select()
      .from(auditLog)
      .where(and(...filters))
      .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
      .limit(query.limit + 1);

    const items = rows.slice(0, query.limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor: rows.length > query.limit && last ? encodeCursor(last) : null,
    };
  }
}
