'use client';

import type { FlagKind } from '@signal/core/schemas';
import { useState } from 'react';
import { PlusIcon, TrashIcon } from '@/components/icons';
import { Button, Input } from '@/components/ui';

const PLACEHOLDERS: Record<Exclude<FlagKind, 'boolean'>, string[]> = {
  string: ['blue', 'green'],
  number: ['10', '20'],
  json: ['{"theme":"light"}', '{"theme":"dark"}'],
};

/**
 * One input per variation. Submits them as a `name` field with one value per
 * line, the format the server action parses.
 */
export function VariationsInput({
  kind,
  name,
  initial,
}: {
  kind: Exclude<FlagKind, 'boolean'>;
  name: string;
  initial?: string[];
}) {
  const [values, setValues] = useState(initial ?? ['', '']);
  const update = (index: number, value: string) =>
    setValues(values.map((v, i) => (i === index ? value : v)));

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={values.join('\n')} />
      {values.map((value, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="w-5 shrink-0 text-right font-mono text-xs text-faint">{index}</span>
          <Input
            value={value}
            onChange={(e) => update(index, e.target.value)}
            placeholder={PLACEHOLDERS[kind][index] ?? ''}
            inputMode={kind === 'number' ? 'decimal' : undefined}
            className={kind === 'json' ? 'font-mono' : undefined}
            aria-label={`Variation ${index}`}
          />
          <Button
            variant="ghost"
            size="icon"
            disabled={values.length <= 2}
            onClick={() => setValues(values.filter((_, i) => i !== index))}
            aria-label={`Remove variation ${index}`}
          >
            <TrashIcon />
          </Button>
        </div>
      ))}
      <div className="pl-7">
        <Button variant="secondary" size="sm" onClick={() => setValues([...values, ''])}>
          <PlusIcon className="size-3.5" />
          Add variation
        </Button>
      </div>
    </div>
  );
}
