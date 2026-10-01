import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateEnvironmentInput,
  CreateProjectInput,
  UpdateProjectInput,
} from '@signal/core/schemas';
import { and, asc, eq } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { Actor } from '../common/actor.decorator.js';
import { isUniqueViolation } from '../common/db-errors.js';
import type { Database, Transaction } from '../db/client.js';
import { environment, flag, flagConfig, project } from '../db/schema/index.js';
import { DB } from '../database/database.module.js';
import { defaultFlagConfig } from '../flags/flag-defaults.js';
import { RulesetService } from '../ruleset/ruleset.service.js';

const DEFAULT_ENVIRONMENTS = [
  { key: 'development', name: 'Development' },
  { key: 'staging', name: 'Staging' },
  { key: 'production', name: 'Production' },
];

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
    private readonly rulesets: RulesetService,
  ) {}

  /**
   * Looks a project up within an organization. Every project-scoped query goes
   * through here, which is what keeps one organization out of another's data.
   */
  async requireProject(organizationId: string, key: string, tx: Database | Transaction = this.db) {
    const [row] = await tx
      .select()
      .from(project)
      .where(and(eq(project.organizationId, organizationId), eq(project.key, key)));
    if (!row) throw new NotFoundException(`Project "${key}" not found`);
    return row;
  }

  async requireEnvironment(projectId: string, key: string, tx: Database | Transaction = this.db) {
    const [row] = await tx
      .select()
      .from(environment)
      .where(and(eq(environment.projectId, projectId), eq(environment.key, key)));
    if (!row) throw new NotFoundException(`Environment "${key}" not found`);
    return row;
  }

  list(organizationId: string) {
    return this.db
      .select()
      .from(project)
      .where(eq(project.organizationId, organizationId))
      .orderBy(asc(project.name));
  }

  async get(organizationId: string, key: string) {
    const row = await this.requireProject(organizationId, key);
    const environments = await this.db
      .select()
      .from(environment)
      .where(eq(environment.projectId, row.id))
      .orderBy(asc(environment.createdAt));
    return { ...row, environments };
  }

  async create(actor: Actor, input: CreateProjectInput) {
    try {
      return await this.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(project)
          .values({ organizationId: actor.organizationId, ...input })
          .returning();
        const environments = await tx
          .insert(environment)
          .values(DEFAULT_ENVIRONMENTS.map((env) => ({ projectId: created!.id, ...env })))
          .returning();
        const result = { ...created!, environments };

        await this.audit.record(tx, actor, {
          action: 'project.created',
          entityType: 'project',
          entityId: created!.id,
          projectId: created!.id,
          after: result,
        });
        return result;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Project "${input.key}" already exists`);
      }
      throw error;
    }
  }

  update(actor: Actor, key: string, input: UpdateProjectInput) {
    return this.db.transaction(async (tx) => {
      const before = await this.requireProject(actor.organizationId, key, tx);
      const [after] = await tx
        .update(project)
        .set(input)
        .where(eq(project.id, before.id))
        .returning();

      await this.audit.record(tx, actor, {
        action: 'project.updated',
        entityType: 'project',
        entityId: before.id,
        projectId: before.id,
        before,
        after,
      });
      return after!;
    });
  }

  /** Also ends SDK streams for the project's environments. */
  async delete(actor: Actor, key: string) {
    const environmentIds = await this.db.transaction(async (tx) => {
      const before = await this.requireProject(actor.organizationId, key, tx);
      const environments = await tx
        .select({ id: environment.id })
        .from(environment)
        .where(eq(environment.projectId, before.id));
      await tx.delete(project).where(eq(project.id, before.id));

      await this.audit.record(tx, actor, {
        action: 'project.deleted',
        entityType: 'project',
        entityId: before.id,
        projectId: before.id,
        before,
      });
      return environments.map((e) => e.id);
    });
    await this.rulesets.closeStreams(environmentIds);
  }

  /** Also gives every existing flag a switched-off config in the new environment. */
  async createEnvironment(actor: Actor, projectKey: string, input: CreateEnvironmentInput) {
    try {
      return await this.db.transaction(async (tx) => {
        const parent = await this.requireProject(actor.organizationId, projectKey, tx);
        const [created] = await tx
          .insert(environment)
          .values({ projectId: parent.id, ...input })
          .returning();

        const flags = await tx
          .select({ id: flag.id, kind: flag.kind })
          .from(flag)
          .where(eq(flag.projectId, parent.id));
        if (flags.length > 0) {
          await tx.insert(flagConfig).values(
            flags.map((f) => ({
              flagId: f.id,
              environmentId: created!.id,
              ...defaultFlagConfig(f.kind),
            })),
          );
        }

        await this.audit.record(tx, actor, {
          action: 'environment.created',
          entityType: 'environment',
          entityId: created!.id,
          projectId: parent.id,
          environmentId: created!.id,
          after: created,
        });
        return created!;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Environment "${input.key}" already exists`);
      }
      throw error;
    }
  }

  /** Also ends SDK streams for the environment. */
  async deleteEnvironment(actor: Actor, projectKey: string, environmentKey: string) {
    const environmentId = await this.db.transaction(async (tx) => {
      const parent = await this.requireProject(actor.organizationId, projectKey, tx);
      const before = await this.requireEnvironment(parent.id, environmentKey, tx);
      await tx.delete(environment).where(eq(environment.id, before.id));

      await this.audit.record(tx, actor, {
        action: 'environment.deleted',
        entityType: 'environment',
        entityId: before.id,
        projectId: parent.id,
        environmentId: before.id,
        before,
      });
      return before.id;
    });
    await this.rulesets.closeStreams([environmentId]);
  }
}
