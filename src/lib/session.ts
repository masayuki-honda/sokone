import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface MobileSession {
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

/**
 * Get session from either NextAuth (web) or Bearer token (mobile).
 * This enables both the web app and mobile app to use the same API.
 */
export async function getSession(): Promise<MobileSession | null> {
  // Try NextAuth session first (web)
  const nextAuthSession = await getServerSession(authOptions);
  if (nextAuthSession?.user?.id) {
    return nextAuthSession as MobileSession;
  }

  // Try Bearer token (mobile)
  const headersList = await headers();
  const authorization = headersList.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice(7);
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { sessionToken: token },
    include: {
      user: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
  });

  if (!session || session.expires < new Date()) {
    return null;
  }

  return {
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email ?? "",
      image: session.user.image,
    },
  };
}
