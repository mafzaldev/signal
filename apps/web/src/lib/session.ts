import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { api } from './api';
import type { Organization, SessionData } from './types';

/** The signed-in user, or a redirect to sign-in. Deduplicated per request. */
export const requireSession = cache(async () => {
  const session = await api<SessionData | null>('/api/auth/get-session');
  if (!session) redirect('/sign-in');
  return session;
});

/** Also requires an active organization; sends users without one to onboarding. */
export const requireOrgSession = cache(async () => {
  const session = await requireSession();
  const organizationId = session.session.activeOrganizationId;
  if (!organizationId) redirect('/onboarding');
  return { ...session, organizationId };
});

export const listOrganizations = cache(() => api<Organization[]>('/api/auth/organization/list'));
