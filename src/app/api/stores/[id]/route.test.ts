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

vi.mock("@/lib/geocode", () => ({
  geocodeAddress: vi.fn(() => Promise.resolve(null)),
}));

const { GET, PUT, DELETE } = await import("@/app/api/stores/[id]/route");

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/stores/[id]", () => {
  beforeEach(() => {
    mockPrisma = createMockPrisma();
    mockSession = null;
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockSession = null;
    const request = new NextRequest("http://localhost/api/stores/store-1");
    const response = await GET(request, makeParams("store-1"));

    expect(response.status).toBe(401);
  });

  it("returns 404 when store not found", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    mockPrisma.store.findFirst.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/stores/nonexistent");
    const response = await GET(request, makeParams("nonexistent"));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("店舗が見つかりません");
  });

  it("returns store when found", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    const store = {
      id: "store-1",
      name: "テスト店舗",
      address: "東京都",
      latitude: 35.68,
      longitude: 139.69,
      userId: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockPrisma.store.findFirst.mockResolvedValue(store);

    const request = new NextRequest("http://localhost/api/stores/store-1");
    const response = await GET(request, makeParams("store-1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.name).toBe("テスト店舗");
  });
});

describe("PUT /api/stores/[id]", () => {
  beforeEach(() => {
    mockPrisma = createMockPrisma();
    mockSession = null;
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockSession = null;
    const request = new NextRequest("http://localhost/api/stores/store-1", {
      method: "PUT",
      body: JSON.stringify({ name: "更新" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await PUT(request, makeParams("store-1"));
    expect(response.status).toBe(401);
  });

  it("returns 404 when store not found", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    mockPrisma.store.findFirst.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/stores/nonexistent", {
      method: "PUT",
      body: JSON.stringify({ name: "更新" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await PUT(request, makeParams("nonexistent"));
    expect(response.status).toBe(404);
  });

  it("returns 400 when name is empty string", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    mockPrisma.store.findFirst.mockResolvedValue({
      id: "store-1",
      name: "既存店舗",
      userId: "user-1",
    });

    const request = new NextRequest("http://localhost/api/stores/store-1", {
      method: "PUT",
      body: JSON.stringify({ name: "" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await PUT(request, makeParams("store-1"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("店舗名は必須です");
  });

  it("updates store successfully", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    mockPrisma.store.findFirst.mockResolvedValue({
      id: "store-1",
      name: "旧名前",
      userId: "user-1",
    });
    mockPrisma.store.update.mockResolvedValue({
      id: "store-1",
      name: "新名前",
      address: null,
      latitude: null,
      longitude: null,
      userId: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = new NextRequest("http://localhost/api/stores/store-1", {
      method: "PUT",
      body: JSON.stringify({ name: "新名前" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await PUT(request, makeParams("store-1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.name).toBe("新名前");
  });
});

describe("DELETE /api/stores/[id]", () => {
  beforeEach(() => {
    mockPrisma = createMockPrisma();
    mockSession = null;
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockSession = null;
    const request = new NextRequest("http://localhost/api/stores/store-1", {
      method: "DELETE",
    });

    const response = await DELETE(request, makeParams("store-1"));
    expect(response.status).toBe(401);
  });

  it("returns 404 when store not found", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    mockPrisma.store.findFirst.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/stores/nonexistent", {
      method: "DELETE",
    });

    const response = await DELETE(request, makeParams("nonexistent"));
    expect(response.status).toBe(404);
  });

  it("deletes store successfully", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    mockPrisma.store.findFirst.mockResolvedValue({
      id: "store-1",
      name: "削除対象",
      userId: "user-1",
    });
    mockPrisma.store.delete.mockResolvedValue({});

    const request = new NextRequest("http://localhost/api/stores/store-1", {
      method: "DELETE",
    });

    const response = await DELETE(request, makeParams("store-1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe("店舗を削除しました");
    expect(mockPrisma.store.delete).toHaveBeenCalledWith({
      where: { id: "store-1" },
    });
  });
});
