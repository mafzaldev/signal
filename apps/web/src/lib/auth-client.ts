/**
 * Browser calls to Better Auth. They go through the dashboard's `/api/auth`
 * rewrite, so the session cookie is set on this origin.
 */
export async function authRequest<T = unknown>(
  path: string,
  body?: unknown,
): Promise<{ data?: T; error?: string; code?: string }> {
  const res = await fetch(`/api/auth${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const data = (await res.json().catch(() => null)) as
    (T & { message?: string; code?: string }) | null;
  if (res.ok) return { data: data ?? undefined };
  return { error: data?.message ?? `Request failed (${res.status})`, code: data?.code };
}
