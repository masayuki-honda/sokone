import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createMockPrisma, type MockPrisma } from "@/__tests__/mock-prisma";

let mockPrisma: MockPrisma;
let mockSession: { user: { id: string; email: string } } | null = null;

vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return mockPrisma;
  },
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(() => Promise.resolve(mockSession)),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

const { DELETE } = await import("@/app/api/prices/[id]/route");

describe("DELETE /api/prices/[id]", () => {
  beforeEach(() => {
    mockPrisma = createMockPrisma();
    mockSession = null;
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockSession = null;
    const request = new NextRequest("http://localhost/api/prices/p1", {
      method: "DELETE",
    });
    const response = await DELETE(request, {
      params: Promise.resolve({ id: "p1" }),
    });
    expect(response.status).toBe(401);
  });

  it("returns 404 when record not found or not owned", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    mockPrisma.priceRecord.findFirst.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/prices/p1", {
      method: "DELETE",
    });
    const response = await DELETE(request, {
      params: Promise.resolve({ id: "p1" }),
    });
    expect(response.status).toBe(404);
    expect(mockPrisma.priceRecord.findFirst).toHaveBeenCalledWith({
      where: { id: "p1", userId: "user-1" },
      select: { id: true, productId: true },
    });
  });

  it("deletes price record and returns productId", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    mockPrisma.priceRecord.findFirst.mockResolvedValue({
      id: "p1",
      productId: "prod-1",
    });
    mockPrisma.priceRecord.delete.mockResolvedValue({});

    const request = new NextRequest("http://localhost/api/prices/p1", {
      method: "DELETE",
    });
    const response = await DELETE(request, {
      params: Promise.resolve({ id: "p1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe("価格記録を削除しました");
    expect(body.productId).toBe("prod-1");
    expect(mockPrisma.priceRecord.delete).toHaveBeenCalledWith({
      where: { id: "p1" },
    });
  });
});
