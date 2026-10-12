import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateSdkKeyInput } from '@signal/core/schemas';
import { and, asc, eq } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { Actor } from '../common/actor.decorator.js';
import type { Database } from '../db/client.js';
import { sdkKey } from '../db/schema/index.js';
import { DB } from '../database/database.module.js';
import { ProjectsService } from '../projects/projects.service.js';
import { RulesetService } from '../ruleset/ruleset.service.js';
import { generateSdkKey } from './sdk-key-crypto.js';

/** Everything but the hash. */
const publicColumns = {
  id: sdkKey.id,
  name: sdkKey.name,
  kind: sdkKey.kind,
  keyPrefix: sdkKey.keyPrefix,
  createdAt: sdkKey.createdAt,
};

@Injectable()
export class SdkKeysService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly projects: ProjectsService,
    private readonly audit: AuditService,
    private readonly rulesets: RulesetService,
  ) {}

  async list(organizationId: string, projectKey: string, environmentKey: string) {
    const parent = await this.projects.requireProject(organizationId, projectKey);
    const env = await this.projects.requireEnvironment(parent.id, environmentKey);
    return this.db
      .select(publicColumns)
      .from(sdkKey)
      .where(eq(sdkKey.environmentId, env.id))
      .orderBy(asc(sdkKey.createdAt));
  }

  /** The full key is only returned here; afterwards only its prefix is known. */
  create(actor: Actor, projectKey: string, environmentKey: string, input: CreateSdkKeyInput) {
    return this.db.transaction(async (tx) => {
      const parent = await this.projects.requireProject(actor.organizationId, projectKey, tx);
      const env = await this.projects.requireEnvironment(parent.id, environmentKey, tx);
      const { key, keyHash, keyPrefix } = generateSdkKey(input.kind);
      const [created] = await tx
        .insert(sdkKey)
        .values({ environmentId: env.id, name: input.name, kind: input.kind, keyHash, keyPrefix })
        .returning(publicColumns);

      await this.audit.record(tx, actor, {
        action: 'sdk_key.created',
        entityType: 'sdk_key',
        entityId: created!.id,
        projectId: parent.id,
        environmentId: env.id,
        after: { ...created!, environmentKey: env.key },
      });
      return { ...created!, key };
    });
  }

  async revoke(actor: Actor, projectKey: string, environmentKey: string, id: string) {
    const environmentId = await this.db.transaction(async (tx) => {
      const parent = await this.projects.requireProject(actor.organizationId, projectKey, tx);
      const env = await this.projects.requireEnvironment(parent.id, environmentKey, tx);
      const [before] = await tx
        .delete(sdkKey)
        .where(and(eq(sdkKey.id, id), eq(sdkKey.environmentId, env.id)))
        .returning(publicColumns);
      if (!before) throw new NotFoundException('SDK key not found');

      await this.audit.record(tx, actor, {
        action: 'sdk_key.revoked',
        entityType: 'sdk_key',
        entityId: before.id,
        projectId: parent.id,
        environmentId: env.id,
        before: { ...before, environmentKey: env.key },
      });
      return env.id;
    });
    await this.rulesets.closeStreams([environmentId], id);
  }
}
