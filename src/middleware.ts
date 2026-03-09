import { NextRequest, NextResponse } from "next/server";

const ALLOWED_ORIGINS = [
  process.env.NEXTAUTH_URL ?? "http://localhost:3000",
  "https://sokone-sigma.vercel.app",
].filter(Boolean);

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";
  const isAllowed = ALLOWED_ORIGINS.includes(origin);

  // Handle CORS preflight
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

export const config = {
  matcher: "/api/:path*",
};
