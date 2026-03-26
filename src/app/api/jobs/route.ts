import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/jobs — List scraping jobs for the current user
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
  const status = searchParams.get("status") || undefined;

  const jobs = await prisma.scrapingJob.findMany({
    where: {
      userId: session.user.id,
      ...(status ? { status: status as "pending" | "running" | "completed" | "failed" } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      store: {
        select: { id: true, name: true },
      },
    },
  });

  return NextResponse.json(jobs);
}
