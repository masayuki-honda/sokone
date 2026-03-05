import { describe, it, expect, beforeEach } from "vitest";
import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("returns status ok with timestamp and version", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.version).toBe("0.1.0");
    expect(body.timestamp).toBeDefined();
    // Verify timestamp is a valid ISO date
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it("returns a recent timestamp", async () => {
    const before = new Date();
    const response = await GET();
    const body = await response.json();
    const after = new Date();

    const timestamp = new Date(body.timestamp);
    expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});
