'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';

export async function setActiveOrganization(organizationId: string) {
  await api('/api/auth/organization/set-active', {
    method: 'POST',
    body: JSON.stringify({ organizationId }),
  });
  // Everything on screen (sidebar included) belongs to the old organization.
  revalidatePath('/', 'layout');
  redirect('/projects');
}
