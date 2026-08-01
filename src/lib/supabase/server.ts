import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  const persistSession = cookieStore.get('validgate-session-persistence')?.value === 'persistent';

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              if (persistSession) {
                cookieStore.set(name, value, options);
                return;
              }

              const { maxAge: _maxAge, expires: _expires, ...sessionOptions } = options;
              cookieStore.set(name, value, sessionOptions);
            });
          } catch {
            // No-op when called from a Server Component during render.
          }
        },
      },
    },
  );
}
