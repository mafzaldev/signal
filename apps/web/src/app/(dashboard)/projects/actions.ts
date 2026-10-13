'use server';

import type { Variation } from '@signal/core';
import type { FlagKind, UpdateFlagConfigInput } from '@signal/core/schemas';
import { refresh, revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { type ActionResult, api, ApiError, toActionResult } from '@/lib/api';
import { parseVariations } from '@/lib/targeting';

const json = (body: unknown) => JSON.stringify(body);
const text = (form: FormData, name: string) => String(form.get(name) ?? '').trim();

/** Redirects after a change the sidebar or lists show; a plain redirect keeps them stale. */
function redirectFresh(path: string): never {
  revalidatePath('/', 'layout');
  redirect(path);
}

/** Boolean flags always use `[true, false]`, so only other kinds send variations. */
function formVariations(
  kind: FlagKind,
  form: FormData,
): { variations?: Variation[]; error?: string } {
  if (kind === 'boolean') return { variations: undefined };
  return parseVariations(kind, text(form, 'variations'));
}

export async function createProject(_: ActionResult, form: FormData): Promise<ActionResult> {
  const key = text(form, 'key');
  const result = await toActionResult(() =>
    api('/projects', { method: 'POST', body: json({ key, name: text(form, 'name') }) }),
  );
  if (result?.error) return result;
  redirectFresh(`/projects/${key}`);
}

export async function renameProject(
  projectKey: string,
  _: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const result = await toActionResult(() =>
    api(`/projects/${projectKey}`, { method: 'PATCH', body: json({ name: text(form, 'name') }) }),
  );
  refresh();
  return result;
}

export async function deleteProject(projectKey: string) {
  await api(`/projects/${projectKey}`, { method: 'DELETE' });
  redirectFresh('/projects');
}

export async function createEnvironment(
  projectKey: string,
  _: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const result = await toActionResult(() =>
    api(`/projects/${projectKey}/environments`, {
      method: 'POST',
      body: json({ key: text(form, 'key'), name: text(form, 'name') }),
    }),
  );
  refresh();
  return result;
}

export async function deleteEnvironment(projectKey: string, environmentKey: string) {
  await api(`/projects/${projectKey}/environments/${environmentKey}`, { method: 'DELETE' });
  refresh();
}

export async function createFlag(
  projectKey: string,
  _: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const kind = text(form, 'kind') as FlagKind;
  const key = text(form, 'key');
  const { variations, error } = formVariations(kind, form);
  if (error) return { error };
  const result = await toActionResult(() =>
    api(`/projects/${projectKey}/flags`, {
      method: 'POST',
      body: json({
        key,
        name: text(form, 'name'),
        description: text(form, 'description'),
        kind,
        variations,
      }),
    }),
  );
  if (result?.error) return result;
  redirectFresh(`/projects/${projectKey}/flags/${key}`);
}

export async function updateFlag(
  projectKey: string,
  flagKey: string,
  kind: FlagKind,
  _: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const { variations, error } = formVariations(kind, form);
  if (error) return { error };
  const result = await toActionResult(() =>
    api(`/projects/${projectKey}/flags/${flagKey}`, {
      method: 'PATCH',
      body: json({ name: text(form, 'name'), description: text(form, 'description'), variations }),
    }),
  );
  refresh();
  return result;
}

/** Lets browser SDKs (client keys) evaluate the flag, or stops them. */
export async function setFlagClientSide(
  projectKey: string,
  flagKey: string,
  clientSide: boolean,
): Promise<ActionResult> {
  const result = await toActionResult(() =>
    api(`/projects/${projectKey}/flags/${flagKey}`, {
      method: 'PATCH',
      body: json({ clientSide }),
    }),
  );
  refresh();
  return result;
}

export async function deleteFlag(projectKey: string, flagKey: string) {
  await api(`/projects/${projectKey}/flags/${flagKey}`, { method: 'DELETE' });
  redirectFresh(`/projects/${projectKey}`);
}

export async function updateFlagConfig(
  projectKey: string,
  flagKey: string,
  environmentKey: string,
  input: UpdateFlagConfigInput,
): Promise<ActionResult> {
  const result = await toActionResult(() =>
    api(`/projects/${projectKey}/flags/${flagKey}/environments/${environmentKey}`, {
      method: 'PATCH',
      body: json(input),
    }),
  );
  refresh();
  return result;
}

export type CreateSdkKeyResult = { error?: string; ok?: boolean; key?: string } | undefined;

/** Returns the full key, which the API only reveals once. */
export async function createSdkKey(
  projectKey: string,
  environmentKey: string,
  _: CreateSdkKeyResult,
  form: FormData,
): Promise<CreateSdkKeyResult> {
  try {
    const created = await api<{ key: string }>(
      `/projects/${projectKey}/environments/${environmentKey}/sdk-keys`,
      { method: 'POST', body: json({ name: text(form, 'name'), kind: text(form, 'kind') }) },
    );
    refresh();
    return { ok: true, key: created.key };
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
}

export async function revokeSdkKey(projectKey: string, environmentKey: string, id: string) {
  await api(`/projects/${projectKey}/environments/${environmentKey}/sdk-keys/${id}`, {
    method: 'DELETE',
  });
  refresh();
}
