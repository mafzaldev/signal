'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { XIcon } from './icons';
import { Button } from './ui';

const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
const IN_MS = 280;
const OUT_MS = 200;

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A panel that slides in from the right, for creating and editing things. */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Keeps the content rendered while the panel slides out.
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    const panel = panelRef.current;
    if (!dialog || !panel) return;
    const still = reducedMotion();

    if (open) {
      // Still open means it was reopened mid-slide-out: stop that slide and come back in.
      if (dialog.open) {
        dialog.getAnimations({ subtree: true }).forEach((a) => a.cancel());
        setClosing(false);
      } else {
        dialog.showModal();
      }
      // The Web Animations API runs on the compositor, so the slide stays smooth while
      // React renders the form inside it.
      panel.animate([{ transform: 'translateX(100%)' }, { transform: 'translateX(0)' }], {
        duration: still ? 0 : IN_MS,
        easing: EASE,
      });
      dialog.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: still ? 0 : IN_MS,
        pseudoElement: '::backdrop',
      });
      // `preventScroll` stops the browser from jumping to the field mid-slide.
      dialog
        .querySelector<HTMLElement>(
          'input:not([type=hidden]), select, textarea, button[type=submit]',
        )
        ?.focus({ preventScroll: true });
    }

    if (!open && dialog.open) {
      setClosing(true);
      const slide = panel.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(100%)' }],
        { duration: still ? 0 : OUT_MS, easing: 'ease-in', fill: 'forwards' },
      );
      dialog.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: still ? 0 : OUT_MS,
        fill: 'forwards',
        pseudoElement: '::backdrop',
      });
      slide.finished
        .then(() => {
          dialog.close();
          setClosing(false);
          // Drop the finished animations so the next open starts clean.
          dialog.getAnimations({ subtree: true }).forEach((a) => a.cancel());
        })
        // Cancelled because the sheet reopened mid-slide; nothing to clean up.
        .catch(() => {});
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      // Escape fires `cancel`; slide out instead of letting the browser close it at once.
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // Clicking the backdrop (the dialog element itself, outside its content) closes it.
      onClick={(e) => e.target === dialogRef.current && onClose()}
      className="m-0 ml-auto h-dvh max-h-none w-full max-w-md overflow-hidden bg-transparent p-0 text-left text-ink"
    >
      <div
        ref={panelRef}
        className="flex h-full flex-col border-l border-rule bg-surface will-change-transform"
      >
        {(open || closing) && (
          <>
            <div className="flex items-start justify-between gap-4 border-b border-rule px-6 py-4">
              <div>
                <h2 className="text-base font-semibold">{title}</h2>
                {description && <p className="mt-1 text-[13px] text-muted">{description}</p>}
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
                <XIcon />
              </Button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6">{children}</div>
          </>
        )}
      </div>
    </dialog>
  );
}

/** Buttons pinned to the bottom of a sheet. Put it last inside the sheet's form. */
export function SheetActions({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 -mx-6 mt-auto -mb-6 flex justify-end gap-2 border-t border-rule bg-surface px-6 py-4">
      {children}
    </div>
  );
}
