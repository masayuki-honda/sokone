import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Neon Free tier storage limit: 0.5 GB
const LIMIT_BYTES = 512 * 1024 * 1024; // 512 MB = 0.5 GB

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Query current database size via Postgres built-in function
    const result = await prisma.$queryRaw<[{ size_bytes: bigint }]>`
      SELECT pg_database_size(current_database()) AS size_bytes
    `;

    const usedBytes = Number(result[0].size_bytes);
    const usedMB = usedBytes / 1024 / 1024;
    const limitMB = LIMIT_BYTES / 1024 / 1024;
    const usagePercent = Math.round((usedBytes / LIMIT_BYTES) * 100);

    return NextResponse.json({
      usedBytes,
      usedMB: Math.round(usedMB * 10) / 10,
      limitMB: Math.round(limitMB),
      usagePercent,
      status:
        usagePercent >= 90
          ? "critical"
          : usagePercent >= 80
            ? "warning"
            : "ok",
    });
  } catch (error) {
    console.error("Failed to fetch DB storage:", error);
    return NextResponse.json(
      { error: "DBストレージ情報の取得に失敗しました" },
      { status: 500 },
    );
  }
}
