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

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(() => Promise.resolve(mockSession)),
}));

vi.mock("@/lib/product-matcher", () => ({
  findOrCreateProduct: vi.fn(),
  normalizeProductName: vi.fn((name: string) => name.toLowerCase()),
}));

vi.mock("@/lib/notification", () => ({
  createNotification: vi.fn(() => Promise.resolve()),
}));

const { POST, GET } = await import("@/app/api/prices/route");

// Access the mocked findOrCreateProduct
const { findOrCreateProduct } = await import("@/lib/product-matcher");
const mockFindOrCreateProduct = findOrCreateProduct as ReturnType<
  typeof vi.fn
>;

describe("POST /api/prices (bulk price registration)", () => {
  beforeEach(() => {
    mockPrisma = createMockPrisma();
    mockSession = null;
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockSession = null;
    const request = new NextRequest("http://localhost/api/prices", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns 400 when items array is empty", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    const request = new NextRequest("http://localhost/api/prices", {
      method: "POST",
      body: JSON.stringify({
        items: [],
        storeId: "store-1",
        sourceType: "photo",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 when storeId is missing", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    const request = new NextRequest("http://localhost/api/prices", {
      method: "POST",
      body: JSON.stringify({
        items: [{ name: "りんご", price: 100 }],
        storeId: "",
        sourceType: "photo",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 when sourceType is invalid", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    const request = new NextRequest("http://localhost/api/prices", {
      method: "POST",
      body: JSON.stringify({
        items: [{ name: "りんご", price: 100 }],
        storeId: "store-1",
        sourceType: "invalid",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 when store is not found", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    mockPrisma.store.findFirst.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/prices", {
      method: "POST",
      body: JSON.stringify({
        items: [{ name: "りんご", price: 100 }],
        storeId: "store-999",
        sourceType: "photo",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("店舗");
  });

  it("registers prices and returns summary", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    mockPrisma.store.findFirst.mockResolvedValue({
      id: "store-1",
      name: "テスト店",
    });
    mockFindOrCreateProduct.mockResolvedValue({
      id: "prod-1",
      isNew: true,
    });
    mockPrisma.priceRecord.create.mockResolvedValue({
      id: "price-1",
      productId: "prod-1",
      price: 100,
      product: { id: "prod-1", name: "りんご" },
    });
    mockPrisma.priceRecord.findFirst.mockResolvedValue({ price: 100 });
    mockPrisma.priceWatch.findMany.mockResolvedValue([]);

    const request = new NextRequest("http://localhost/api/prices", {
      method: "POST",
      body: JSON.stringify({
        items: [{ name: "りんご", price: 100 }],
        storeId: "store-1",
        sourceType: "photo",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.registered).toHaveLength(1);
    expect(body.summary.success).toBe(1);
    expect(body.summary.failed).toBe(0);
    expect(body.summary.newProducts).toBe(1);
  });

  it("applies tax conversion for tax-excluded prices", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    mockPrisma.store.findFirst.mockResolvedValue({
      id: "store-1",
      name: "テスト店",
    });
    mockFindOrCreateProduct.mockResolvedValue({
      id: "prod-1",
      isNew: false,
    });
    mockPrisma.priceRecord.create.mockResolvedValue({
      id: "price-1",
      productId: "prod-1",
      price: 110, // 100 * 1.1
      product: { id: "prod-1", name: "りんご" },
    });
    mockPrisma.priceRecord.findFirst.mockResolvedValue({ price: 110 });
    mockPrisma.priceWatch.findMany.mockResolvedValue([]);

    const request = new NextRequest("http://localhost/api/prices", {
      method: "POST",
      body: JSON.stringify({
        items: [{ name: "りんご", price: 100, is_tax_included: false }],
        storeId: "store-1",
        sourceType: "photo",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
    // Check that priceRecord.create was called with tax-included price
    expect(mockPrisma.priceRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          price: 110, // 100 * 1.1
          taxIncluded: true,
        }),
      }),
    );
  });

  it("skips items with invalid price", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    mockPrisma.store.findFirst.mockResolvedValue({
      id: "store-1",
      name: "テスト店",
    });

    const request = new NextRequest("http://localhost/api/prices", {
      method: "POST",
      body: JSON.stringify({
        items: [
          { name: "りんご", price: -10 },
          { name: "", price: 100 },
          { name: "バナナ", price: 0 },
        ],
        storeId: "store-1",
        sourceType: "photo",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.summary.success).toBe(0);
    expect(body.summary.failed).toBe(3);
  });
});

describe("GET /api/prices", () => {
  beforeEach(() => {
    mockPrisma = createMockPrisma();
    mockSession = null;
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockSession = null;
    const request = new NextRequest("http://localhost/api/prices");
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it("returns price records with pagination", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    mockPrisma.priceRecord.findMany.mockResolvedValue([
      {
        id: "pr-1",
        price: 100,
        recordedAt: new Date("2025-01-01"),
        product: { id: "prod-1", name: "りんご", normalizedName: "りんご" },
        store: { id: "store-1", name: "テスト店" },
      },
    ]);

    const request = new NextRequest("http://localhost/api/prices?limit=10");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.records).toHaveLength(1);
    expect(body.hasMore).toBe(false);
    expect(body.nextCursor).toBeNull();
  });

  it("supports productId filter", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    mockPrisma.priceRecord.findMany.mockResolvedValue([]);

    const request = new NextRequest(
      "http://localhost/api/prices?productId=prod-1",
    );
    await GET(request);

    expect(mockPrisma.priceRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          productId: "prod-1",
        }),
      }),
    );
  });
});
