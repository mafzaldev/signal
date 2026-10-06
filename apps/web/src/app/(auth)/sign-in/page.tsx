import { AuthForm } from '../auth-form';

export default async function SignInPage({ searchParams }: PageProps<'/sign-in'>) {
  const { next } = await searchParams;
  return <AuthForm mode="sign-in" next={typeof next === 'string' ? next : undefined} />;
}
