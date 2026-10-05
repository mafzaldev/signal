'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { XIcon } from './icons';
import { Button, Field, Input } from './ui';

export function Dialog({
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
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // The content mounted while the dialog was still hidden, so `autoFocus` had nothing
      // to focus. Start on the first field, or the submit button when there are none.
      dialog
        .querySelector<HTMLElement>(
          'input:not([type=hidden]), select, textarea, button[type=submit]',
        )
        ?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // Clicking the backdrop (the dialog element itself, outside its content) closes it.
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-rule bg-surface p-0 text-left text-ink"
    >
      {open && (
        <>
          <div className="flex items-center justify-between gap-4 border-b border-rule py-1.5 pr-1.5 pl-5">
            <h2 className="font-semibold">{title}</h2>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
              <XIcon />
            </Button>
          </div>
          <div className="p-5">
            {description && <p className="mb-5 text-[13px] text-muted">{description}</p>}
            {children}
          </div>
        </>
      )}
    </dialog>
  );
}

export function DialogActions({ children }: { children: ReactNode }) {
  return <div className="mt-8 flex justify-end gap-2">{children}</div>;
}

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  tone?: 'default' | 'danger';
  /** When set, the person must type this text to confirm. */
  typeToConfirm?: string;
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

/** In-page replacement for `window.confirm`, available through `useConfirm`. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<{
    options: ConfirmOptions;
    resolve: (confirmed: boolean) => void;
  }>();
  const [typed, setTyped] = useState('');

  const confirm = useCallback<Confirm>(
    (options) =>
      new Promise((resolve) => {
        setTyped('');
        setRequest({ options, resolve });
      }),
    [],
  );

  const settle = (confirmed: boolean) => {
    request?.resolve(confirmed);
    setRequest(undefined);
  };

  const options = request?.options;
  const blocked = Boolean(options?.typeToConfirm && typed !== options.typeToConfirm);

  return (
    <ConfirmContext value={confirm}>
      {children}
      <Dialog
        open={Boolean(request)}
        onClose={() => settle(false)}
        title={options?.title ?? ''}
        description={options?.description}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!blocked) settle(true);
          }}
        >
          {options?.typeToConfirm && (
            <Field label={`Type ${options.typeToConfirm} to confirm`} className="mb-1">
              <Input
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </Field>
          )}
          <DialogActions>
            <Button variant="secondary" onClick={() => settle(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={options?.tone === 'danger' ? 'danger' : 'primary'}
              disabled={blocked}
              autoFocus={!options?.typeToConfirm}
            >
              {options?.confirmLabel ?? 'Confirm'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </ConfirmContext>
  );
}

export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm must be used inside ConfirmProvider');
  return confirm;
}
