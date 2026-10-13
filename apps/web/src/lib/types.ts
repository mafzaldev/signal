import type { Rule, Serve, Target, Variation } from '@signal/core';
import type { FlagKind, SdkKeyKind } from '@signal/core/schemas';

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
  /** Whether browser SDKs (client keys) can evaluate it. */
  clientSide: boolean;
  environments: FlagConfigSummary[];
}

/** A flag's targeting in one environment, as returned by the flag list. */
export interface FlagConfigSummary {
  environmentKey: string;
  enabled: boolean;
  offVariation: number;
  targets: Target[];
  rules: Rule[];
  fallthrough: Serve;
  version: number;
}

export interface FlagConfig extends FlagConfigSummary {
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

export type Role = 'owner' | 'admin' | 'member' | 'viewer';

export interface Member {
  id: string;
  role: Role;
  createdAt: string;
  user: { id: string; name: string; email: string };
}

export interface Invitation {
  id: string;
  email: string;
  role: Role;
  status: 'pending' | 'accepted' | 'rejected' | 'canceled';
  expiresAt: string;
  createdAt: string;
  inviterId: string;
}

/** An invitation as its recipient sees it, with the organization's name. */
export interface InvitationDetail extends Invitation {
  organizationName: string;
  inviterEmail: string;
}

export interface SdkKey {
  id: string;
  name: string;
  kind: SdkKeyKind;
  keyPrefix: string;
  createdAt: string;
}
