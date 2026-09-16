import Link from 'next/link';
import { listOrganizations, requireOrgSession } from '@/lib/session';
import { NavLink, OrganizationSwitcher, SignOutButton } from './header-controls';

export default async function DashboardLayout({ children }: LayoutProps<'/'>) {
  const [{ user, organizationId }, organizations] = await Promise.all([
    requireOrgSession(),
    listOrganizations(),
  ]);

  return (
    <>
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3">
          <Link href="/projects" className="font-semibold">
            Feature Flags
          </Link>
          <OrganizationSwitcher organizations={organizations} activeId={organizationId} />
          <nav className="flex gap-1">
            <NavLink href="/projects">Projects</NavLink>
            <NavLink href="/audit">Audit log</NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-2 text-sm text-zinc-500">
            {user.email}
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </>
  );
}
