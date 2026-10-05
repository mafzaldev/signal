'use client';

import { BUCKET_SCALE, type Serve, type Variation } from '@signal/core';
import { Select } from '@/components/select';
import { Button, cx, Input } from '@/components/ui';
import { percentToWeight, variationLabel, weightToPercent } from '@/lib/targeting';

/** Colors for variations in rollout bars, in variation order. */
const VARIATION_COLORS = [
  'bg-signal',
  'bg-ink',
  'bg-blue-500',
  'bg-amber-400',
  'bg-teal-500',
  'bg-faint',
];
export const variationColor = (index: number) => VARIATION_COLORS[index % VARIATION_COLORS.length]!;

export function VariationSelect({
  variations,
  value,
  onChange,
  label,
  className,
}: {
  variations: Variation[];
  value: number;
  onChange: (index: number) => void;
  label: string;
  className?: string;
}) {
  return (
    <Select
      label={label}
      mono
      className={cx('w-40', className)}
      value={String(value)}
      onChange={(next) => onChange(Number(next))}
      options={variations.map((_, index) => ({
        value: String(index),
        label: variationLabel(variations, index),
        prefix: <span className={cx('size-2 shrink-0 rounded-full', variationColor(index))} />,
      }))}
    />
  );
}

function ModeToggle({
  rollout,
  onChange,
}: {
  rollout: boolean;
  onChange: (rollout: boolean) => void;
}) {
  return (
    <div className="inline-flex gap-1">
      {[
        { value: false, label: 'One value' },
        { value: true, label: 'Percentage rollout' },
      ].map((option) => (
        <button
          key={option.label}
          type="button"
          aria-pressed={rollout === option.value}
          onClick={() => onChange(option.value)}
          className={cx(
            'text-xs font-medium rounded-md px-2.5 py-1.5 transition-colors',
            rollout === option.value
              ? 'bg-ink text-paper'
              : 'text-muted hover:bg-wash hover:text-ink',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
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
  const remainder = BUCKET_SCALE - total;

  const setWeights = (next: number[]) =>
    onChange({ rollout: next.map((weight, variation) => ({ variation, weight })) });

  function setMode(rollout: boolean) {
    if (rollout && !isRollout) {
      setWeights(variations.map((_, i) => (i === serve.variation ? BUCKET_SCALE : 0)));
    } else if (!rollout && isRollout) {
      onChange({ variation: Math.max(weights.indexOf(Math.max(...weights)), 0) });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <ModeToggle rollout={isRollout} onChange={setMode} />
        {!isRollout && (
          <VariationSelect
            label={`${label}: value`}
            variations={variations}
            value={serve.variation}
            onChange={(variation) => onChange({ variation })}
          />
        )}
      </div>

      {isRollout && (
        <div className="flex flex-col gap-3 rounded-lg border border-rule bg-surface p-4">
          <div className="flex h-2 overflow-hidden rounded-full bg-wash" aria-hidden="true">
            {weights.map((weight, index) => (
              <div
                key={index}
                className={cx(variationColor(index), 'transition-all')}
                style={{ width: `${(weight / BUCKET_SCALE) * 100}%` }}
              />
            ))}
          </div>
          {variations.map((_, index) => (
            <div
              key={index}
              className="grid grid-cols-[auto_minmax(0,1fr)_6.5rem] items-center gap-3"
            >
              <span className={cx('size-2.5 rounded-full', variationColor(index))} />
              <div className="flex min-w-0 items-center gap-3">
                <span className="w-24 truncate font-mono text-[13px]">
                  {variationLabel(variations, index)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={weightToPercent(weights[index]!)}
                  onChange={(e) =>
                    setWeights(
                      weights.map((w, i) =>
                        i === index ? percentToWeight(Number(e.target.value)) : w,
                      ),
                    )
                  }
                  aria-label={`${variationLabel(variations, index)} percentage`}
                  className="min-w-0 flex-1 accent-signal"
                />
              </div>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.001}
                  value={weightToPercent(weights[index]!)}
                  onChange={(e) =>
                    setWeights(
                      weights.map((w, i) =>
                        i === index ? percentToWeight(Number(e.target.value)) : w,
                      ),
                    )
                  }
                  aria-label={`${variationLabel(variations, index)} percentage`}
                  className="pr-7 text-right tabular-nums"
                />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[13px] text-faint">
                  %
                </span>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 border-t border-dashed border-rule-strong pt-3 text-[13px]">
            <span className={remainder === 0 ? 'text-muted' : 'font-medium text-signal-ink'}>
              Total {weightToPercent(total)}%{remainder !== 0 && ` · must add up to 100%`}
            </span>
            {remainder !== 0 && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  setWeights(
                    weights.map((w, i) =>
                      i === weights.length - 1 ? Math.max(0, w + remainder) : w,
                    ),
                  )
                }
              >
                Give the rest to {variationLabel(variations, variations.length - 1)}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
