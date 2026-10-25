// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RecognitionDetector } from "./RecognitionDetector";

const { subscribeNotificationStream, supabaseMock } = vi.hoisted(() => ({
  subscribeNotificationStream: vi.fn(),
  supabaseMock: { getClient: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({
  get supabase() {
    return supabaseMock.getClient();
  },
}));

vi.mock("@/lib/realtime/notification-stream", () => ({
  subscribeNotificationStream,
}));

vi.mock("@/lib/ams/recognition.functions", () => ({
  getAmsRecognitionsByLedgerIds: vi.fn(),
  getPendingAmsRecognitions: vi.fn(),
}));

vi.mock("@/lib/ams/ui-sound", () => ({
  unlockAudioOnFirstGesture: vi.fn(),
}));

vi.mock("./Celebration", () => ({
  useCelebration: () => ({ presentRecognitions: vi.fn() }),
}));

describe("RecognitionDetector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("does not crash the app when realtime authentication is unavailable", () => {
    const missingConfig = new Error("Missing Supabase environment variables");
    subscribeNotificationStream.mockImplementation(() => {
      throw missingConfig;
    });

    const { container } = render(<RecognitionDetector />);

    expect(container).toBeTruthy();
    expect(console.error).toHaveBeenCalledWith(
      "[ams-recognition] Authentication or live updates are unavailable.",
      missingConfig,
    );
  });
});
