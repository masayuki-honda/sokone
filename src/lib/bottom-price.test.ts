import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockPrisma, type MockPrisma } from "@/__tests__/mock-prisma";

let mockPrisma: MockPrisma;

vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return mockPrisma;
  },
}));

const { getBottomPrices, getDashboardStats, getRecentPrices } = await import(
  "@/lib/bottom-price"
);

describe("getBottomPrices", () => {
  beforeEach(() => {
    mockPrisma = createMockPrisma();
    vi.clearAllMocks();
  });

  it("returns empty items when no products have price records", async () => {
    mockPrisma.product.findMany.mockResolvedValue([]);

    const result = await getBottomPrices("user-1");

    expect(result.items).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });

  it("calculates bottom price correctly from multiple records", async () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 86400000);
    const lastWeek = new Date(now.getTime() - 7 * 86400000);

    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: "prod-1",
        name: "金麦 350ml",
        unit: "本",
        category: { name: "酒類" },
        priceRecords: [
          {
            price: 128,
            recordedAt: now,
            store: { id: "store-1", name: "ストアA" },
          },
          {
            price: 98,
            recordedAt: yesterday,
            store: { id: "store-2", name: "ストアB" },
          },
          {
            price: 148,
            recordedAt: lastWeek,
            store: { id: "store-1", name: "ストアA" },
          },
        ],
      },
    ]);

    const result = await getBottomPrices("user-1");

    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.productName).toBe("金麦 350ml");
    expect(item.bottomPrice).toBe(98);
    expect(item.bottomStoreName).toBe("ストアB");
    expect(item.latestPrice).toBe(128);
    expect(item.latestStoreName).toBe("ストアA");
    expect(item.averagePrice).toBe(Math.round((128 + 98 + 148) / 3));
    expect(item.recordCount).toBe(3);
    expect(item.categoryName).toBe("酒類");
  });

  it("supports cursor-based pagination", async () => {
    // Simulate more items than limit
    const products = Array.from({ length: 21 }, (_, i) => ({
      id: `prod-${i}`,
      name: `商品${i}`,
      unit: null,
      category: null,
      priceRecords: [
        {
          price: 100 + i,
          recordedAt: new Date(),
          store: { id: "store-1", name: "ストアA" },
        },
      ],
    }));
    mockPrisma.product.findMany.mockResolvedValue(products);

    const result = await getBottomPrices("user-1", { limit: 20 });

    expect(result.items).toHaveLength(20);
    expect(result.nextCursor).toBe("prod-19");
  });

  it("passes categoryId filter", async () => {
    mockPrisma.product.findMany.mockResolvedValue([]);

    await getBottomPrices("user-1", { categoryId: "cat-1" });

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          categoryId: "cat-1",
        }),
      }),
    );
  });

  it("passes query filter", async () => {
    mockPrisma.product.findMany.mockResolvedValue([]);

    await getBottomPrices("user-1", { query: "金麦" });

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              name: { contains: "金麦", mode: "insensitive" },
            }),
          ]),
        }),
      }),
    );
  });
});

describe("getDashboardStats", () => {
  beforeEach(() => {
    mockPrisma = createMockPrisma();
    vi.clearAllMocks();
  });

  it("returns all dashboard stats", async () => {
    mockPrisma.priceRecord.findMany.mockResolvedValue([
      { productId: "p1" },
      { productId: "p2" },
      { productId: "p3" },
    ]);
    mockPrisma.store.count.mockResolvedValue(5);
    mockPrisma.priceRecord.count
      .mockResolvedValueOnce(42)  // totalRecords
      .mockResolvedValueOnce(10); // monthRecords
    mockPrisma.favoriteProduct.count.mockResolvedValue(3);

    const stats = await getDashboardStats("user-1");

    expect(stats.productCount).toBe(3);
    expect(stats.storeCount).toBe(5);
    expect(stats.totalRecords).toBe(42);
    expect(stats.monthRecords).toBe(10);
    expect(stats.favoriteCount).toBe(3);
  });
});

describe("getRecentPrices", () => {
  beforeEach(() => {
    mockPrisma = createMockPrisma();
    vi.clearAllMocks();
  });

  it("fetches recent prices ordered by createdAt desc", async () => {
    const records = [
      {
        id: "rec-1",
        price: 128,
        product: { id: "p1", name: "金麦", unit: "本" },
        store: { id: "s1", name: "ストアA" },
      },
    ];
    mockPrisma.priceRecord.findMany.mockResolvedValue(records);

    const result = await getRecentPrices("user-1", 5);

    expect(result).toEqual(records);
    expect(mockPrisma.priceRecord.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        product: { select: { id: true, name: true, unit: true } },
        store: { select: { id: true, name: true } },
      },
    });
  });

  it("defaults to 10 records when limit not specified", async () => {
    mockPrisma.priceRecord.findMany.mockResolvedValue([]);

    await getRecentPrices("user-1");

    expect(mockPrisma.priceRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 }),
    );
  });
});
