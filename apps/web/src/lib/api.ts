import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { SessionData } from './types';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function messageFrom(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const { message, issues } = body as {
      message?: unknown;
      issues?: { path: string[]; message: string }[];
    };
    if (issues?.length) {
      return issues
        .map((i) => (i.path.length ? `${i.path.join('.')}: ` : '') + i.message)
        .join('; ');
    }
    if (typeof message === 'string') return message;
  }
  return `Request failed (${status})`;
}

/**
 * Calls the NestJS API from the server, forwarding the browser's session cookie.
 * Redirects to sign-in when the session is missing or expired.
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const incoming = await headers();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      cookie: incoming.get('cookie') ?? '',
      // Better Auth checks the origin of state-changing requests.
      origin: incoming.get('origin') ?? `http://${incoming.get('host')}`,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  if (res.status === 401) redirect('/sign-in');
  if (res.status === 403 && !path.startsWith('/api/auth')) {
    // A 403 without an active organization (none chosen yet, or it was deleted) means
    // onboarding; with one, it's a real permission error and is thrown below.
    const session = await api<SessionData | null>('/api/auth/get-session');
    if (!session?.session.activeOrganizationId) redirect('/onboarding');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, messageFrom(body, res.status));
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Result shape for Server Actions used with `useActionState`. */
export type ActionResult = { error?: string; ok?: boolean } | undefined;

/** Turns API errors into a form message; anything else is rethrown. */
export async function toActionResult(run: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await run();
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
}
