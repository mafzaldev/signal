'use client';

import { useState } from 'react';
import { CheckIcon, CopyIcon } from './icons';
import { cx } from './ui';

/** Copies `value`, briefly showing a check mark. */
export function CopyButton({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className={cx(
        'inline-grid size-6 place-items-center rounded-md text-faint hover:bg-wash hover:text-ink',
        className,
      )}
    >
      {copied ? (
        <CheckIcon className="size-3.5 text-signal-ink" />
      ) : (
        <CopyIcon className="size-3.5" />
      )}
    </button>
  );
}
