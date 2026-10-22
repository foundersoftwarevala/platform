// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useResource } from "@/lib/manager/use-resource";
import { SeoResourceFeedbackNotice, SeoResourceFeedbackProvider } from "./SeoResourceFeedback";

vi.mock("@/lib/auth/operator-fetch", () => ({
  authHeaders: vi.fn().mockResolvedValue({}),
}));

function ResourceReader() {
  const resource = useResource("seo_pages", { limit: 10 });
  return (
    <div>
      {resource.rows.map((row, index) => (
        <span key={index}>{String(row.title)}</span>
      ))}
    </div>
  );
}

describe("SEO resource feedback", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows loading feedback, reports a failed request, and retries successfully", async () => {
    let finishFirstRequest: (response: Response) => void = () => undefined;
    const firstRequest = new Promise<Response>((resolve) => {
      finishFirstRequest = resolve;
    });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementationOnce(() => firstRequest)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ rows: [{ title: "Recovered page" }], total: 1 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    render(
      <SeoResourceFeedbackProvider>
        <SeoResourceFeedbackNotice />
        <ResourceReader />
      </SeoResourceFeedbackProvider>,
    );

    expect(screen.getByRole("status").textContent).toContain("Loading SEO data");
    await act(async () => {
      finishFirstRequest(new Response(null, { status: 503 }));
    });
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Failed to load seo_pages. Please try again.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByText("Recovered page")).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
