import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keywords = await prisma.watchKeyword.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, keyword: true, createdAt: true },
  });

  return NextResponse.json({ keywords });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const keyword = typeof body.keyword === "string" ? body.keyword.trim() : "";

  if (!keyword) {
    return NextResponse.json({ error: "キーワードを入力してください" }, { status: 400 });
  }
  if (keyword.length > 50) {
    return NextResponse.json({ error: "キーワードは50文字以内で入力してください" }, { status: 400 });
  }

  try {
    const created = await prisma.watchKeyword.create({
      data: { userId: session.user.id, keyword },
      select: { id: true, keyword: true, createdAt: true },
    });
    return NextResponse.json({ keyword: created }, { status: 201 });
  } catch (error: unknown) {
    // Unique constraint: duplicate keyword
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      return NextResponse.json(
        { error: "そのキーワードはすでに登録されています" },
        { status: 409 },
      );
    }
    throw error;
  }
}
