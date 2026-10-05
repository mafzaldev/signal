import Link from 'next/link';
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from 'react';

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

const buttonVariants = {
  primary: 'bg-ink text-paper hover:bg-ink-2',
  secondary: 'border border-rule-strong bg-surface text-ink hover:border-ink',
  ghost: 'text-muted hover:bg-wash hover:text-ink',
  danger: 'bg-danger text-white hover:bg-danger/90',
};
const buttonSizes = {
  sm: 'h-7 gap-1.5 px-2.5 text-xs',
  md: 'h-8 gap-2 px-3 text-[13px]',
  icon: 'size-8',
};

export type ButtonVariant = keyof typeof buttonVariants;

export function buttonClass(
  variant: ButtonVariant = 'primary',
  size: keyof typeof buttonSizes = 'md',
  className?: string,
) {
  return cx(
    'inline-flex shrink-0 items-center justify-center rounded-md font-medium transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal',
    'disabled:pointer-events-none disabled:opacity-50',
    buttonVariants[variant],
    buttonSizes[size],
    className,
  );
}

export function Button({
  variant,
  size,
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: keyof typeof buttonSizes;
}) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

/**
 * Fields are filled boxes, a shade darker than panels so they read as inset on both the
 * page and sheets. The border brightens on hover; focus adds the signal ring.
 */
export const fieldClass = cx(
  'rounded-md border border-rule-strong bg-paper text-sm text-ink transition-[border-color,box-shadow]',
  'placeholder:text-faint hover:border-muted',
  'focus:border-signal/70 focus:ring-3 focus:ring-signal/15 focus:outline-none',
  'disabled:border-rule disabled:bg-transparent disabled:text-muted',
);

/** Fields fill their container unless the caller gives them a width. */
function fieldWidth(className?: string) {
  return /(^|\s)(w-|min-w-|flex-1|basis-)/.test(className ?? '') ? undefined : 'w-full';
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input className={cx(fieldClass, 'h-9 px-3', fieldWidth(className), className)} {...props} />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(
        fieldClass,
        'px-3 py-2 font-mono text-[13px]',
        fieldWidth(className),
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx('flex flex-col gap-1.5', className)}>
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Card({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx('border-t border-rule-strong', className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-4 pt-3">
          <div className="min-w-0">
            {title && <h2 className="font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-1 text-[13px] text-muted">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      {children && <div className="pt-4 pb-2">{children}</div>}
    </section>
  );
}

const badgeTones = {
  zinc: 'bg-wash text-ink-2',
  green: 'bg-signal-wash text-signal-ink',
  amber: 'bg-amber-500/15 text-amber-300',
  rose: 'bg-danger-wash text-danger',
  sky: 'bg-blue-500/15 text-blue-300',
};
export type Tone = keyof typeof badgeTones;

export function Badge({ children, tone = 'zinc' }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded px-1.5 py-px font-mono text-[11px] font-medium',
        badgeTones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
  size = 'md',
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  size?: 'md' | 'lg';
}) {
  const lg = size === 'lg';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative inline-flex shrink-0 rounded-full border transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-50',
        lg ? 'h-6 w-11' : 'h-4.5 w-8',
        checked ? 'border-signal bg-signal' : 'border-rule-strong bg-surface',
      )}
    >
      <span
        className={cx(
          'absolute top-0.5 rounded-full transition-all',
          lg ? 'size-4.5' : 'size-3',
          checked ? 'bg-white' : 'bg-faint',
          checked ? (lg ? 'left-5.5' : 'left-4.25') : 'left-0.5',
        )}
      />
    </button>
  );
}

export function ErrorMessage({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-md bg-danger-wash px-3 py-2 text-[13px] text-danger">
      {children}
    </p>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 border-y border-rule py-10">
      <div className="text-faint">{icon}</div>
      <div>
        <h3 className="font-medium">{title}</h3>
        <p className="mt-1 max-w-md text-[13px] text-muted">{description}</p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}

export function PageHeader({
  back,
  title,
  description,
  actions,
}: {
  /** A link back up one level, shown above the title. */
  back?: { href: string; label: string };
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-10 flex flex-col gap-3">
      {back && (
        <Link href={back.href} className="text-xs font-medium w-fit text-muted hover:text-ink">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-4xl font-semibold tracking-tight text-balance">{title}</h1>
          {description && (
            <div className="mt-2 max-w-2xl text-[13px] text-muted">{description}</div>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/** Links styled as tabs, e.g. Targeting / Settings. */
export function TabLinks({
  tabs,
  active,
}: {
  tabs: { key: string; label: string; href: string }[];
  active: string;
}) {
  return (
    <div className="mb-8 flex gap-1">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === active ? 'page' : undefined}
          className={cx(
            'text-xs font-medium rounded-md px-2.5 py-1.5 transition-colors',
            tab.key === active ? 'bg-ink text-paper' : 'text-muted hover:bg-wash hover:text-ink',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

/** Two-column settings row: what it is on the left, the controls on the right. */
export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-4 border-t border-rule py-8 first:border-rule-strong md:grid-cols-[16rem_1fr] md:gap-10">
      <div>
        <h2 className="font-semibold text-ink">{title}</h2>
        <p className="mt-2 text-[13px] text-muted">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
