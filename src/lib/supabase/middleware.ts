import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_ROUTES = new Set(['/', '/register']);

export async function updateSession(request: NextRequest) {
  const persistSession =
    request.cookies.get('validgate-session-persistence')?.value === 'persistent';
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            if (persistSession) {
              response.cookies.set(name, value, options);
              return;
            }

            const { maxAge: _maxAge, expires: _expires, ...sessionOptions } = options;
            response.cookies.set(name, value, sessionOptions);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!persistSession) {
    request.cookies
      .getAll()
      .filter(({ name }) => name.startsWith('sb-') && name.includes('-auth-token'))
      .forEach(({ name, value }) => {
        if (!response.cookies.has(name)) {
          response.cookies.set(name, value, {
            path: '/',
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
          });
        }
      });
  }

  const isValidAuthCallback =
    request.nextUrl.pathname === '/auth/callback' && request.nextUrl.searchParams.has('code');

  if (!user && !PUBLIC_ROUTES.has(request.nextUrl.pathname) && !isValidAuthCallback) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/';
    loginUrl.search = '';

    const redirectResponse = NextResponse.redirect(loginUrl);

    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });

    return redirectResponse;
  }

  return response;
}
