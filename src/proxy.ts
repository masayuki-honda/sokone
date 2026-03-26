import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const ALLOWED_ORIGINS = [
  process.env.NEXTAUTH_URL ?? "http://localhost:3000",
  "https://sokone-sigma.vercel.app",
].filter(Boolean);

export async function proxy(request: NextRequest) {
  const { pathname } = new URL(request.url);

  // CORS handling for API routes
  if (pathname.startsWith("/api/")) {
    const origin = request.headers.get("origin") ?? "";
    const isAllowed = ALLOWED_ORIGINS.includes(origin);

    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": isAllowed ? origin : "",
          "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const response = NextResponse.next();
    if (isAllowed) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }
    return response;
  }

  // Auth protection for page routes
  const token = await getToken({ req: request });

  if (!token) {
    const signInUrl = new URL("/auth/signin", request.url);
    signInUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Page routes requiring auth
    "/dashboard/:path*",
    "/stores/:path*",
    "/upload/:path*",
    "/products/:path*",
    // API routes requiring CORS headers
    "/api/:path*",
  ],
};
