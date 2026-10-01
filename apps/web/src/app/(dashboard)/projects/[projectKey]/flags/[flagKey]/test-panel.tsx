'use client';

import { evaluate, type Context, type Flag } from '@signal/core';
import { useState } from 'react';
import { Field, Textarea } from '@/components/ui';
import { variationLabel } from '@/lib/targeting';

function describeReason(result: ReturnType<typeof evaluate>): string {
  const { reason } = result;
  switch (reason.kind) {
    case 'OFF':
      return 'Flag is off, so the off variation is served';
    case 'TARGET_MATCH':
      return 'Individually targeted';
    case 'RULE_MATCH':
      return `Matched rule ${reason.ruleIndex + 1}`;
    case 'FALLTHROUGH':
      return 'No rule matched, so the default rule applies';
    case 'ERROR':
      return 'The flag configuration is invalid';
  }
}

/** Evaluates the unsaved draft with the same engine the SDK uses. */
export function TestPanel({ flag }: { flag: Flag }) {
  const [text, setText] = useState('{\n  "key": "user-123",\n  "country": "PK"\n}');

  let output: { value: string; reason: string } | { error: string };
  try {
    const context = JSON.parse(text) as Context;
    if (typeof context?.key !== 'string') throw new Error('Context needs a string "key"');
    const result = evaluate(flag, context);
    output = {
      value:
        result.variationIndex === null
          ? 'none'
          : variationLabel(flag.variations, result.variationIndex),
      reason: describeReason(result),
    };
  } catch (error) {
    output = { error: error instanceof Error ? error.message : 'Invalid context' };
  }

  return (
    <div className="space-y-3">
      <Field label="Context (JSON)" hint="Uses your unsaved changes.">
        <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
      {'error' in output ? (
        <p className="text-sm text-red-600">{output.error}</p>
      ) : (
        <div className="rounded-md bg-zinc-50 p-3 text-sm">
          <div>
            Serves <span className="font-mono font-medium">{output.value}</span>
          </div>
          <div className="text-zinc-500">{output.reason}</div>
        </div>
      )}
    </div>
  );
}
