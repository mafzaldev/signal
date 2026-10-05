import { cx } from './ui';

/**
 * The Signal mark: an indicator lamp lit inside its bezel. The ring takes the text colour,
 * so it works on light and dark; the lamp is always signal orange.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cx('shrink-0', className ?? 'size-5')}>
      <circle cx="16" cy="16" r="11.5" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="16" cy="16" r="6" className="fill-signal" />
    </svg>
  );
}

/** The mark with the name beside it. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx('flex items-center gap-2 font-semibold tracking-tight', className)}>
      <LogoMark />
      Signal
    </span>
  );
}
