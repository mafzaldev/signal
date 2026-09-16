/**
 * Browser calls to Better Auth. They go through the dashboard's `/api/auth`
 * rewrite, so the session cookie is set on this origin.
 */
export async function authRequest(path: string, body?: unknown): Promise<{ error?: string }> {
  const res = await fetch(`/api/auth${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  if (res.ok) return {};
  const data = (await res.json().catch(() => null)) as { message?: string } | null;
  return { error: data?.message ?? `Request failed (${res.status})` };
}
