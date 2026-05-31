import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LandingPage from "@/app/page";
import SettingsPage from "@/app/settings/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ clear: vi.fn() }),
}));

vi.mock("@/lib/profile/use-profile", () => ({
  useMyProfile: () => ({ data: null }),
}));

vi.mock("@/lib/group/use-my-group", () => ({
  useMyGroup: () => ({ data: null }),
}));

vi.mock("@/lib/supabase/browser-client", () => ({
  getBrowserClient: () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: null } }),
    },
  }),
}));

describe("design system links", () => {
  it("does not show design system CTA on the landing page", () => {
    render(<LandingPage />);
    expect(screen.queryByText("디자인 시스템 보기")).toBeNull();
  });

  it("does not show design palette link in settings", () => {
    render(<SettingsPage />);
    expect(screen.queryByText("디자인 시스템 팔레트 보기")).toBeNull();
  });
});
