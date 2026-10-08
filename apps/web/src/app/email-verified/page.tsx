import Link from 'next/link';
import { AuthCard } from '@/components/auth-card';
import { buttonClass } from '@/components/ui';

/** Only same-site paths, so a crafted link can't send people elsewhere. */
function safeNext(next: unknown) {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//')
    ? next
    : undefined;
}

/**
 * Where verification links land. Better Auth has already verified the address and signed
 * the person in, or added `?error=` when the link was invalid or expired.
 */
export default async function EmailVerifiedPage({ searchParams }: PageProps<'/email-verified'>) {
  const { error, next } = await searchParams;
  const destination = safeNext(next);

  if (error) {
    const keepNext = destination ? `?next=${encodeURIComponent(destination)}` : '';
    return (
      <AuthCard
        title="This link can’t be used"
        description="It has expired or was already used. Sign in and we’ll send you a new one."
      >
        <Link href={`/sign-in${keepNext}`} className={buttonClass('primary', 'md', 'w-full')}>
          Sign in
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Email verified" description="Your account is ready and you’re signed in.">
      <Link href={destination ?? '/projects'} className={buttonClass('primary', 'md', 'w-full')}>
        Continue
      </Link>
    </AuthCard>
  );
}
