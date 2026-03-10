import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createMockPrisma, type MockPrisma } from "@/__tests__/mock-prisma";

// Mock modules before imports
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

vi.mock("@/lib/geocode", () => ({
  geocodeAddress: vi.fn(() => Promise.resolve(null)),
}));

// Import after mocking
const { GET, POST } = await import("@/app/api/stores/route");

describe("GET /api/stores", () => {
  beforeEach(() => {
    mockPrisma = createMockPrisma();
    mockSession = null;
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockSession = null;
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns empty array when user has no stores", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    mockPrisma.store.findMany.mockResolvedValue([]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([]);
    expect(mockPrisma.store.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { updatedAt: "desc" },
      include: {
        scrapingJobs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            imagesScraped: true,
            pricesRegistered: true,
            completedAt: true,
            createdAt: true,
          },
        },
      },
    });
  });

  it("returns user stores sorted by updatedAt desc", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    const stores = [
      {
        id: "store-1",
        name: "テスト店舗A",
        address: "東京都渋谷区1-1-1",
        latitude: 35.6895,
        longitude: 139.6917,
        userId: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        scrapingJobs: [],
      },
      {
        id: "store-2",
        name: "テスト店舗B",
        address: null,
        latitude: null,
        longitude: null,
        userId: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        scrapingJobs: [],
      },
    ];
    mockPrisma.store.findMany.mockResolvedValue(stores);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(2);
    expect(body[0].name).toBe("テスト店舗A");
    expect(body[1].name).toBe("テスト店舗B");
  });
});

describe("POST /api/stores", () => {
  beforeEach(() => {
    mockPrisma = createMockPrisma();
    mockSession = null;
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockSession = null;
    const request = new NextRequest("http://localhost/api/stores", {
      method: "POST",
      body: JSON.stringify({ name: "テスト店舗" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns 400 when name is empty", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    const request = new NextRequest("http://localhost/api/stores", {
      method: "POST",
      body: JSON.stringify({ name: "" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("店舗名は必須です");
  });

  it("returns 400 when name exceeds 100 characters", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    const longName = "あ".repeat(101);
    const request = new NextRequest("http://localhost/api/stores", {
      method: "POST",
      body: JSON.stringify({ name: longName }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("店舗名は100文字以内で入力してください");
  });

  it("creates a store successfully", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    const createdStore = {
      id: "store-new",
      name: "新規店舗",
      address: "東京都新宿区",
      latitude: null,
      longitude: null,
      userId: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockPrisma.store.create.mockResolvedValue(createdStore);

    const request = new NextRequest("http://localhost/api/stores", {
      method: "POST",
      body: JSON.stringify({ name: "新規店舗", address: "東京都新宿区" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.name).toBe("新規店舗");
    expect(mockPrisma.store.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "新規店舗",
        address: "東京都新宿区",
        userId: "user-1",
      }),
    });
  });

  it("trims whitespace from store name and address", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    mockPrisma.store.create.mockResolvedValue({
      id: "store-new",
      name: "スーパー",
      address: "東京都",
      latitude: null,
      longitude: null,
      userId: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = new NextRequest("http://localhost/api/stores", {
      method: "POST",
      body: JSON.stringify({ name: "  スーパー  ", address: "  東京都  " }),
      headers: { "Content-Type": "application/json" },
    });

    await POST(request);

    expect(mockPrisma.store.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "スーパー",
        address: "東京都",
      }),
    });
  });
});
