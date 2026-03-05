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

const { DELETE } = await import("@/app/api/favorites/[productId]/route");

function makeParams(productId: string) {
  return { params: Promise.resolve({ productId }) };
}

describe("DELETE /api/favorites/[productId]", () => {
  beforeEach(() => {
    mockPrisma = createMockPrisma();
    mockSession = null;
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockSession = null;
    const request = new NextRequest(
      "http://localhost/api/favorites/prod-1",
      { method: "DELETE" },
    );
    const response = await DELETE(request, makeParams("prod-1"));
    expect(response.status).toBe(401);
  });

  it("returns 404 when favorite not found", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    mockPrisma.favoriteProduct.findUnique.mockResolvedValue(null);

    const request = new NextRequest(
      "http://localhost/api/favorites/nonexistent",
      { method: "DELETE" },
    );
    const response = await DELETE(request, makeParams("nonexistent"));
    expect(response.status).toBe(404);
  });

  it("deletes favorite successfully", async () => {
    mockSession = { user: { id: "user-1", email: "test@example.com" } };
    mockPrisma.favoriteProduct.findUnique.mockResolvedValue({
      id: "fav-1",
      userId: "user-1",
      productId: "prod-1",
    });
    mockPrisma.favoriteProduct.delete.mockResolvedValue({});

    const request = new NextRequest(
      "http://localhost/api/favorites/prod-1",
      { method: "DELETE" },
    );
    const response = await DELETE(request, makeParams("prod-1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
