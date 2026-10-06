'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { AuthCard } from '@/components/auth-card';
import { PasswordInput } from '@/components/password-input';
import { Button, ErrorMessage, Field, Input } from '@/components/ui';
import { authRequest } from '@/lib/auth-client';

/** Only same-site paths, so a crafted link can't send people elsewhere after signing in. */
function safeNext(next: string | undefined) {
  return next?.startsWith('/') && !next.startsWith('//') ? next : undefined;
}

export function AuthForm({ mode, next }: { mode: 'sign-in' | 'sign-up'; next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const signUp = mode === 'sign-up';
  const destination = safeNext(next);
  const keepNext = destination ? `?next=${encodeURIComponent(destination)}` : '';

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(undefined);
    const result = await authRequest(signUp ? '/sign-up/email' : '/sign-in/email', {
      name: form.get('name'),
      email: form.get('email'),
      password: form.get('password'),
    });
    setPending(false);
    if (result.error) return setError(result.error);
    router.push(destination ?? '/projects');
    router.refresh();
  }

  return (
    <AuthCard
      title={signUp ? 'Create your account' : 'Welcome back'}
      description={
        signUp ? 'Start managing feature flags for your team.' : 'Sign in to manage your flags.'
      }
      footer={
        <>
          {signUp ? 'Already have an account? ' : 'New here? '}
          <Link
            href={`${signUp ? '/sign-in' : '/sign-up'}${keepNext}`}
            className="font-medium text-ink hover:underline"
          >
            {signUp ? 'Sign in' : 'Create an account'}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {signUp && (
          <Field label="Name">
            <Input name="name" required autoComplete="name" autoFocus />
          </Field>
        )}
        <Field label="Email">
          <Input name="email" type="email" required autoComplete="email" autoFocus={!signUp} />
        </Field>
        <Field label="Password" hint={signUp ? 'At least 8 characters.' : undefined}>
          <PasswordInput
            name="password"
            required
            minLength={8}
            autoComplete={signUp ? 'new-password' : 'current-password'}
          />
        </Field>
        <ErrorMessage>{error}</ErrorMessage>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? 'Please wait…' : signUp ? 'Create account' : 'Sign in'}
        </Button>
      </form>
    </AuthCard>
  );
}
