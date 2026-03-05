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

const { PUT } = await import("@/app/api/favorites/order/route");

describe("PUT /api/favorites/order", () => {
  beforeEach(() => {
    mockPrisma = createMockPrisma();
    mockSession = null;
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockSession = null;
    const request = new NextRequest("http://localhost/api/favorites/order", {
      method: "PUT",
      body: JSON.stringify({ items: [] }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await PUT(request);
    expect(response.status).toBe(401);
  });

  it("returns 400 when items is empty", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    const request = new NextRequest("http://localhost/api/favorites/order", {
      method: "PUT",
      body: JSON.stringify({ items: [] }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await PUT(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 when items missing required fields", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    const request = new NextRequest("http://localhost/api/favorites/order", {
      method: "PUT",
      body: JSON.stringify({
        items: [{ productId: "prod-1" }], // missing displayOrder
      }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await PUT(request);
    expect(response.status).toBe(400);
  });

  it("updates display orders via $transaction", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    mockPrisma.favoriteProduct.update.mockResolvedValue({});
    mockPrisma.$transaction.mockImplementation((fns: unknown[]) =>
      Promise.all(fns),
    );

    const request = new NextRequest("http://localhost/api/favorites/order", {
      method: "PUT",
      body: JSON.stringify({
        items: [
          { productId: "prod-1", displayOrder: 1 },
          { productId: "prod-2", displayOrder: 2 },
          { productId: "prod-3", displayOrder: 3 },
        ],
      }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });
});
