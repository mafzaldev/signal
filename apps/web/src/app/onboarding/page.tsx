import { requireSession } from '@/lib/session';
import { CreateOrganizationForm } from './create-organization-form';

export default async function OnboardingPage() {
  const { user } = await requireSession();
  return (
    <div className="mx-auto mt-24 w-full max-w-sm space-y-6 px-4">
      <div>
        <h1 className="text-xl font-semibold">Welcome, {user.name}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Create an organization to hold your projects and flags.
        </p>
      </div>
      <CreateOrganizationForm />
    </div>
  );
}
