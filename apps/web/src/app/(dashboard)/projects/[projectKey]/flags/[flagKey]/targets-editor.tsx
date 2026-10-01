'use client';

import type { Target, Variation } from '@signal/core';
import { useState } from 'react';
import { Field, Textarea } from '@/components/ui';
import { parseKeyList, variationLabel } from '@/lib/targeting';

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
    <div className="grid gap-3 sm:grid-cols-2">
      {variations.map((_, index) => (
        <Field
          key={index}
          label={`Serve ${variationLabel(variations, index)} to`}
          hint="Context keys, one per line"
        >
          <Textarea rows={3} value={texts[index]} onChange={(e) => update(index, e.target.value)} />
        </Field>
      ))}
    </div>
  );
}
