import { createClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/';
  const mode = requestUrl.searchParams.get('mode') ?? 'login';
  const origin = requestUrl.origin;

  // Validate the next parameter to prevent open redirects
  const isValidNext = next.startsWith('/') && !next.startsWith('//');

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Check if this is a new user (created within last 10 seconds)
      const createdAt = new Date(data.user.created_at);
      const now = new Date();
      const isNewUser = now.getTime() - createdAt.getTime() < 10000;

      // If trying to login but user is new, reject and redirect to signup
      if (mode === 'login' && isNewUser) {
        await supabase.auth.signOut();
        return NextResponse.redirect(
          `${origin}/login?error=no_account`
        );
      }

      return NextResponse.redirect(`${origin}${isValidNext ? next : '/'}`);
    }
  }

  // Return the user to an error page
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
