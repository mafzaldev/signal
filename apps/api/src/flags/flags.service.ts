import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type CreateFlagInput,
  type UpdateFlagConfigInput,
  type UpdateFlagInput,
  variationRefsAreValid,
  variationsMatchKind,
} from '@signal/core/schemas';
import { and, asc, eq, sql } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { Actor } from '../common/actor.decorator.js';
import { isUniqueViolation } from '../common/db-errors.js';
import type { Database, Transaction } from '../db/client.js';
import { environment, flag, flagConfig } from '../db/schema/index.js';
import { DB } from '../database/database.module.js';
import { ProjectsService } from '../projects/projects.service.js';
import { RulesetService } from '../ruleset/ruleset.service.js';
import { BOOLEAN_VARIATIONS, defaultFlagConfig } from './flag-defaults.js';

const configColumns = {
  environmentId: flagConfig.environmentId,
  environmentKey: environment.key,
  enabled: flagConfig.enabled,
  offVariation: flagConfig.offVariation,
  targets: flagConfig.targets,
  rules: flagConfig.rules,
  fallthrough: flagConfig.fallthrough,
  version: flagConfig.version,
  updatedAt: flagConfig.updatedAt,
};

@Injectable()
export class FlagsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly projects: ProjectsService,
    private readonly audit: AuditService,
    private readonly rulesets: RulesetService,
  ) {}

  /** Locks the flag row until the transaction ends, so concurrent edits apply one at a time. */
  private async lockFlag(tx: Transaction, projectId: string, key: string) {
    const [row] = await tx
      .select()
      .from(flag)
      .where(and(eq(flag.projectId, projectId), eq(flag.key, key)))
      .for('update');
    if (!row) throw new NotFoundException(`Flag "${key}" not found`);
    return row;
  }

  private configsFor(flagId: string, tx: Database | Transaction = this.db) {
    return tx
      .select(configColumns)
      .from(flagConfig)
      .innerJoin(environment, eq(environment.id, flagConfig.environmentId))
      .where(eq(flagConfig.flagId, flagId))
      .orderBy(asc(environment.createdAt));
  }

  /** Each flag with its targeting in every environment, enough to summarize it in a list. */
  async list(organizationId: string, projectKey: string) {
    const parent = await this.projects.requireProject(organizationId, projectKey);
    const flags = await this.db
      .select()
      .from(flag)
      .where(eq(flag.projectId, parent.id))
      .orderBy(asc(flag.key));
    const configs = await this.db
      .select({
        flagId: flagConfig.flagId,
        environmentKey: environment.key,
        enabled: flagConfig.enabled,
        offVariation: flagConfig.offVariation,
        targets: flagConfig.targets,
        rules: flagConfig.rules,
        fallthrough: flagConfig.fallthrough,
        version: flagConfig.version,
      })
      .from(flagConfig)
      .innerJoin(environment, eq(environment.id, flagConfig.environmentId))
      .where(eq(environment.projectId, parent.id))
      .orderBy(asc(environment.createdAt));

    return flags.map((f) => ({
      ...f,
      environments: configs
        .filter((c) => c.flagId === f.id)
        .map((c) => ({
          environmentKey: c.environmentKey,
          enabled: c.enabled,
          offVariation: c.offVariation,
          targets: c.targets,
          rules: c.rules,
          fallthrough: c.fallthrough,
          version: c.version,
        })),
    }));
  }

  async get(organizationId: string, projectKey: string, flagKey: string) {
    const parent = await this.projects.requireProject(organizationId, projectKey);
    const [row] = await this.db
      .select()
      .from(flag)
      .where(and(eq(flag.projectId, parent.id), eq(flag.key, flagKey)));
    if (!row) throw new NotFoundException(`Flag "${flagKey}" not found`);
    return { ...row, environments: await this.configsFor(row.id) };
  }

  /** Creates the flag switched off in every environment. */
  async create(actor: Actor, projectKey: string, input: CreateFlagInput) {
    let result;
    try {
      result = await this.db.transaction(async (tx) => {
        const parent = await this.projects.requireProject(actor.organizationId, projectKey, tx);
        const [created] = await tx
          .insert(flag)
          .values({
            projectId: parent.id,
            key: input.key,
            name: input.name,
            description: input.description,
            kind: input.kind,
            variations: input.variations ?? BOOLEAN_VARIATIONS,
            clientSide: input.clientSide,
          })
          .returning();

        const environments = await tx
          .select({ id: environment.id })
          .from(environment)
          .where(eq(environment.projectId, parent.id));
        if (environments.length > 0) {
          await tx.insert(flagConfig).values(
            environments.map((env) => ({
              flagId: created!.id,
              environmentId: env.id,
              ...defaultFlagConfig(input.kind),
            })),
          );
        }

        const result = { ...created!, environments: await this.configsFor(created!.id, tx) };
        await this.audit.record(tx, actor, {
          action: 'flag.created',
          entityType: 'flag',
          entityId: created!.id,
          projectId: parent.id,
          after: result,
        });
        return result;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Flag "${input.key}" already exists`);
      }
      throw error;
    }
    await this.rulesets.flagChanged(result.id);
    return result;
  }

  /** Changing variations bumps every environment's version, since evaluation results may change. */
  async update(actor: Actor, projectKey: string, flagKey: string, input: UpdateFlagInput) {
    const updated = await this.db.transaction(async (tx) => {
      const parent = await this.projects.requireProject(actor.organizationId, projectKey, tx);
      const before = await this.lockFlag(tx, parent.id, flagKey);

      if (input.variations) {
        if (!variationsMatchKind(before.kind, input.variations)) {
          throw new BadRequestException(`Every variation value must be a ${before.kind}`);
        }
        const configs = await this.configsFor(before.id, tx);
        const broken = configs.filter((c) => !variationRefsAreValid(c, input.variations!.length));
        if (broken.length > 0) {
          const keys = broken.map((c) => c.environmentKey).join(', ');
          throw new BadRequestException(
            `Removing these variations would break targeting in: ${keys}. Update those environments first.`,
          );
        }
        await tx
          .update(flagConfig)
          .set({ version: sql`${flagConfig.version} + 1` })
          .where(eq(flagConfig.flagId, before.id));
      }

      const [after] = await tx.update(flag).set(input).where(eq(flag.id, before.id)).returning();
      await this.audit.record(tx, actor, {
        action: 'flag.updated',
        entityType: 'flag',
        entityId: before.id,
        projectId: parent.id,
        before,
        after,
      });
      return after!;
    });
    // Name and description changes stay out of SDKs. Client-side access changes what
    // browsers may evaluate, so it's published too.
    if (input.variations || input.clientSide !== undefined) {
      await this.rulesets.flagChanged(updated.id);
    }
    return updated;
  }

  async delete(actor: Actor, projectKey: string, flagKey: string) {
    const configs = await this.db.transaction(async (tx) => {
      const parent = await this.projects.requireProject(actor.organizationId, projectKey, tx);
      const before = await this.lockFlag(tx, parent.id, flagKey);
      const configs = await tx
        .select({ environmentId: flagConfig.environmentId, version: flagConfig.version })
        .from(flagConfig)
        .where(eq(flagConfig.flagId, before.id));
      await tx.delete(flag).where(eq(flag.id, before.id));

      await this.audit.record(tx, actor, {
        action: 'flag.deleted',
        entityType: 'flag',
        entityId: before.id,
        projectId: parent.id,
        before,
      });
      return configs;
    });
    await this.rulesets.flagDeleted(flagKey, configs);
  }

  /** Partial update of one environment's targeting; omitted fields stay as they are. */
  async updateConfig(
    actor: Actor,
    projectKey: string,
    flagKey: string,
    environmentKey: string,
    input: UpdateFlagConfigInput,
  ) {
    const updated = await this.db.transaction(async (tx) => {
      const parent = await this.projects.requireProject(actor.organizationId, projectKey, tx);
      const target = await this.lockFlag(tx, parent.id, flagKey);
      const env = await this.projects.requireEnvironment(parent.id, environmentKey, tx);

      const [before] = await tx
        .select()
        .from(flagConfig)
        .where(and(eq(flagConfig.flagId, target.id), eq(flagConfig.environmentId, env.id)));
      if (!before)
        throw new NotFoundException(`Flag "${flagKey}" has no config in "${environmentKey}"`);

      if (!variationRefsAreValid({ ...before, ...input }, target.variations.length)) {
        throw new BadRequestException(
          `Variation indexes must be between 0 and ${target.variations.length - 1}`,
        );
      }

      const [after] = await tx
        .update(flagConfig)
        .set({ ...input, version: before.version + 1 })
        .where(and(eq(flagConfig.flagId, target.id), eq(flagConfig.environmentId, env.id)))
        .returning();

      await this.audit.record(tx, actor, {
        action: 'flag_config.updated',
        entityType: 'flag_config',
        entityId: target.id,
        projectId: parent.id,
        environmentId: env.id,
        // Keys make the entry readable after the flag or environment is renamed or deleted.
        before: { ...before, flagKey, environmentKey: env.key },
        after: { ...after!, flagKey, environmentKey: env.key },
      });
      return { ...after!, environmentKey: env.key };
    });
    await this.rulesets.flagChanged(updated.flagId, [updated.environmentId]);
    return updated;
  }
}
