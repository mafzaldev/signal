'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button, ErrorMessage, Field, Input } from '@/components/ui';
import { authRequest } from '@/lib/auth-client';

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(undefined);
    const result = await authRequest(mode === 'sign-in' ? '/sign-in/email' : '/sign-up/email', {
      name: form.get('name'),
      email: form.get('email'),
      password: form.get('password'),
    });
    setPending(false);
    if (result.error) return setError(result.error);
    router.push('/projects');
    router.refresh();
  }

  const signUp = mode === 'sign-up';
  return (
    <div className="mx-auto mt-24 w-full max-w-sm space-y-6 px-4">
      <h1 className="text-xl font-semibold">{signUp ? 'Create your account' : 'Sign in'}</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        {signUp && (
          <Field label="Name">
            <Input name="name" required autoComplete="name" />
          </Field>
        )}
        <Field label="Email">
          <Input name="email" type="email" required autoComplete="email" />
        </Field>
        <Field label="Password" hint={signUp ? 'At least 8 characters' : undefined}>
          <Input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={signUp ? 'new-password' : 'current-password'}
          />
        </Field>
        <ErrorMessage>{error}</ErrorMessage>
        <Button type="submit" disabled={pending} className="w-full">
          {signUp ? 'Create account' : 'Sign in'}
        </Button>
      </form>
      <p className="text-sm text-zinc-500">
        {signUp ? 'Already have an account? ' : 'New here? '}
        <Link
          href={signUp ? '/sign-in' : '/sign-up'}
          className="font-medium text-zinc-900 underline"
        >
          {signUp ? 'Sign in' : 'Create an account'}
        </Link>
      </p>
    </div>
  );
}
