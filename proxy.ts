import { NextResponse, type NextRequest } from "next/server";
import { auth0 } from "./lib/auth0";

// Pages and APIs under /me need a signed-in user. The demo, the check-in link and the cron
// endpoint don't (the check-in link is signed, the cron call carries CRON_SECRET).
export async function proxy(request: NextRequest) {
  const authRes = await auth0.middleware(request);
  const url = new URL(request.url);
  const needsUser = url.pathname.startsWith("/me") || ["/api/me", "/api/ask", "/api/letters", "/api/handbook"].some((p) => url.pathname.startsWith(p));
  if (!needsUser) return authRes;

  const session = await auth0.getSession(request);
  if (session) return authRes;
  if (url.pathname.startsWith("/api/")) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const login = new URL("/auth/login", url.origin);
  login.searchParams.set("returnTo", url.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
