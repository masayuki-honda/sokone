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

const { GET } = await import("@/app/api/products/route");

describe("GET /api/products", () => {
  beforeEach(() => {
    mockPrisma = createMockPrisma();
    mockSession = null;
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockSession = null;
    const request = new NextRequest("http://localhost/api/products");
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it("returns product list", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: "prod-1",
        name: "りんご",
        normalizedName: "りんご",
        category: { id: "cat-1", name: "果物" },
        _count: { priceRecords: 5 },
      },
    ]);

    const request = new NextRequest("http://localhost/api/products");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.products).toHaveLength(1);
    expect(body.products[0].name).toBe("りんご");
    expect(body.hasMore).toBe(false);
  });

  it("supports search query", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    mockPrisma.product.findMany.mockResolvedValue([]);

    const request = new NextRequest("http://localhost/api/products?q=りんご");
    await GET(request);

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              name: expect.objectContaining({ contains: "りんご" }),
            }),
          ]),
        }),
      }),
    );
  });

  it("supports categoryId filter", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    mockPrisma.product.findMany.mockResolvedValue([]);

    const request = new NextRequest(
      "http://localhost/api/products?categoryId=cat-1",
    );
    await GET(request);

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ categoryId: "cat-1" }),
      }),
    );
  });

  it("handles pagination with hasMore", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    // Return 21 items (limit=20 default → hasMore=true)
    const products = Array.from({ length: 21 }, (_, i) => ({
      id: `prod-${i}`,
      name: `Product ${i}`,
      normalizedName: `product ${i}`,
      category: null,
      _count: { priceRecords: 0 },
    }));
    mockPrisma.product.findMany.mockResolvedValue(products);

    const request = new NextRequest("http://localhost/api/products");
    const response = await GET(request);
    const body = await response.json();

    expect(body.products).toHaveLength(20);
    expect(body.hasMore).toBe(true);
    expect(body.nextCursor).toBe("20"); // offset-based: next page starts at offset 20
  });
});
