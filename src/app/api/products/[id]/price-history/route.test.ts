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

const { GET } = await import(
  "@/app/api/products/[id]/price-history/route"
);

describe("GET /api/products/[id]/price-history", () => {
  beforeEach(() => {
    mockPrisma = createMockPrisma();
    mockSession = null;
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockSession = null;
    const request = new NextRequest(
      "http://localhost/api/products/p1/price-history",
    );
    const response = await GET(request, {
      params: Promise.resolve({ id: "p1" }),
    });
    expect(response.status).toBe(401);
  });

  it("returns 404 when product not found", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    mockPrisma.product.findUnique.mockResolvedValue(null);

    const request = new NextRequest(
      "http://localhost/api/products/p1/price-history",
    );
    const response = await GET(request, {
      params: Promise.resolve({ id: "p1" }),
    });
    expect(response.status).toBe(404);
  });

  it("returns price history with stats and series", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    mockPrisma.product.findUnique.mockResolvedValue({
      id: "p1",
      name: "りんご",
      unit: "個",
    });
    mockPrisma.priceRecord.findMany.mockResolvedValue([
      {
        id: "pr-1",
        price: 100,
        storeId: "s1",
        recordedAt: new Date("2025-01-01"),
        store: { id: "s1", name: "A店" },
      },
      {
        id: "pr-2",
        price: 150,
        storeId: "s1",
        recordedAt: new Date("2025-01-15"),
        store: { id: "s1", name: "A店" },
      },
      {
        id: "pr-3",
        price: 120,
        storeId: "s2",
        recordedAt: new Date("2025-01-10"),
        store: { id: "s2", name: "B店" },
      },
    ]);

    const request = new NextRequest(
      "http://localhost/api/products/p1/price-history",
    );
    const response = await GET(request, {
      params: Promise.resolve({ id: "p1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.product.name).toBe("りんご");
    expect(body.stats.bottomPrice).toBe(100);
    expect(body.stats.highestPrice).toBe(150);
    expect(body.stats.averagePrice).toBe(123); // Math.round((100+150+120)/3)
    expect(body.stats.recordCount).toBe(3);
    expect(body.series).toHaveLength(2); // 2 stores
    expect(body.records).toHaveLength(3);
  });

  it("returns null stats when no records", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    mockPrisma.product.findUnique.mockResolvedValue({
      id: "p1",
      name: "りんご",
      unit: "個",
    });
    mockPrisma.priceRecord.findMany.mockResolvedValue([]);

    const request = new NextRequest(
      "http://localhost/api/products/p1/price-history",
    );
    const response = await GET(request, {
      params: Promise.resolve({ id: "p1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.stats).toBeNull();
    expect(body.series).toHaveLength(0);
    expect(body.records).toHaveLength(0);
  });

  it("applies period filter for 1m", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    mockPrisma.product.findUnique.mockResolvedValue({
      id: "p1",
      name: "りんご",
      unit: "個",
    });
    mockPrisma.priceRecord.findMany.mockResolvedValue([]);

    const request = new NextRequest(
      "http://localhost/api/products/p1/price-history?period=1m",
    );
    await GET(request, {
      params: Promise.resolve({ id: "p1" }),
    });

    // Verify the where clause includes a date filter
    const call = mockPrisma.priceRecord.findMany.mock.calls[0][0];
    expect(call.where.recordedAt).toBeDefined();
    expect(call.where.recordedAt.gte).toBeInstanceOf(Date);
  });

  it("applies storeId filter", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    mockPrisma.product.findUnique.mockResolvedValue({
      id: "p1",
      name: "りんご",
      unit: "個",
    });
    mockPrisma.priceRecord.findMany.mockResolvedValue([]);

    const request = new NextRequest(
      "http://localhost/api/products/p1/price-history?storeId=s1",
    );
    await GET(request, {
      params: Promise.resolve({ id: "p1" }),
    });

    const call = mockPrisma.priceRecord.findMany.mock.calls[0][0];
    expect(call.where.storeId).toBe("s1");
  });
});
