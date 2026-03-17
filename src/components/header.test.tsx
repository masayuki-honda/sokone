/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock next-auth/react
const mockUseSession = vi.fn();
const mockSignOut = vi.fn();
vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Menu: () => <span data-testid="menu-icon">Menu</span>,
  X: () => <span data-testid="x-icon">X</span>,
  Bell: () => <span data-testid="bell-icon">Bell</span>,
  Check: () => <span data-testid="check-icon">Check</span>,
  ChevronDown: () => <span data-testid="chevron-down-icon">▼</span>,
}));

// Mock NotificationBell to isolate Header tests
vi.mock("@/components/notification-bell", () => ({
  NotificationBell: () => <span data-testid="notification-bell">Bell</span>,
}));

import { Header } from "@/components/header";

describe("Header", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state", () => {
    mockUseSession.mockReturnValue({ data: null, status: "loading" });
    render(<Header />);
    expect(screen.getByText("...")).toBeInTheDocument();
  });

  it("renders login button when unauthenticated", () => {
    mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });
    render(<Header />);
    const loginLinks = screen.getAllByText("ログイン");
    expect(loginLinks.length).toBeGreaterThanOrEqual(1);
    expect(loginLinks[0].closest("a")).toHaveAttribute("href", "/auth/signin");
  });

  it("renders app title linking to dashboard", () => {
    mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });
    render(<Header />);
    const title = screen.getByText("🏷️ Sokone");
    expect(title.closest("a")).toHaveAttribute("href", "/dashboard");
  });

  it("renders navigation links when authenticated", () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: "テストユーザー", email: "test@example.com", image: null } },
      status: "authenticated",
    });
    render(<Header />);

    // PRIMARY_LINKS are always visible in the desktop nav
    expect(screen.getByText("商品一覧")).toBeInTheDocument();
    expect(screen.getByText("アップロード")).toBeInTheDocument();
    // "管理" dropdown button is always visible
    expect(screen.getByText("管理")).toBeInTheDocument();
    expect(screen.getByText("テストユーザー")).toBeInTheDocument();
  });

  it("renders user name and logout button when authenticated", () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: "田中太郎", email: "tanaka@example.com", image: null } },
      status: "authenticated",
    });
    render(<Header />);

    expect(screen.getByText("田中太郎")).toBeInTheDocument();
    const logoutButtons = screen.getAllByText("ログアウト");
    expect(logoutButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("calls signOut when logout button is clicked", () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: "テスト", email: "test@example.com", image: null } },
      status: "authenticated",
    });
    render(<Header />);

    // Click the desktop logout button (first one)
    const logoutButtons = screen.getAllByText("ログアウト");
    fireEvent.click(logoutButtons[0]);
    expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: "/" });
  });

  it("renders user avatar when image is provided", () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: "テスト", email: "test@example.com", image: "https://example.com/avatar.jpg" } },
      status: "authenticated",
    });
    const { container } = render(<Header />);

    const avatars = container.querySelectorAll("img");
    expect(avatars.length).toBeGreaterThanOrEqual(1);
    expect(avatars[0]).toHaveAttribute("src", "https://example.com/avatar.jpg");
  });

  it("renders notification bell when authenticated", () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: "テスト", email: "test@example.com", image: null } },
      status: "authenticated",
    });
    render(<Header />);
    expect(screen.getByTestId("notification-bell")).toBeInTheDocument();
  });

  it("toggles mobile menu on hamburger click", () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: "テスト", email: "test@example.com", image: null } },
      status: "authenticated",
    });
    render(<Header />);

    // Mobile menu should not be visible initially
    expect(screen.queryByText("📊 ダッシュボード")).not.toBeInTheDocument();

    // Click hamburger button
    const menuButton = screen.getByLabelText("メニュー");
    fireEvent.click(menuButton);

    // Mobile menu should now be visible
    expect(screen.getByText("📊 ダッシュボード")).toBeInTheDocument();
    expect(screen.getByText("🏪 店舗管理")).toBeInTheDocument();
  });

  it("does not render hamburger menu for unauthenticated users", () => {
    mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });
    render(<Header />);
    expect(screen.queryByLabelText("メニュー")).not.toBeInTheDocument();
  });
});
