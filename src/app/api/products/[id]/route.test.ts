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

const { GET, PATCH } = await import("@/app/api/products/[id]/route");

describe("GET /api/products/[id]", () => {
  beforeEach(() => {
    mockPrisma = createMockPrisma();
    mockSession = null;
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockSession = null;
    const request = new NextRequest("http://localhost/api/products/p1");
    const response = await GET(request, {
      params: Promise.resolve({ id: "p1" }),
    });
    expect(response.status).toBe(401);
  });

  it("returns 404 when product not found", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    mockPrisma.product.findUnique.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/products/p1");
    const response = await GET(request, {
      params: Promise.resolve({ id: "p1" }),
    });
    expect(response.status).toBe(404);
  });

  it("returns product details with stats", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    const recordedAt = new Date("2025-01-15");
    mockPrisma.product.findUnique.mockResolvedValue({
      id: "p1",
      name: "りんご",
      normalizedName: "りんご",
      category: { id: "cat-1", name: "果物" },
      aliases: [],
      priceRecords: [
        {
          price: 200,
          recordedAt,
          store: { id: "s1", name: "A店" },
        },
        {
          price: 150,
          recordedAt: new Date("2025-01-10"),
          store: { id: "s2", name: "B店" },
        },
      ],
      _count: { priceRecords: 2, favoriteProducts: 1 },
    });
    mockPrisma.favoriteProduct.findUnique.mockResolvedValue({
      userId: "user-1",
      productId: "p1",
    });

    const request = new NextRequest("http://localhost/api/products/p1");
    const response = await GET(request, {
      params: Promise.resolve({ id: "p1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.name).toBe("りんご");
    expect(body.stats.bottomPrice).toBe(150);
    expect(body.stats.averagePrice).toBe(175);
    expect(body.stats.latestPrice).toBe(200);
    expect(body.isFavorite).toBe(true);
  });

  it("returns null stats when no price records", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    mockPrisma.product.findUnique.mockResolvedValue({
      id: "p1",
      name: "りんご",
      priceRecords: [],
      aliases: [],
      category: null,
      _count: { priceRecords: 0, favoriteProducts: 0 },
    });
    mockPrisma.favoriteProduct.findUnique.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/products/p1");
    const response = await GET(request, {
      params: Promise.resolve({ id: "p1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.stats).toBeNull();
    expect(body.isFavorite).toBe(false);
  });
});

describe("PATCH /api/products/[id]", () => {
  beforeEach(() => {
    mockPrisma = createMockPrisma();
    mockSession = null;
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockSession = null;
    const request = new NextRequest("http://localhost/api/products/p1", {
      method: "PATCH",
      body: JSON.stringify({ categoryId: "cat-1" }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await PATCH(request, {
      params: Promise.resolve({ id: "p1" }),
    });
    expect(response.status).toBe(401);
  });

  it("returns 404 when product not found", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    mockPrisma.product.findUnique.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/products/p1", {
      method: "PATCH",
      body: JSON.stringify({ categoryId: "cat-1" }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await PATCH(request, {
      params: Promise.resolve({ id: "p1" }),
    });
    expect(response.status).toBe(404);
  });

  it("returns 400 when category not found", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    mockPrisma.product.findUnique.mockResolvedValue({
      id: "p1",
      name: "りんご",
    });
    mockPrisma.productCategory.findUnique.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/products/p1", {
      method: "PATCH",
      body: JSON.stringify({ categoryId: "cat-999" }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await PATCH(request, {
      params: Promise.resolve({ id: "p1" }),
    });
    expect(response.status).toBe(400);
  });

  it("updates product category successfully", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    mockPrisma.product.findUnique.mockResolvedValue({
      id: "p1",
      name: "りんご",
    });
    mockPrisma.productCategory.findUnique.mockResolvedValue({
      id: "cat-1",
      name: "果物",
    });
    mockPrisma.product.update.mockResolvedValue({
      id: "p1",
      name: "りんご",
      categoryId: "cat-1",
      category: { id: "cat-1", name: "果物" },
    });

    const request = new NextRequest("http://localhost/api/products/p1", {
      method: "PATCH",
      body: JSON.stringify({ categoryId: "cat-1" }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await PATCH(request, {
      params: Promise.resolve({ id: "p1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.categoryId).toBe("cat-1");
    expect(body.category.name).toBe("果物");
  });
});
