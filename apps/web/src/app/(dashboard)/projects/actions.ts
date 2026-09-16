'use server';

import type { Variation } from '@feature-flags/core';
import type { FlagKind, UpdateFlagConfigInput } from '@feature-flags/core/schemas';
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { type ActionResult, api, toActionResult } from '@/lib/api';
import { parseVariations } from '@/lib/targeting';

const json = (body: unknown) => JSON.stringify(body);
const text = (form: FormData, name: string) => String(form.get(name) ?? '').trim();

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
  redirect(`/projects/${key}`);
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
  redirect('/projects');
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
  redirect(`/projects/${projectKey}/flags/${key}`);
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

export async function deleteFlag(projectKey: string, flagKey: string) {
  await api(`/projects/${projectKey}/flags/${flagKey}`, { method: 'DELETE' });
  redirect(`/projects/${projectKey}`);
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
