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

/** Shown once a verification email is on its way, with a way to send another. */
function CheckInbox({
  email,
  callbackURL,
  reason,
  onBack,
}: {
  email: string;
  callbackURL: string;
  reason: 'signed-up' | 'unverified';
  onBack: () => void;
}) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string>();

  async function resend() {
    setStatus('sending');
    setError(undefined);
    const result = await authRequest('/send-verification-email', { email, callbackURL });
    if (result.error) {
      setError(result.error);
      setStatus('idle');
    } else {
      setStatus('sent');
    }
  }

  return (
    <AuthCard
      title="Check your inbox"
      description={
        reason === 'signed-up'
          ? 'Your account is created. Verify your email to sign in.'
          : 'Verify your email before signing in. We’ve sent you a new link.'
      }
      footer={
        <button type="button" onClick={onBack} className="font-medium text-ink hover:underline">
          Use a different email
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-[13px] text-ink-2">
          We sent a link to <span className="font-mono text-ink">{email}</span>. Open it to verify
          your address and you’ll be signed in. It expires in an hour.
        </p>
        <ErrorMessage>{error}</ErrorMessage>
        <Button
          variant="secondary"
          className="w-full"
          disabled={status !== 'idle'}
          onClick={resend}
        >
          {status === 'sending' ? 'Sending…' : status === 'sent' ? 'Sent' : 'Resend the email'}
        </Button>
      </div>
    </AuthCard>
  );
}

export function AuthForm({ mode, next }: { mode: 'sign-in' | 'sign-up'; next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [waiting, setWaiting] = useState<{ email: string; reason: 'signed-up' | 'unverified' }>();
  const signUp = mode === 'sign-up';
  const destination = safeNext(next);
  const keepNext = destination ? `?next=${encodeURIComponent(destination)}` : '';
  // Where the emailed verification link lands, carrying on to `next` from there.
  const callbackURL = `/email-verified${keepNext}`;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email'));
    setPending(true);
    setError(undefined);
    const result = await authRequest<{ token: string | null }>(
      signUp ? '/sign-up/email' : '/sign-in/email',
      { name: form.get('name'), email, password: form.get('password'), callbackURL },
    );
    setPending(false);

    // With email verification on, sign-up creates the account without signing in, and
    // sign-in refuses unverified accounts (sending them a fresh link).
    if (result.code === 'EMAIL_NOT_VERIFIED') return setWaiting({ email, reason: 'unverified' });
    if (result.error) return setError(result.error);
    if (signUp && !result.data?.token) return setWaiting({ email, reason: 'signed-up' });

    router.push(destination ?? '/projects');
    router.refresh();
  }

  if (waiting) {
    return (
      <CheckInbox
        email={waiting.email}
        reason={waiting.reason}
        callbackURL={callbackURL}
        onBack={() => setWaiting(undefined)}
      />
    );
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
