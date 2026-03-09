import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runScrapingPipeline } from "@/lib/scraping-pipeline";

// Full pipeline can take several minutes
export const maxDuration = 300;

/**
 * POST /api/stores/[id]/pipeline — Run full scrape → OCR → register pipeline
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const store = await prisma.store.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!store) {
    return NextResponse.json({ error: "店舗が見つかりません" }, { status: 404 });
  }

  if (!store.tokubaiShopUrl) {
    return NextResponse.json(
      { error: "tokubai URL が設定されていません" },
      { status: 400 }
    );
  }

  // Check for running jobs on this store
  const runningJob = await prisma.scrapingJob.findFirst({
    where: { storeId: id, status: "running" },
  });

  if (runningJob) {
    return NextResponse.json(
      { error: "この店舗のパイプラインは実行中です", jobId: runningJob.id },
      { status: 409 }
    );
  }

  const result = await runScrapingPipeline(id, session.user.id);

  return NextResponse.json(result, { status: 201 });
}

/**
 * GET /api/stores/[id]/pipeline — Get pipeline job history
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const jobs = await prisma.scrapingJob.findMany({
    where: { storeId: id, userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json(jobs);
}
