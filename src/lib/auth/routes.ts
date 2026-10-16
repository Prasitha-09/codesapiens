/** Routes that need a signed-in user. Pages also re-check on the server; this list drives proxy redirects. */
export const protectedPrefixes = ["/dashboard", "/tasks", "/submissions", "/wallet", "/profile", "/admin"] as const;

/** Auth pages a signed-in user doesn't need to see. */
export const authPages = ["/login", "/signup"] as const;

export const DEFAULT_LOGIN_REDIRECT = "/dashboard";

function matches(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isProtectedPath(pathname: string) {
  if (pathname === "/admin/login") return false;
  return protectedPrefixes.some((p) => matches(pathname, p));
}

export function isAuthPage(pathname: string) {
  return authPages.some((p) => matches(pathname, p));
}

/**
 * Only allow same-site relative redirects, so `?next=` can't send users to another
 * domain (open redirect). Falls back to the dashboard.
 */
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/")) return DEFAULT_LOGIN_REDIRECT;
  // Resolve exactly like a browser would (it strips tabs/newlines and treats `\` as `/`),
  // then require that the result stays on our own origin.
  const base = "http://codesapiens.invalid";
  let url: URL;
  try {
    url = new URL(next, base);
  } catch {
    return DEFAULT_LOGIN_REDIRECT;
  }
  if (url.origin !== base) return DEFAULT_LOGIN_REDIRECT;
  if (isAuthPage(url.pathname)) return DEFAULT_LOGIN_REDIRECT;
  return `${url.pathname}${url.search}${url.hash}`;
}
