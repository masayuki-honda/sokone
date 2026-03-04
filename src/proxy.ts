import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function proxy(request: NextRequest) {
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
    "/dashboard/:path*",
    "/stores/:path*",
    "/upload/:path*",
    "/products/:path*",
    "/api/stores/:path*",
    "/api/images/:path*",
    "/api/prices/:path*",
    "/api/products/:path*",
    "/api/categories/:path*",
    "/api/dashboard/:path*",
    "/api/favorites/:path*",
  ],
};
