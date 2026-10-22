// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ValaAiAgent } from "./ValaAiAgent";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  useApi: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("./api", () => ({ api: mocks.api, useApi: mocks.useApi }));
vi.mock("sonner", () => ({
  toast: { error: mocks.toastError, success: vi.fn() },
}));
vi.mock("@/hooks/useNavigate", () => ({ useNavigate: () => vi.fn() }));
vi.mock("./useValaChat", () => ({
  useValaChat: () => ({
    messages: [],
    status: "idle",
    send: vi.fn(),
    reset: vi.fn(),
  }),
}));
vi.mock("./useLocalAudioInput", () => ({
  useLocalAudioInput: () => ({
    recording: false,
    processing: false,
    error: null,
    toggleRecording: vi.fn(),
  }),
}));
vi.mock("./ValaAvatarLive", () => ({ ValaAvatarLive: () => null }));

describe("ValaAiAgent session boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    });
    mocks.useApi.mockReturnValue({
      data: {
        operator: { id: "owner-id", email: "owner@example.test", name: "Owner", role: "boss" },
      },
      error: null,
    });
  });
  afterEach(cleanup);

  it("provides the authenticated Vala AI operator before rendering the assistant", () => {
    render(<ValaAiAgent />);

    expect(mocks.useApi).toHaveBeenCalledWith(["session"], "/session");
    expect(
      screen.getByRole("button", { name: "Start voice recording" }).hasAttribute("disabled"),
    ).toBe(false);
  });

  it("does not render the assistant when the Vala AI session denies access", () => {
    mocks.useApi.mockReturnValue({ data: undefined, error: { status: 403, message: "Denied" } });

    render(<ValaAiAgent />);

    expect(screen.queryByRole("button", { name: "Open Vala AI assistant" })).toBeNull();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });
});
