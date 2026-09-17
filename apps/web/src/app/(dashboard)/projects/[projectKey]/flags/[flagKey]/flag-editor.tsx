'use client';

import type { Flag, Rule } from '@feature-flags/core';
import { updateFlagConfigSchema } from '@feature-flags/core/schemas';
import { useState, useTransition } from 'react';
import { Button, Card, ErrorMessage, Switch } from '@/components/ui';
import type { FlagConfig, FlagDetail } from '@/lib/types';
import { updateFlagConfig } from '../../../actions';
import { RuleEditor } from './rule-editor';
import { ServeEditor, VariationSelect } from './serve-editor';
import { TargetsEditor } from './targets-editor';
import { TestPanel } from './test-panel';

type Draft = Pick<FlagConfig, 'enabled' | 'offVariation' | 'targets' | 'rules' | 'fallthrough'>;

function toDraft(config: FlagConfig): Draft {
  const { enabled, offVariation, targets, rules, fallthrough } = config;
  return { enabled, offVariation, targets, rules, fallthrough };
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <h2 className="font-medium">{title}</h2>
      <p className="mb-4 text-sm text-zinc-500">{hint}</p>
      {children}
    </Card>
  );
}

export function FlagEditor({
  projectKey,
  flag,
  config,
  environmentName,
}: {
  projectKey: string;
  flag: FlagDetail;
  config: FlagConfig;
  environmentName: string;
}) {
  const [draft, setDraft] = useState(() => toDraft(config));
  const [error, setError] = useState<string>();
  const [saving, startSaving] = useTransition();
  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(config));
  const { variations } = flag;

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const setRules = (rules: Rule[]) => update({ rules });

  function save() {
    const parsed = updateFlagConfigSchema.safeParse(draft);
    if (!parsed.success) {
      return setError(
        parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      );
    }
    if (
      config.environmentKey === 'production' &&
      !window.confirm(`Save these changes to ${environmentName}?`)
    ) {
      return;
    }
    setError(undefined);
    startSaving(async () => {
      const result = await updateFlagConfig(
        projectKey,
        flag.key,
        config.environmentKey,
        parsed.data,
      );
      if (result?.error) setError(result.error);
    });
  }

  const previewFlag: Flag = {
    key: flag.key,
    version: config.version,
    salt: flag.salt,
    variations,
    ...draft,
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        <Card className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Switch
              checked={draft.enabled}
              onChange={(enabled) => update({ enabled })}
              label={`Flag on in ${environmentName}`}
            />
            <span className="text-sm font-medium">
              {draft.enabled ? 'On' : 'Off'} in {environmentName}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {dirty && <span className="text-xs text-amber-600">Unsaved changes</span>}
            <Button
              variant="secondary"
              disabled={!dirty || saving}
              onClick={() => setDraft(toDraft(config))}
            >
              Discard
            </Button>
            <Button disabled={!dirty || saving} onClick={save}>
              Save
            </Button>
          </div>
        </Card>
        <ErrorMessage>{error}</ErrorMessage>

        <Section title="Individual targets" hint="Checked first, before any rule.">
          <TargetsEditor
            targets={draft.targets}
            variations={variations}
            onChange={(targets) => update({ targets })}
          />
        </Section>

        <Section title="Rules" hint="Checked top to bottom. The first matching rule wins.">
          <div className="space-y-3">
            {draft.rules.map((rule, index) => (
              <RuleEditor
                key={rule.id}
                rule={rule}
                index={index}
                count={draft.rules.length}
                variations={variations}
                onChange={(next) => setRules(draft.rules.map((r) => (r.id === rule.id ? next : r)))}
                onRemove={() => setRules(draft.rules.filter((r) => r.id !== rule.id))}
                onMove={(offset) => {
                  const rules = [...draft.rules];
                  [rules[index], rules[index + offset]] = [rules[index + offset]!, rules[index]!];
                  setRules(rules);
                }}
              />
            ))}
            <Button
              variant="secondary"
              onClick={() =>
                setRules([
                  ...draft.rules,
                  {
                    id: crypto.randomUUID(),
                    clauses: [{ attribute: '', operator: 'in', values: [] }],
                    serve: { variation: 0 },
                  },
                ])
              }
            >
              + Rule
            </Button>
          </div>
        </Section>

        <Section title="Default rule" hint="Applies when no target or rule matches.">
          <ServeEditor
            label="Default rule"
            serve={draft.fallthrough}
            variations={variations}
            onChange={(fallthrough) => update({ fallthrough })}
          />
        </Section>

        <Section title="When the flag is off" hint="Everyone gets this value.">
          <VariationSelect
            label="Off variation"
            variations={variations}
            value={draft.offVariation}
            onChange={(offVariation) => update({ offVariation })}
          />
        </Section>
      </div>

      <aside>
        <Card className="lg:sticky lg:top-6">
          <h2 className="mb-3 font-medium">Test a context</h2>
          <TestPanel flag={previewFlag} />
        </Card>
      </aside>
    </div>
  );
}
