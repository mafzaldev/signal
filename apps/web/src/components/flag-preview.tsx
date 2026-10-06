'use client';

import { evaluate, type Flag } from '@signal/core';
import { useState } from 'react';
import { percentToWeight } from '@/lib/targeting';
import { EnvironmentDot } from './environment';
import { Lamp } from './lamp';
import { cx, Switch } from './ui';

const VARIATIONS = [{ value: true }, { value: false }];

const ENVIRONMENTS = [
  { key: 'development', name: 'Development' },
  { key: 'staging', name: 'Staging' },
  { key: 'production', name: 'Production' },
] as const;
type EnvironmentKey = (typeof ENVIRONMENTS)[number]['key'];

/** The example flag in one environment, as the SDK would receive it. */
function flagFor(env: EnvironmentKey, enabled: boolean, stagingPercent: number): Flag {
  const base = {
    key: 'new-checkout',
    version: 1,
    salt: 'preview',
    enabled,
    variations: VARIATIONS,
    offVariation: 1,
    targets: [],
  };
  if (env === 'staging') {
    return {
      ...base,
      rules: [],
      fallthrough: {
        rollout: [
          { variation: 0, weight: percentToWeight(stagingPercent) },
          { variation: 1, weight: percentToWeight(100 - stagingPercent) },
        ],
      },
    };
  }
  if (env === 'production') {
    return {
      ...base,
      rules: [
        {
          id: 'pakistan',
          clauses: [{ attribute: 'country', operator: 'in', values: ['PK'] }],
          serve: { variation: 0 },
        },
      ],
      fallthrough: { variation: 1 },
    };
  }
  return { ...base, rules: [], fallthrough: { variation: 0 } };
}

/**
 * A working example flag for the sign-in screen. It runs the same evaluation as the SDK,
 * so flipping switches, moving the rollout or changing the user shows real results.
 */
export function FlagPreview() {
  const [enabled, setEnabled] = useState<Record<EnvironmentKey, boolean>>({
    development: true,
    staging: true,
    production: false,
  });
  const [stagingPercent, setStagingPercent] = useState(50);
  const [selected, setSelected] = useState<EnvironmentKey>('staging');
  const [userKey, setUserKey] = useState('user-123');

  const summary = (env: EnvironmentKey) => {
    if (!enabled[env]) return 'false';
    if (env === 'staging') return `${stagingPercent}% true`;
    if (env === 'production') return 'PK → true';
    return 'true';
  };

  const flag = flagFor(selected, enabled[selected], stagingPercent);
  const result = evaluate(flag, { key: userKey || 'anonymous', country: 'PK' });
  const value = result.variationIndex === 0 ? 'true' : 'false';
  const step = {
    OFF: 'off',
    TARGET_MATCH: 'target',
    RULE_MATCH: 'rule 01',
    FALLTHROUGH: selected === 'staging' ? `${stagingPercent}% rollout` : 'default',
    ERROR: 'error',
  }[result.reason.kind];

  return (
    <div className="max-w-md rounded-xl border border-rule-strong bg-paper p-5">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="font-semibold">New checkout</div>
          <div className="font-mono text-xs text-muted">new-checkout</div>
        </div>
        <span className="text-xs text-faint">Try it</span>
      </div>

      <ul className="mt-4 divide-y divide-rule border-y border-rule">
        {ENVIRONMENTS.map((env) => (
          <li key={env.key}>
            {/* The row picks which environment the user below is evaluated in. */}
            <div
              role="button"
              tabIndex={0}
              aria-pressed={selected === env.key}
              onClick={() => setSelected(env.key)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelected(env.key);
                }
              }}
              className={cx(
                '-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 text-[13px] transition-colors',
                selected === env.key ? 'bg-wash' : 'hover:bg-surface',
              )}
            >
              <EnvironmentDot environmentKey={env.key} />
              <span className="w-24">{env.name}</span>
              {/* Clicking the switch flips it without also selecting the row. */}
              <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                <Switch
                  checked={enabled[env.key]}
                  onChange={(on) => setEnabled((current) => ({ ...current, [env.key]: on }))}
                  label={`New checkout in ${env.name}`}
                />
              </span>
              <span className="ml-auto font-mono text-xs text-muted">{summary(env.key)}</span>
            </div>
          </li>
        ))}
      </ul>

      <label className="mt-4 block">
        <span className="flex justify-between text-xs text-muted">
          <span>Staging rollout</span>
          <span className="font-mono">
            {stagingPercent}% true · {100 - stagingPercent}% false
          </span>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={stagingPercent}
          onChange={(e) => setStagingPercent(Number(e.target.value))}
          aria-label="Staging rollout percentage"
          className="mt-2 w-full accent-signal"
        />
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-surface px-3 py-2 font-mono text-xs text-ink-2">
        <input
          value={userKey}
          onChange={(e) => setUserKey(e.target.value)}
          aria-label="User key"
          spellCheck={false}
          className="w-24 rounded bg-ink px-1.5 text-paper outline-none focus:ring-2 focus:ring-signal/40"
        />
        <span className="text-faint">in {selected}</span>
        <span className="text-faint">→</span>
        <span>{step}</span>
        <span className="text-faint">→</span>
        <span className="flex items-center gap-1.5 text-ink">
          <Lamp on={value === 'true'} className="text-ink" />
          {value}
        </span>
      </div>
    </div>
  );
}
