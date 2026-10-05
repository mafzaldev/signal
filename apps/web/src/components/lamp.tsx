import { cx } from './ui';

/** An indicator lamp: signal orange when on, unlit when off. */
export function Lamp({ on, className }: { on: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'inline-block size-2 shrink-0 rounded-full transition-colors',
        on ? 'bg-signal' : 'bg-current opacity-25',
        className,
      )}
    />
  );
}
