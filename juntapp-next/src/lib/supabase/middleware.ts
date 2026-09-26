import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Protected routes - redirect to login if not authenticated
  const protectedPaths = ['/inicio', '/socios', '/tesoreria', '/consultas', '/votaciones', '/comunicaciones', '/mi-pagina', '/registro/pago'];
  const isProtectedRoute = protectedPaths.some(path =>
    request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(`${path}/`)
  );
  const authPaths = ['/login', '/registro'];
  const isAuthRoute = authPaths.includes(request.nextUrl.pathname);
  if (!isProtectedRoute && !isAuthRoute) return supabaseResponse;

  let user = null;
  try {
    const result = await supabase.auth.getUser();
    if (result.error) {
      if (result.error.name === 'AuthSessionMissingError' || result.error.status === 401 || result.error.status === 403 || result.error.code === 'refresh_token_not_found') {
        return isProtectedRoute ? NextResponse.redirect(new URL('/login', request.url)) : supabaseResponse;
      }
      console.error('[proxy] Authentication unavailable', { route: request.nextUrl.pathname, code: result.error.code });
      return supabaseResponse;
    }
    user = result.data.user;
  } catch (error) {
    console.error('[proxy] Authentication unavailable', { route: request.nextUrl.pathname, error });
    return supabaseResponse;
  }

  function redirectWithCookies(destination: string) {
    const url = request.nextUrl.clone();
    url.pathname = destination;
    const response = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    return response;
  }

  if (isProtectedRoute && !user) {
    return redirectWithCookies('/login');
  }

  // Redirect logged-in users away from auth pages
  if (isAuthRoute && user) {
    return redirectWithCookies('/inicio');
  }

  return supabaseResponse;
}
