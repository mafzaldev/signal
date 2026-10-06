import Link from 'next/link';
import { AuthCard } from '@/components/auth-card';
import { listOrganizations, requireSession } from '@/lib/session';
import { setActiveOrganization } from '../(dashboard)/actions';
import { CreateOrganizationForm } from './create-organization-form';

export default async function OnboardingPage() {
  const [{ user, session }, organizations] = await Promise.all([
    requireSession(),
    listOrganizations(),
  ]);
  const first = organizations.length === 0;
  const backClass = 'font-medium text-ink hover:underline';

  return (
    <AuthCard
      title={first ? `Welcome, ${user.name}` : 'New organization'}
      description="An organization holds your team’s projects, flags and members."
      footer={
        first ? null : session.activeOrganizationId ? (
          <Link href="/projects" className={backClass}>
            Back to the dashboard
          </Link>
        ) : (
          // Without an active organization the dashboard would send them straight back here.
          <form action={setActiveOrganization.bind(null, organizations[0]!.id)}>
            <button type="submit" className={backClass}>
              Back to the dashboard
            </button>
          </form>
        )
      }
    >
      <CreateOrganizationForm />
    </AuthCard>
  );
}
