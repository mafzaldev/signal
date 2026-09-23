import type { Rule, Serve, Target, Variation } from '@feature-flags/core';
import type { FlagKind } from '@feature-flags/core/schemas';

export interface SessionData {
  user: { id: string; name: string; email: string };
  session: { activeOrganizationId?: string | null };
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
}

export interface Environment {
  id: string;
  key: string;
  name: string;
}

export interface Project {
  id: string;
  key: string;
  name: string;
}

export interface ProjectWithEnvironments extends Project {
  environments: Environment[];
}

export interface FlagSummary {
  id: string;
  key: string;
  name: string;
  description: string;
  kind: FlagKind;
  variations: Variation[];
  environments: { environmentKey: string; enabled: boolean; version: number }[];
}

export interface FlagConfig {
  environmentKey: string;
  enabled: boolean;
  offVariation: number;
  targets: Target[];
  rules: Rule[];
  fallthrough: Serve;
  version: number;
  updatedAt: string;
}

export interface FlagDetail extends Omit<FlagSummary, 'environments'> {
  salt: string;
  environments: FlagConfig[];
}

export interface AuditEntry {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  projectId: string | null;
  environmentId: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
}

export interface AuditPage {
  items: AuditEntry[];
  nextCursor: string | null;
}

export interface Member {
  id: string;
  role: string;
  user: { id: string; name: string; email: string };
}

export interface SdkKey {
  id: string;
  name: string;
  kind: 'server';
  keyPrefix: string;
  createdAt: string;
}
