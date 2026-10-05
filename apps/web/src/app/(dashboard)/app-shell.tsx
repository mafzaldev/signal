'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useRef, useState, useTransition } from 'react';
import { ConfirmProvider } from '@/components/dialog';
import { CheckIcon, ChevronDownIcon, LogOutIcon, PlusIcon, UsersIcon } from '@/components/icons';
import { LogoMark } from '@/components/logo';
import { cx } from '@/components/ui';
import { authRequest } from '@/lib/auth-client';
import type { Organization, Project } from '@/lib/types';
import { setActiveOrganization } from './actions';
import { CreateProjectButton } from './create-project-button';

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]!.toUpperCase())
      .join('') || '?'
  );
}

/** A top-bar button that opens a panel below it; clicking outside or Escape closes it. */
function Menu({
  label,
  children,
  align = 'left',
  disabled,
}: {
  label: ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'left' | 'right';
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);

  // A document listener rather than a full-screen overlay: the header's backdrop blur
  // would confine a `fixed` overlay to the header itself.
  useEffect(() => {
    if (!open) return;
    const root = rootRef.current;
    // A sheet opened from the menu (e.g. New project) lives inside it; leave it alone.
    const sheetOpen = () => Boolean(root?.querySelector('dialog[open]'));
    const onPointer = (e: MouseEvent) => {
      if (!root?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sheetOpen()) setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={disabled}
        aria-expanded={open}
        className={cx(
          'my-2 flex h-8 items-center gap-1.5 rounded-md px-2 transition-colors hover:bg-wash disabled:opacity-60',
          open && 'bg-wash',
        )}
      >
        {label}
        <ChevronDownIcon className="size-3 text-muted" />
      </button>
      {open && (
        <div
          className={cx(
            'absolute top-full z-50 mt-1 min-w-60 rounded-lg border border-rule bg-surface p-1 text-ink',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}

const menuItem = 'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left hover:bg-wash';

function MenuHeading({ children }: { children: ReactNode }) {
  return <div className="text-xs font-medium px-3 pt-2 pb-1 text-faint">{children}</div>;
}

function Separator() {
  return <span className="font-mono text-faint">/</span>;
}

function SectionLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'text-xs font-medium flex h-12 items-center border-b-2 px-2 pt-0.5 transition-colors',
        active ? 'border-signal text-ink' : 'border-transparent text-muted hover:text-ink',
      )}
    >
      {children}
    </Link>
  );
}

export function AppShell({
  user,
  organizations,
  activeOrganizationId,
  projects,
  children,
}: {
  user: { name: string; email: string };
  organizations: Organization[];
  activeOrganizationId: string;
  projects: Project[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [switching, startSwitching] = useTransition();
  const organization = organizations.find((o) => o.id === activeOrganizationId);
  const projectKey = pathname.match(/^\/projects\/([^/]+)/)?.[1];
  const project = projects.find((p) => p.key === projectKey);
  const base = project && `/projects/${project.key}`;

  return (
    <>
      <ConfirmProvider>
        <header className="sticky top-0 z-30 border-b border-rule bg-paper/90 text-[13px] text-ink backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-1 px-3 sm:px-6">
            <Link
              href="/projects"
              aria-label="Signal"
              className="mr-2 flex shrink-0 items-center gap-2"
            >
              <LogoMark />
              <span className="hidden font-semibold tracking-tight sm:inline">Signal</span>
            </Link>
            <Separator />

            <Menu
              disabled={switching}
              label={
                <span className="max-w-32 truncate font-medium whitespace-nowrap sm:max-w-48">
                  {organization?.name ?? 'Organization'}
                </span>
              }
            >
              {(close) => (
                <>
                  <MenuHeading>Organizations</MenuHeading>
                  {organizations.map((org) => (
                    <button
                      key={org.id}
                      type="button"
                      className={menuItem}
                      onClick={() => {
                        close();
                        if (org.id !== activeOrganizationId) {
                          startSwitching(() => setActiveOrganization(org.id));
                        }
                      }}
                    >
                      <span className="flex-1 truncate">{org.name}</span>
                      {org.id === activeOrganizationId && (
                        <CheckIcon className="size-4 text-signal-ink" />
                      )}
                    </button>
                  ))}
                  <div className="my-1 border-t border-rule" />
                  <Link href="/organization" onClick={close} className={cx(menuItem, 'text-muted')}>
                    <UsersIcon />
                    Members and invitations
                  </Link>
                  <Link href="/onboarding" onClick={close} className={cx(menuItem, 'text-muted')}>
                    <PlusIcon />
                    New organization
                  </Link>
                </>
              )}
            </Menu>

            <Separator />

            <Menu
              label={
                project ? (
                  <span className="max-w-32 truncate font-mono whitespace-nowrap sm:max-w-48">
                    {project.key}
                  </span>
                ) : (
                  <span className="text-muted">Projects</span>
                )
              }
            >
              {(close) => (
                <>
                  <MenuHeading>Projects</MenuHeading>
                  {projects.map((p) => (
                    <Link
                      key={p.id}
                      href={`/projects/${p.key}`}
                      onClick={close}
                      className={menuItem}
                    >
                      <span className="flex-1 truncate">{p.name}</span>
                      <span className="font-mono text-xs text-faint">{p.key}</span>
                      {p.key === projectKey && <CheckIcon className="size-4 text-signal-ink" />}
                    </Link>
                  ))}
                  {projects.length === 0 && (
                    <p className="px-3 py-1.5 text-muted">No projects yet.</p>
                  )}
                  <div className="my-1 border-t border-rule" />
                  <Link href="/projects" onClick={close} className={cx(menuItem, 'text-muted')}>
                    All projects
                  </Link>
                  <div className="px-1.5 pt-1 pb-0.5">
                    <CreateProjectButton variant="ghost" />
                  </div>
                </>
              )}
            </Menu>

            {base && (
              // On phones the sections drop to their own row below the path.
              <nav className="order-last -mx-3 flex w-full border-t border-rule px-1 sm:order-none sm:mx-0 sm:ml-3 sm:w-auto sm:border-0 sm:px-0">
                <SectionLink
                  href={base}
                  active={pathname === base || pathname.startsWith(`${base}/flags`)}
                >
                  Flags
                </SectionLink>
                <SectionLink
                  href={`${base}/settings`}
                  active={pathname.startsWith(`${base}/settings`)}
                >
                  Settings
                </SectionLink>
              </nav>
            )}

            <div className="ml-auto flex shrink-0 items-center">
              <SectionLink href="/audit" active={pathname.startsWith('/audit')}>
                Audit<span className="hidden sm:inline">&nbsp;log</span>
              </SectionLink>
              <Menu
                align="right"
                label={
                  <span className="grid size-7 place-items-center rounded-full bg-ink font-mono text-paper text-[11px] font-semibold">
                    {initials(user.name)}
                  </span>
                }
              >
                {() => (
                  <>
                    <div className="border-b border-rule px-3 pt-1.5 pb-2">
                      <div className="font-medium">{user.name}</div>
                      <div className="font-mono text-[11px] text-muted">{user.email}</div>
                    </div>
                    <button
                      type="button"
                      className={cx(menuItem, 'mt-1')}
                      onClick={async () => {
                        await authRequest('/sign-out');
                        router.push('/sign-in');
                        router.refresh();
                      }}
                    >
                      <LogOutIcon />
                      Sign out
                    </button>
                  </>
                )}
              </Menu>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-10 sm:px-8">{children}</main>
      </ConfirmProvider>
    </>
  );
}
