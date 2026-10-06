import { describe, expect, it } from 'vitest';
import { describeAuditEntry } from './audit';
import type { AuditEntry } from './types';

function entry(action: string, before: unknown, after: unknown): AuditEntry {
  return {
    id: '1',
    actorId: 'u',
    action,
    entityType: action.split('.')[0]!,
    entityId: 'e',
    projectId: 'p',
    environmentId: null,
    before,
    after,
    createdAt: '2026-10-13T10:00:00.000Z',
  };
}

describe('describeAuditEntry', () => {
  it('describes turning a flag on in an environment', () => {
    expect(
      describeAuditEntry(
        entry(
          'flag_config.updated',
          { enabled: false, version: 1, flagKey: 'new-checkout', environmentKey: 'production' },
          { enabled: true, version: 2, flagKey: 'new-checkout', environmentKey: 'production' },
        ),
      ),
    ).toEqual({ text: 'turned on new-checkout', environmentKey: 'production' });
  });

  it('names the parts of targeting that changed', () => {
    const result = describeAuditEntry(
      entry(
        'flag_config.updated',
        {
          rules: [],
          fallthrough: { variation: 0 },
          targets: [],
          flagKey: 'f',
          environmentKey: 'staging',
        },
        {
          rules: [{ id: 'r' }],
          fallthrough: { variation: 1 },
          targets: [],
          flagKey: 'f',
          environmentKey: 'staging',
        },
      ),
    );
    expect(result.text).toBe('changed the rules and default rule of f');
  });

  it('falls back when older entries lack the flag key', () => {
    expect(
      describeAuditEntry(entry('flag_config.updated', { enabled: true }, { enabled: false })).text,
    ).toBe('turned off a flag');
  });

  it('describes renames', () => {
    expect(
      describeAuditEntry(entry('project.updated', { name: 'Web' }, { name: 'Web App' })).text,
    ).toBe('renamed project Web to Web App');
  });

  it('describes created and deleted entities by name', () => {
    expect(describeAuditEntry(entry('flag.created', null, { name: 'New checkout' })).text).toBe(
      'created flag New checkout',
    );
    expect(
      describeAuditEntry(
        entry('sdk_key.revoked', { name: 'Backend', environmentKey: 'production' }, null),
      ),
    ).toEqual({ text: 'revoked SDK key "Backend"', environmentKey: 'production' });
  });
});
