'use client';

import type { Flag, Rule } from '@signal/core';
import { updateFlagConfigSchema } from '@signal/core/schemas';
import { type ReactNode, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { useConfirm } from '@/components/dialog';
import { EnvironmentDot, environmentTone } from '@/components/environment';
import { PlusIcon } from '@/components/icons';
import { Lamp } from '@/components/lamp';
import { Button, cx, ErrorMessage, Switch } from '@/components/ui';
import { variationLabel } from '@/lib/targeting';
import type { Environment, FlagConfig, FlagDetail } from '@/lib/types';
import { updateFlagConfig } from '../../../actions';
import { RuleEditor } from './rule-editor';
import { ServeEditor, VariationSelect, variationColor } from './serve-editor';
import { TargetsEditor } from './targets-editor';
import { DEFAULT_PROBE, runProbe, TestPanel } from './test-panel';

type Draft = Pick<FlagConfig, 'enabled' | 'offVariation' | 'targets' | 'rules' | 'fallthrough'>;

function toDraft(config: FlagConfig): Draft {
  const { enabled, offVariation, targets, rules, fallthrough } = config;
  return { enabled, offVariation, targets, rules, fallthrough };
}

/**
 * Where the test user's request is along the rail:
 * `passed` it went through without matching, `hit` it stopped here,
 * `bypassed` the flag is off so this stage is skipped, `idle` it never got here.
 */
type StageState = 'idle' | 'passed' | 'hit' | 'bypassed';

const STAGES = ['power', 'targets', 'rules', 'fallthrough'] as const;
type StageName = (typeof STAGES)[number];
const HIT_STAGE = { OFF: 0, TARGET_MATCH: 1, RULE_MATCH: 2, FALLTHROUGH: 3 } as const;

const railClass: Record<StageState, string> = {
  idle: 'w-0.5 bg-rule-strong',
  passed: 'w-0.5 bg-signal',
  // Lit down to the marker, where the request stops.
  hit: 'w-0.5 bg-[linear-gradient(to_bottom,var(--color-signal)_1.25rem,var(--color-rule-strong)_1.25rem)]',
  bypassed: 'border-l-2 border-dashed border-rule-strong',
};

const markerClass: Record<StageState, string> = {
  idle: 'border-rule-strong bg-paper text-ink-2',
  passed: 'border-signal bg-paper text-signal-ink',
  hit: 'border-signal bg-signal text-white',
  bypassed: 'border-dashed border-rule-strong bg-paper text-faint',
};

/** One stop on the rail: a marker in the gutter, the stage's controls beside it. */
function Stage({
  marker,
  title,
  hint,
  state,
  note,
  last,
  children,
}: {
  marker: ReactNode;
  title: ReactNode;
  hint?: ReactNode;
  state: StageState;
  /** Shown beside the title, e.g. "Matched → true". */
  note?: ReactNode;
  last?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-4">
      <div className="relative flex justify-center">
        {!last && (
          <span
            aria-hidden="true"
            className={cx(
              'absolute top-0 bottom-0 left-1/2 -translate-x-1/2 transition-colors',
              railClass[state],
            )}
          />
        )}
        <span
          className={cx(
            'relative z-10 mt-2 grid size-7 place-items-center rounded-md border font-mono text-[10px] font-semibold transition-colors',
            markerClass[state],
          )}
        >
          {marker}
        </span>
      </div>
      <div className={cx('min-w-0 pt-2.5', !last && 'pb-12')}>
        <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className={cx('font-semibold', state === 'bypassed' && 'text-faint')}>{title}</h2>
          {note}
        </header>
        {hint && <p className="mt-1 max-w-2xl text-[13px] text-muted">{hint}</p>}
        {children && (
          <div className={cx('mt-5 transition-opacity', state === 'bypassed' && 'opacity-45')}>
            {children}
          </div>
        )}
      </div>
    </section>
  );
}

function Note({ tone, children }: { tone: 'signal' | 'muted'; children: ReactNode }) {
  return (
    <span
      className={cx(
        'text-xs font-medium rounded px-1.5',
        tone === 'signal' ? 'bg-signal text-white' : 'bg-wash text-muted',
      )}
    >
      {children}
    </span>
  );
}

export function FlagEditor({
  projectKey,
  flag,
  config,
  environment,
}: {
  projectKey: string;
  flag: FlagDetail;
  config: FlagConfig;
  environment: Environment;
}) {
  const [draft, setDraft] = useState(() => toDraft(config));
  const [error, setError] = useState<string>();
  const [probeText, setProbeText] = useState(DEFAULT_PROBE);
  const [saving, startSaving] = useTransition();
  const confirm = useConfirm();
  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(config));
  const { variations } = flag;

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const setRules = (rules: Rule[]) => update({ rules });

  async function save() {
    const parsed = updateFlagConfigSchema.safeParse(draft);
    if (!parsed.success) {
      return setError(
        parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      );
    }
    if (environmentTone(environment.key) === 'rose') {
      const ok = await confirm({
        title: `Save changes to ${environment.name}?`,
        description: 'Apps using this environment pick up the change within a second.',
        confirmLabel: 'Save changes',
      });
      if (!ok) return;
    }
    setError(undefined);
    startSaving(async () => {
      const result = await updateFlagConfig(projectKey, flag.key, environment.key, parsed.data);
      if (result?.error) setError(result.error);
      else toast.success(`Saved ${flag.name} in ${environment.name}`);
    });
  }

  const previewFlag: Flag = {
    key: flag.key,
    version: config.version,
    salt: flag.salt,
    variations,
    ...draft,
  };
  const probe = runProbe(previewFlag, probeText);
  const result = 'result' in probe ? probe.result : undefined;
  const hit = result && result.reason.kind !== 'ERROR' ? HIT_STAGE[result.reason.kind] : -1;
  const matchedRule = result?.reason.kind === 'RULE_MATCH' ? result.reason.ruleIndex : -1;
  const served = result?.variationIndex ?? null;

  function stateOf(stage: StageName): StageState {
    const index = STAGES.indexOf(stage);
    if (!draft.enabled && index > 0) return 'bypassed';
    if (hit < 0) return 'idle';
    return index < hit ? 'passed' : index === hit ? 'hit' : 'idle';
  }

  function noteFor(stage: StageName) {
    const state = stateOf(stage);
    if (state === 'hit' && served !== null) {
      const label = variationLabel(variations, served);
      return (
        <Note tone="signal">{stage === 'power' ? `Serves ${label}` : `Matched → ${label}`}</Note>
      );
    }
    if (state === 'bypassed') return <Note tone="muted">Skipped while off</Note>;
    return null;
  }

  return (
    <>
      <div className="grid gap-12 pb-24 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0">
          <Stage
            marker="▸"
            state={hit >= 0 ? 'passed' : 'idle'}
            title={
              <span className="flex items-center gap-2">
                Request
                {'key' in probe && (
                  <code className="rounded bg-ink px-1.5 font-mono text-[11px] text-paper">
                    {probe.key}
                  </code>
                )}
              </span>
            }
            hint="A user asks for this flag. Follow the line to see what they get."
          />

          <Stage
            marker={<Lamp on={draft.enabled} className="text-ink" />}
            state={stateOf('power')}
            title={
              <span className="flex items-center gap-2">
                {draft.enabled ? 'On' : 'Off'} in
                <EnvironmentDot environmentKey={environment.key} />
                {environment.name}
              </span>
            }
            note={noteFor('power')}
            hint={
              draft.enabled
                ? 'Requests continue down through targeting.'
                : 'Every request goes straight to the off value. You can still prepare the targeting below; it takes effect when you switch the flag on.'
            }
          >
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
              <Switch
                size="lg"
                checked={draft.enabled}
                onChange={(enabled) => update({ enabled })}
                label={`${flag.name} in ${environment.name}`}
              />
              <label className="text-xs font-medium flex items-center gap-3 whitespace-nowrap text-muted">
                When off, serve
                <VariationSelect
                  label="Value served when off"
                  variations={variations}
                  value={draft.offVariation}
                  onChange={(offVariation) => update({ offVariation })}
                />
              </label>
            </div>
          </Stage>

          <Stage
            marker="01"
            state={stateOf('targets')}
            title="Individual targets"
            note={noteFor('targets')}
            hint="Specific users who always get a value. Checked first."
          >
            <TargetsEditor
              targets={draft.targets}
              variations={variations}
              onChange={(targets) => update({ targets })}
            />
          </Stage>

          <Stage
            marker="02"
            state={stateOf('rules')}
            title="Rules"
            note={noteFor('rules')}
            hint="Checked top to bottom. The first rule whose conditions all match decides."
          >
            <div className="flex flex-col gap-3">
              {draft.rules.length === 0 && (
                <p className="text-[13px] text-muted">
                  No rules. Add one to serve a value to users matching conditions, like country or
                  plan.
                </p>
              )}
              {draft.rules.map((rule, index) => (
                <RuleEditor
                  key={rule.id}
                  rule={rule}
                  index={index}
                  count={draft.rules.length}
                  variations={variations}
                  matched={index === matchedRule}
                  onChange={(next) =>
                    setRules(draft.rules.map((r) => (r.id === rule.id ? next : r)))
                  }
                  onRemove={() => setRules(draft.rules.filter((r) => r.id !== rule.id))}
                  onMove={(offset) => {
                    const rules = [...draft.rules];
                    [rules[index], rules[index + offset]] = [rules[index + offset]!, rules[index]!];
                    setRules(rules);
                  }}
                />
              ))}
              <div>
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
                  <PlusIcon />
                  Add rule
                </Button>
              </div>
            </div>
          </Stage>

          <Stage
            marker="03"
            state={stateOf('fallthrough')}
            title="Default rule"
            note={noteFor('fallthrough')}
            hint="Everyone who isn’t targeted and matches no rule."
          >
            <ServeEditor
              label="Default rule"
              serve={draft.fallthrough}
              variations={variations}
              onChange={(fallthrough) => update({ fallthrough })}
            />
          </Stage>

          <Stage marker="◼" state={served !== null ? 'hit' : 'idle'} title="Serves" last>
            <ul className="flex flex-wrap gap-2">
              {variations.map((_, index) => {
                const reached = index === served;
                return (
                  <li
                    key={index}
                    className={cx(
                      'flex items-center gap-2 rounded-md border px-3 py-2 font-mono text-[13px] transition-colors',
                      reached ? 'border-ink bg-ink text-paper' : 'border-rule-strong text-muted',
                    )}
                  >
                    <span className={cx('size-2 rounded-full', variationColor(index))} />
                    {variationLabel(variations, index)}
                    {reached && <Lamp on className="ml-1" />}
                  </li>
                );
              })}
            </ul>
          </Stage>
        </div>

        <aside>
          <section className="xl:sticky xl:top-20">
            <h2 className="mb-1 font-semibold">Test a user</h2>
            <p className="mb-5 text-[13px] text-muted">
              What would a user get in {environment.name}?
            </p>
            <TestPanel
              flag={previewFlag}
              text={probeText}
              onTextChange={setProbeText}
              probe={probe}
            />
          </section>
        </aside>
      </div>

      {(dirty || error) && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-rule-strong bg-surface">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3 sm:px-8">
            <ErrorMessage>{error}</ErrorMessage>
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex flex-1 items-center gap-2 text-[13px]">
                <EnvironmentDot environmentKey={environment.key} />
                Unsaved changes in <span className="font-semibold">{environment.name}</span>
                {!draft.enabled && config.enabled && (
                  <span className="text-muted">
                    · turns the flag off (serves {variationLabel(variations, draft.offVariation)})
                  </span>
                )}
              </span>
              <Button
                variant="secondary"
                disabled={saving}
                onClick={() => {
                  setDraft(toDraft(config));
                  setError(undefined);
                }}
              >
                Discard
              </Button>
              <Button disabled={saving || !dirty} onClick={save}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
