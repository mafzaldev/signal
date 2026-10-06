import type { AuditEntry } from './types';
import { changedFields } from './targeting';

type Snapshot = Record<string, unknown>;

const asSnapshot = (value: unknown): Snapshot =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Snapshot) : {};

const str = (value: unknown) => (typeof value === 'string' ? value : undefined);

/** Names for snapshot fields, as people know them in the dashboard. */
const FIELD_LABELS: Record<string, string> = {
  enabled: 'on/off',
  targets: 'individual targets',
  rules: 'rules',
  fallthrough: 'default rule',
  offVariation: 'off variation',
  variations: 'variations',
  name: 'name',
  description: 'description',
  key: 'key',
};

export function fieldLabel(field: string) {
  return FIELD_LABELS[field] ?? field;
}

function list(items: string[]) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

/**
 * What an audit entry did, as a sentence fragment that follows the actor's
 * name, e.g. "turned on new-checkout", plus the environment it applied to.
 */
export function describeAuditEntry(entry: AuditEntry): {
  text: string;
  environmentKey?: string;
} {
  const before = asSnapshot(entry.before);
  const after = asSnapshot(entry.after);
  const name = str(after.name) ?? str(before.name) ?? str(after.key) ?? str(before.key) ?? '';
  const changed = changedFields(entry.before, entry.after);

  switch (entry.action) {
    case 'project.created':
      return { text: `created project ${name}` };
    case 'project.updated':
      return changed.includes('name')
        ? { text: `renamed project ${str(before.name)} to ${str(after.name)}` }
        : { text: `updated project ${name}` };
    case 'project.deleted':
      return { text: `deleted project ${name}` };
    case 'environment.created':
      return { text: `added environment ${name}`, environmentKey: str(after.key) };
    case 'environment.deleted':
      return { text: `deleted environment ${name}`, environmentKey: str(before.key) };
    case 'flag.created':
      return { text: `created flag ${name}` };
    case 'flag.updated':
      if (changed.length === 1 && changed[0] === 'name') {
        return { text: `renamed flag ${str(before.name)} to ${str(after.name)}` };
      }
      return { text: `changed the ${list(changed.map(fieldLabel))} of flag ${name}` };
    case 'flag.deleted':
      return { text: `deleted flag ${name}` };
    case 'flag_config.updated': {
      const flag = str(after.flagKey) ?? str(before.flagKey) ?? 'a flag';
      const environmentKey = str(after.environmentKey) ?? str(before.environmentKey);
      if (changed.length === 1 && changed[0] === 'enabled') {
        return { text: `turned ${after.enabled ? 'on' : 'off'} ${flag}`, environmentKey };
      }
      const what = changed.length > 0 ? list(changed.map(fieldLabel)) : 'targeting';
      return { text: `changed the ${what} of ${flag}`, environmentKey };
    }
    case 'sdk_key.created':
      return { text: `created SDK key "${name}"`, environmentKey: str(after.environmentKey) };
    case 'sdk_key.revoked':
      return { text: `revoked SDK key "${name}"`, environmentKey: str(before.environmentKey) };
    default:
      return { text: entry.action };
  }
}
