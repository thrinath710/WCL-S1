'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ADMIN_EMAIL_HINT } from '@/lib/env';
import { Field, TextInput } from '@/components/admin/form';

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError('Supabase is not configured on this deployment.');
      setPending(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: String(form.get('email') ?? '').trim(),
      password: String(form.get('password') ?? ''),
    });

    if (signInError) {
      setError(signInError.message);
      setPending(false);
      return;
    }

    // The session cookie is set; let the server re-check the allowlist.
    router.replace('/admin');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="glass mt-6 space-y-3.5 rounded-2xl border border-line p-4">
      <Field label="Email">
        <TextInput
          name="email"
          type="email"
          autoComplete="username"
          required
          placeholder="you@woxsen.edu.in"
          /*
           * Pre-filled but never locked. The hint is a convenience for the
           * organiser, who signs in far more often than anyone else -- but a
           * match host signs in at the same screen with a different address,
           * and a read-only field would leave them with no way to type it.
           */
          defaultValue={ADMIN_EMAIL_HINT ?? ''}
        />
      </Field>
      <Field label="Password">
        <TextInput
          name="password"
          type="password"
          autoComplete="current-password"
          required
          /* With an address already filled in, the password is usually the
             only thing left to type, so it takes focus on load. A host can
             still tab back and replace the address. */
          autoFocus={Boolean(ADMIN_EMAIL_HINT)}
        />
      </Field>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-card/50 bg-red-card/10 px-3 py-2 text-xs font-medium text-red-card"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="min-h-[3.25rem] w-full cursor-pointer rounded-xl bg-pitch text-base font-bold text-ink shadow-[0_0_24px_var(--color-pitch-glow)] transition-all duration-200 hover:bg-pitch-bright disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
