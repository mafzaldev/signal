'use client';

import { BUCKET_SCALE, type Serve, type Variation } from '@signal/core';
import { Input, Select } from '@/components/ui';
import { percentToWeight, variationLabel, weightToPercent } from '@/lib/targeting';

export function VariationSelect({
  variations,
  value,
  onChange,
  label,
}: {
  variations: Variation[];
  value: number;
  onChange: (index: number) => void;
  label: string;
}) {
  return (
    <Select
      aria-label={label}
      className="w-auto min-w-40"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      {variations.map((_, index) => (
        <option key={index} value={index}>
          {variationLabel(variations, index)}
        </option>
      ))}
    </Select>
  );
}

/** Serve one variation, or split contexts between variations by percentage. */
export function ServeEditor({
  serve,
  variations,
  onChange,
  label,
}: {
  serve: Serve;
  variations: Variation[];
  onChange: (serve: Serve) => void;
  label: string;
}) {
  const isRollout = 'rollout' in serve;
  const weights = variations.map((_, index) =>
    isRollout ? (serve.rollout.find((w) => w.variation === index)?.weight ?? 0) : 0,
  );
  const total = weights.reduce((sum, w) => sum + w, 0);

  function setMode(mode: string) {
    if (mode === 'rollout') {
      const first = isRollout ? 0 : serve.variation;
      onChange({
        rollout: variations.map((_, index) => ({
          variation: index,
          weight: index === first ? BUCKET_SCALE : 0,
        })),
      });
    } else {
      const largest = weights.indexOf(Math.max(...weights));
      onChange({ variation: Math.max(largest, 0) });
    }
  }

  function setPercent(index: number, percent: number) {
    onChange({
      rollout: variations.map((_, i) => ({
        variation: i,
        weight: i === index ? percentToWeight(percent) : weights[i]!,
      })),
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>Serve</span>
        <Select
          aria-label={`${label}: serve mode`}
          className="w-auto"
          value={isRollout ? 'rollout' : 'variation'}
          onChange={(e) => setMode(e.target.value)}
        >
          <option value="variation">a fixed value</option>
          <option value="rollout">a percentage rollout</option>
        </Select>
        {!isRollout && (
          <VariationSelect
            label={`${label}: variation`}
            variations={variations}
            value={serve.variation}
            onChange={(variation) => onChange({ variation })}
          />
        )}
      </div>
      {isRollout && (
        <div className="space-y-1.5 rounded-md bg-zinc-50 p-3">
          {variations.map((_, index) => (
            <label key={index} className="flex items-center gap-3 text-sm">
              <Input
                type="number"
                min={0}
                max={100}
                step={0.001}
                className="w-24"
                value={weightToPercent(weights[index]!)}
                onChange={(e) => setPercent(index, Number(e.target.value))}
              />
              <span>% {variationLabel(variations, index)}</span>
            </label>
          ))}
          <p className={`text-xs ${total === BUCKET_SCALE ? 'text-zinc-500' : 'text-red-600'}`}>
            Total {weightToPercent(total)}% {total === BUCKET_SCALE ? '' : '(must be 100%)'}
          </p>
        </div>
      )}
    </div>
  );
}
