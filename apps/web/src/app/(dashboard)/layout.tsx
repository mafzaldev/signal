import { api } from '@/lib/api';
import { listOrganizations, requireOrgSession } from '@/lib/session';
import type { Project } from '@/lib/types';
import { AppShell } from './app-shell';

export default async function DashboardLayout({ children }: LayoutProps<'/'>) {
  const [{ user, organizationId }, organizations, projects] = await Promise.all([
    requireOrgSession(),
    listOrganizations(),
    api<Project[]>('/projects'),
  ]);

  return (
    <AppShell
      user={user}
      organizations={organizations}
      activeOrganizationId={organizationId}
      projects={projects}
    >
      {children}
    </AppShell>
  );
}
