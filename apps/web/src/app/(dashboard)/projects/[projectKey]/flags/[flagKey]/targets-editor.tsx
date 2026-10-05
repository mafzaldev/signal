'use client';

import type { Target, Variation } from '@signal/core';
import { useState } from 'react';
import { cx, Textarea } from '@/components/ui';
import { parseKeyList, variationLabel } from '@/lib/targeting';
import { variationColor } from './serve-editor';

/** One list of context keys per variation. */
export function TargetsEditor({
  targets,
  variations,
  onChange,
}: {
  targets: Target[];
  variations: Variation[];
  onChange: (targets: Target[]) => void;
}) {
  const [texts, setTexts] = useState(() =>
    variations.map((_, index) =>
      targets
        .filter((t) => t.variation === index)
        .flatMap((t) => t.values)
        .join('\n'),
    ),
  );

  function update(index: number, text: string) {
    const next = texts.map((t, i) => (i === index ? text : t));
    setTexts(next);
    onChange(
      next
        .map((t, variation) => ({ variation, values: parseKeyList(t) }))
        .filter((t) => t.values.length > 0),
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {variations.map((_, index) => {
        const count = parseKeyList(texts[index] ?? '').length;
        return (
          <label key={index} className="flex flex-col gap-1.5">
            <span className="flex items-center gap-2 text-[13px]">
              <span className={cx('size-2 rounded-full', variationColor(index))} />
              Serve{' '}
              <code className="font-mono font-semibold">
                {variationLabel(variations, index)}
              </code>{' '}
              to
              <span className="ml-auto text-xs text-faint">
                {count} {count === 1 ? 'key' : 'keys'}
              </span>
            </span>
            <Textarea
              rows={3}
              placeholder="user-123, one per line or comma-separated"
              value={texts[index]}
              onChange={(e) => update(index, e.target.value)}
            />
          </label>
        );
      })}
    </div>
  );
}
