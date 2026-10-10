import type { ReactNode } from 'react';
import { FlagPreview } from './flag-preview';
import { Logo } from './logo';

const FACTS = [
  'Changes reach running apps in under a second.',
  'Apps keep their flags if Signal goes down.',
  'Every change is in the audit log, with before and after.',
];

/** What Signal does, shown beside the form on wide screens. */
function ProductPanel() {
  return (
    <aside className="hidden flex-col border-r border-rule bg-surface px-12 py-10 lg:flex xl:px-20">
      <Logo className="text-[15px]" />
      <div className="flex flex-1 flex-col justify-center gap-10 py-12">
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold tracking-tight text-balance">
            Ship features behind a switch.
          </h2>
          <p className="mt-3 text-[15px] text-muted">
            Turn features on per environment, target the users you choose, and roll out by
            percentage. Your code asks Signal; Signal answers instantly.
          </p>
        </div>

        <FlagPreview />

        <ul className="flex max-w-md flex-col gap-2.5 text-[13px] text-ink-2">
          {FACTS.map((fact) => (
            <li key={fact} className="flex items-start gap-2.5">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-signal" />
              {fact}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

/** Sign-in, sign-up and onboarding: what Signal does on the left, the form on the right. */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <ProductPanel />
      <div className="flex flex-col px-6 py-10 sm:px-12">
        {/* On wide screens the logo sits in the panel instead. */}
        <Logo className="text-[15px] lg:hidden" />
        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-sm">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {description && <p className="mt-1 text-[13px] text-muted">{description}</p>}
            <div className="mt-8">{children}</div>
            {footer && <p className="mt-8 text-[13px] text-muted">{footer}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
