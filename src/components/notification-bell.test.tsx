/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// Mock lucide-react
vi.mock("lucide-react", () => ({
  Bell: ({ className }: { className?: string }) => (
    <span data-testid="bell-icon" className={className}>Bell</span>
  ),
  Check: () => <span data-testid="check-icon">Check</span>,
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock shadcn/ui Popover
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children, open }: { children: React.ReactNode; open?: boolean; onOpenChange?: (o: boolean) => void }) => (
    <div data-testid="popover" data-open={open}>{children}</div>
  ),
  PopoverTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => (
    <div data-testid="popover-trigger">{children}</div>
  ),
  PopoverContent: ({ children }: { children: React.ReactNode; align?: string; className?: string }) => (
    <div data-testid="popover-content">{children}</div>
  ),
}));

import { NotificationBell } from "@/components/notification-bell";

describe("NotificationBell", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("renders bell icon", () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ count: 0 }),
    });
    render(<NotificationBell />);
    expect(screen.getByTestId("bell-icon")).toBeInTheDocument();
  });

  it("renders aria-label for accessibility", () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ count: 0 }),
    });
    render(<NotificationBell />);
    expect(screen.getByLabelText("通知")).toBeInTheDocument();
  });

  it("fetches unread count on mount", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ count: 5 }),
    });
    render(<NotificationBell />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/notifications/unread-count");
    });
  });

  it("shows unread badge when count > 0", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ count: 3 }),
    });
    render(<NotificationBell />);

    await waitFor(() => {
      expect(screen.getByText("3")).toBeInTheDocument();
    });
  });

  it("shows 99+ when count > 99", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ count: 150 }),
    });
    render(<NotificationBell />);

    await waitFor(() => {
      expect(screen.getByText("99+")).toBeInTheDocument();
    });
  });

  it("does not show badge when count is 0", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ count: 0 }),
    });
    render(<NotificationBell />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("shows empty state message in popover content", () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ count: 0 }),
    });
    render(<NotificationBell />);
    expect(screen.getByText("通知はありません")).toBeInTheDocument();
  });

  it("renders notification header text", () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ count: 0 }),
    });
    render(<NotificationBell />);
    expect(screen.getByText("通知")).toBeInTheDocument();
  });
});
