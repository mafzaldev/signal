import type { Environment } from '@/lib/types';
import { cx, type Tone } from './ui';

/** Consistent colors so production is always recognizable. */
export function environmentTone(key: string): Tone {
  if (/^(prod|production|live)$/.test(key)) return 'rose';
  if (/^(stag|staging|qa|uat|preview)$/.test(key)) return 'amber';
  if (/^(dev|development|local|test)$/.test(key)) return 'sky';
  return 'zinc';
}

const dotColors: Record<Tone, string> = {
  rose: 'bg-danger',
  amber: 'bg-amber-500',
  sky: 'bg-blue-500',
  green: 'bg-signal',
  zinc: 'bg-faint',
};

export function EnvironmentDot({ environmentKey }: { environmentKey: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'inline-block size-2 shrink-0 rounded-full',
        dotColors[environmentTone(environmentKey)],
      )}
    />
  );
}

/** The `?env=` environment if it exists, otherwise the first one. */
export function pickEnvironment(environments: Environment[], requested: unknown) {
  return environments.find((e) => e.key === requested) ?? environments[0];
}
