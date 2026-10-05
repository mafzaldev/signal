'use client';

import { type Context, evaluate, type EvaluationResult, type Flag } from '@signal/core';
import { cx, Textarea } from '@/components/ui';
import { variationLabel } from '@/lib/targeting';
import { variationColor } from './serve-editor';

export const DEFAULT_PROBE = '{\n  "key": "user-123",\n  "country": "PK"\n}';

export type Probe = { key: string; result: EvaluationResult } | { error: string };

/** Evaluates the draft for a test user with the same engine the SDK uses. */
export function runProbe(flag: Flag, text: string): Probe {
  try {
    const context = JSON.parse(text) as Context;
    if (typeof context?.key !== 'string') return { error: 'The context needs a string "key".' };
    const result = evaluate(flag, context);
    if (result.reason.kind === 'ERROR') return { error: 'The configuration is invalid.' };
    return { key: context.key, result };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Invalid context' };
  }
}

function describeReason(result: EvaluationResult): string {
  const { reason } = result;
  switch (reason.kind) {
    case 'OFF':
      return 'The flag is off, so everyone gets the off value.';
    case 'TARGET_MATCH':
      return 'This key is individually targeted.';
    case 'RULE_MATCH':
      return `Matched rule ${String(reason.ruleIndex + 1).padStart(2, '0')}.`;
    case 'FALLTHROUGH':
      return 'Not targeted and no rule matched, so the default rule applies.';
    case 'ERROR':
      return 'The configuration is invalid.';
  }
}

export function TestPanel({
  flag,
  text,
  onTextChange,
  probe,
}: {
  flag: Flag;
  text: string;
  onTextChange: (text: string) => void;
  probe: Probe;
}) {
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Context</span>
        <Textarea
          rows={6}
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          spellCheck={false}
        />
      </label>
      {'error' in probe ? (
        <p className="rounded-md bg-danger-wash px-3 py-2 text-[13px] text-danger">{probe.error}</p>
      ) : (
        <div className="rounded-lg border border-rule bg-surface p-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted">Gets</span>
            <span
              className={cx('size-2 rounded-full', variationColor(probe.result.variationIndex!))}
            />
            <code className="font-mono font-semibold">
              {variationLabel(flag.variations, probe.result.variationIndex!)}
            </code>
          </div>
          <p className="mt-1 text-xs text-muted">{describeReason(probe.result)}</p>
        </div>
      )}
      <p className="text-xs text-faint">
        Edit the context and watch its path light up. Uses your unsaved changes.
      </p>
    </div>
  );
}
