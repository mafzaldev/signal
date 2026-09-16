'use server';

import { redirect } from 'next/navigation';
import { api } from '@/lib/api';

export async function setActiveOrganization(organizationId: string) {
  await api('/api/auth/organization/set-active', {
    method: 'POST',
    body: JSON.stringify({ organizationId }),
  });
  redirect('/projects');
}
