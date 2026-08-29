import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Keeps the admin's Supabase session alive.
 *
 * Server Components cannot write cookies, so the refreshed auth token is
 * written here instead. This does NOT authorise anything -- every admin page
 * and every Server Action checks the session and the email allowlist itself.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Touching getUser() is what triggers the refresh.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Only the admin area needs a session; public pages skip this entirely.
  matcher: ['/admin/:path*'],
};
