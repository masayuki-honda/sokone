import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

let mockSession: { user: { id: string; email: string } } | null = null;
const mockGetDashboardStats = vi.fn();
const mockGetRecentPrices = vi.fn();
const mockGetBottomPrices = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(() => Promise.resolve(mockSession)),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/bottom-price", () => ({
  getDashboardStats: (...args: unknown[]) => mockGetDashboardStats(...args),
  getRecentPrices: (...args: unknown[]) => mockGetRecentPrices(...args),
  getBottomPrices: (...args: unknown[]) => mockGetBottomPrices(...args),
}));

const { GET: dashboardGET } = await import("@/app/api/dashboard/route");
const { GET: productsGET } = await import(
  "@/app/api/dashboard/products/route"
);

describe("GET /api/dashboard", () => {
  beforeEach(() => {
    mockSession = null;
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockSession = null;
    const request = new NextRequest("http://localhost/api/dashboard");
    const response = await dashboardGET(request);
    expect(response.status).toBe(401);
  });

  it("returns stats and recent prices", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    mockGetDashboardStats.mockResolvedValue({
      totalProducts: 10,
      totalRecords: 50,
      totalStores: 3,
      bottomPriceCount: 8,
    });
    mockGetRecentPrices.mockResolvedValue([
      {
        id: "pr-1",
        price: 198,
        recordedAt: "2025-01-15T00:00:00.000Z",
        productName: "りんご",
        storeName: "A店",
      },
    ]);

    const request = new NextRequest("http://localhost/api/dashboard");
    const response = await dashboardGET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.stats.totalProducts).toBe(10);
    expect(body.recentPrices).toHaveLength(1);
    expect(mockGetDashboardStats).toHaveBeenCalledWith("user-1");
    expect(mockGetRecentPrices).toHaveBeenCalledWith("user-1", 10);
  });

  it("respects recentLimit query param", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    mockGetDashboardStats.mockResolvedValue({});
    mockGetRecentPrices.mockResolvedValue([]);

    const request = new NextRequest(
      "http://localhost/api/dashboard?recentLimit=5",
    );
    await dashboardGET(request);

    expect(mockGetRecentPrices).toHaveBeenCalledWith("user-1", 5);
  });
});

describe("GET /api/dashboard/products", () => {
  beforeEach(() => {
    mockSession = null;
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockSession = null;
    const request = new NextRequest(
      "http://localhost/api/dashboard/products",
    );
    const response = await productsGET(request);
    expect(response.status).toBe(401);
  });

  it("returns bottom prices list", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    mockGetBottomPrices.mockResolvedValue({
      products: [
        {
          id: "prod-1",
          name: "りんご",
          bottomPrice: 98,
          storeName: "B店",
        },
      ],
      hasMore: false,
      nextCursor: null,
    });

    const request = new NextRequest(
      "http://localhost/api/dashboard/products",
    );
    const response = await productsGET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.products).toHaveLength(1);
    expect(body.products[0].bottomPrice).toBe(98);
    expect(mockGetBottomPrices).toHaveBeenCalledWith("user-1", {
      categoryId: undefined,
      query: undefined,
      limit: 20,
      cursor: undefined,
    });
  });

  it("passes query params to getBottomPrices", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    mockGetBottomPrices.mockResolvedValue({
      products: [],
      hasMore: false,
      nextCursor: null,
    });

    const request = new NextRequest(
      "http://localhost/api/dashboard/products?categoryId=cat-1&q=りんご&limit=5",
    );
    await productsGET(request);

    expect(mockGetBottomPrices).toHaveBeenCalledWith("user-1", {
      categoryId: "cat-1",
      query: "りんご",
      limit: 5,
      cursor: undefined,
    });
  });
});
