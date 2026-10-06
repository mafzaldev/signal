import { AuthForm } from '../auth-form';

export default async function SignUpPage({ searchParams }: PageProps<'/sign-up'>) {
  const { next } = await searchParams;
  return <AuthForm mode="sign-up" next={typeof next === 'string' ? next : undefined} />;
}
