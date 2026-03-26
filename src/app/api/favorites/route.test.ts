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

const { GET, POST } = await import("@/app/api/favorites/route");

describe("GET /api/favorites", () => {
  beforeEach(() => {
    mockPrisma = createMockPrisma();
    mockSession = null;
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockSession = null;
    const request = new NextRequest("http://localhost/api/favorites");
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it("returns empty favorites list", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    mockPrisma.favoriteProduct.findMany.mockResolvedValue([]);

    const request = new NextRequest("http://localhost/api/favorites");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.favorites).toEqual([]);
  });

  it("returns favorites with price stats", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    mockPrisma.favoriteProduct.findMany.mockResolvedValue([
      {
        id: "fav-1",
        productId: "prod-1",
        displayOrder: 1,
        createdAt: new Date(),
        product: {
          name: "金麦 350ml",
          unit: "本",
          category: { name: "酒類" },
          priceRecords: [
            {
              price: 128,
              recordedAt: new Date(),
              store: { id: "s1", name: "ストアA" },
            },
            {
              price: 98,
              recordedAt: new Date(Date.now() - 86400000),
              store: { id: "s2", name: "ストアB" },
            },
          ],
        },
      },
    ]);

    const request = new NextRequest("http://localhost/api/favorites");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.favorites).toHaveLength(1);
    expect(body.favorites[0].productName).toBe("金麦 350ml");
    expect(body.favorites[0].stats.bottomPrice).toBe(98);
    expect(body.favorites[0].stats.latestPrice).toBe(128);
    expect(body.favorites[0].stats.recordCount).toBe(2);
  });
});

describe("POST /api/favorites", () => {
  beforeEach(() => {
    mockPrisma = createMockPrisma();
    mockSession = null;
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockSession = null;
    const request = new NextRequest("http://localhost/api/favorites", {
      method: "POST",
      body: JSON.stringify({ productId: "prod-1" }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns 400 when productId is missing", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    const request = new NextRequest("http://localhost/api/favorites", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 404 when product not found", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    mockPrisma.product.findUnique.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/favorites", {
      method: "POST",
      body: JSON.stringify({ productId: "nonexistent" }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(request);
    expect(response.status).toBe(404);
  });

  it("returns 409 when already favorited", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    mockPrisma.product.findUnique.mockResolvedValue({ id: "prod-1" });
    mockPrisma.favoriteProduct.findUnique.mockResolvedValue({
      id: "fav-existing",
    });

    const request = new NextRequest("http://localhost/api/favorites", {
      method: "POST",
      body: JSON.stringify({ productId: "prod-1" }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(request);
    expect(response.status).toBe(409);
  });

  it("creates favorite successfully", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    mockPrisma.product.findUnique.mockResolvedValue({ id: "prod-1" });
    mockPrisma.favoriteProduct.findUnique.mockResolvedValue(null);
    mockPrisma.favoriteProduct.findFirst.mockResolvedValue({
      displayOrder: 3,
    });
    mockPrisma.favoriteProduct.create.mockResolvedValue({
      id: "fav-new",
      userId: "user-1",
      productId: "prod-1",
      displayOrder: 4,
      createdAt: new Date(),
    });

    const request = new NextRequest("http://localhost/api/favorites", {
      method: "POST",
      body: JSON.stringify({ productId: "prod-1" }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.productId).toBe("prod-1");
    expect(body.displayOrder).toBe(4);
  });
});
