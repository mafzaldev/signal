'use client';

import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { CheckIcon, ChevronDownIcon } from './icons';
import { cx, fieldClass } from './ui';

export interface SelectOption {
  value: string;
  label: string;
  /** Shown before the label, e.g. a colour dot. */
  prefix?: ReactNode;
}

/**
 * A dropdown that matches the rest of the app, unlike the browser's native one.
 * Focus stays on the button; arrow keys move through the options, Enter picks, Escape closes.
 */
export function Select({
  value,
  onChange,
  options,
  label,
  className,
  mono,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Accessible name; the dropdown has no visible label of its own. */
  label: string;
  className?: string;
  /** Show values in the monospace font, for flag values. */
  mono?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const id = useId();
  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = options[selectedIndex];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  // Keep the highlighted option in view when moving with the keyboard.
  useEffect(() => {
    if (open) listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  function show() {
    setActive(Math.max(selectedIndex, 0));
    setOpen(true);
  }

  function pick(index: number) {
    const option = options[index];
    if (option && option.value !== value) onChange(option.value);
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent) {
    const last = options.length - 1;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        show();
      }
      return;
    }
    const moves: Record<string, () => number> = {
      ArrowDown: () => Math.min(active + 1, last),
      ArrowUp: () => Math.max(active - 1, 0),
      Home: () => 0,
      End: () => last,
    };
    if (moves[e.key]) {
      e.preventDefault();
      setActive(moves[e.key]!());
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pick(active);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className={cx('relative', className ?? 'w-full')}>
      <button
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        className={cx(
          fieldClass,
          'flex h-9 w-full items-center gap-2 px-3 text-left',
          open && 'border-signal/70 ring-3 ring-signal/15',
        )}
      >
        {selected?.prefix}
        <span className={cx('min-w-0 flex-1 truncate', mono && 'font-mono')}>
          {selected?.label ?? ''}
        </span>
        <ChevronDownIcon
          className={cx('size-3.5 shrink-0 text-muted transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={`${id}-list`}
          role="listbox"
          aria-label={label}
          className="absolute top-full left-0 z-40 mt-1 max-h-64 min-w-full overflow-y-auto rounded-lg border border-rule bg-surface p-1"
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${id}-${index}`}
              role="option"
              aria-selected={option.value === value}
              // Keep focus on the button, so keyboard handling stays in one place.
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(index)}
              onClick={() => pick(index)}
              className={cx(
                'flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap',
                index === active ? 'bg-wash text-ink' : 'text-ink-2',
              )}
            >
              {option.prefix}
              <span className={cx('flex-1', mono && 'font-mono')}>{option.label}</span>
              <CheckIcon
                className={cx(
                  'size-3.5 text-signal-ink',
                  option.value === value ? 'visible' : 'invisible',
                )}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
