import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { adminSetupProblem, getAdminSession } from '@/lib/auth';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage() {
  const session = await getAdminSession();
  if (session) redirect('/admin');

  const problem = adminSetupProblem();

  return (
    <div className="animate-rise mx-auto max-w-sm pt-10">
      <h1 className="display text-4xl uppercase leading-none text-chalk">Organiser sign in</h1>
      <p className="mt-2.5 text-sm leading-relaxed text-muted">
        This is where results are entered. Everyone else just reads the site — there is nothing
        here for them.
      </p>

      {problem ? (
        <p className="mt-5 rounded-xl border border-yellow-card/50 bg-yellow-card/10 px-3.5 py-3 text-xs leading-relaxed text-yellow-card">
          {problem}
        </p>
      ) : (
        <LoginForm />
      )}
    </div>
  );
}
