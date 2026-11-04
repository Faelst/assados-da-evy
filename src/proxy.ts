import { NextResponse, type NextRequest } from "next/server";
import { readSession, SESSION_COOKIE } from "@/server/session-token";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/admin/login")) return NextResponse.next();
  const session = await readSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL("/admin/login", request.url);
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
