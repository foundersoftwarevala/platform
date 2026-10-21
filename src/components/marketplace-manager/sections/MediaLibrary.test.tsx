// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/operator-fetch", () => ({
  authHeaders: vi.fn().mockResolvedValue({}),
}));

import { MediaLibrary } from "./MediaLibrary";

const imageAsset = {
  asset_id: "storage:marketplace-media:products/photo.png",
  source: "storage",
  authority: "Supabase Storage",
  filename: "photo.png",
  display_name: "Product photo",
  mime_type: "image/png",
  extension: "png",
  kind: "image",
  size_bytes: 1024,
  width: 320,
  height: 240,
  checksum: null,
  storage_path: "products/photo.png",
  is_public: false,
  status: "stored",
  uploaded_at: null,
  missing_file: false,
  references: 0,
};

const mediaResponse = {
  ok: true,
  total: 1,
  matched: 1,
  page: 1,
  size: 25,
  assets: [imageAsset],
  sources: ["storage"],
  buckets: ["marketplace-media"],
  notes: [],
  storage: {
    used_bytes: 1024,
    by_kind_bytes: { image: 1024 },
    by_kind_count: { image: 1 },
    quota_bytes: null,
    quota_note: "Provider quota unavailable.",
    files_missing: 0,
  },
  references: {
    products: 1,
    products_with_image: 1,
    products_without_image: 0,
    products_with_icon_name_only: 0,
    published_without_image: 0,
    orphan_candidates: 0,
    referenced: 1,
  },
  capabilities: {
    upload: { available: false, reason: "No media table records uploaded files." },
    versions: { available: false, reason: "Version history is unavailable." },
    signed_download: { available: true, reason: null },
    delete: { available: false, reason: "The owning manager controls deletion." },
  },
  permissions: { view: true, upload: true, manage: false, download: true, export: false },
};

const jsonResponse = (payload: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  }) as Response;

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(mediaResponse)));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Marketplace Media Library", () => {
  it("shows the server's upload limitation and signs an image only when preview is requested", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(mediaResponse))
      .mockResolvedValueOnce(
        jsonResponse({ ok: true, url: "https://storage.example/signed/photo.png" }),
      );
    render(<MediaLibrary />);

    expect(await screen.findByText("Product photo")).toBeTruthy();
    expect(screen.getByText("No media table records uploaded files.")).toBeTruthy();
    expect(screen.queryByRole("img", { name: "Product photo" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Preview image" }));

    const image = await screen.findByRole("img", { name: "Product photo" });
    expect(image.getAttribute("src")).toBe("https://storage.example/signed/photo.png");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/marketplace/media");
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ asset_id: imageAsset.asset_id }),
    });
  });

  it("shows signing failures and allows retrying the preview", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(mediaResponse))
      .mockResolvedValueOnce(jsonResponse({ message: "Signing is temporarily unavailable." }, 502))
      .mockResolvedValueOnce(jsonResponse({ ok: true, url: "https://storage.example/retry.png" }));
    render(<MediaLibrary />);

    fireEvent.click(await screen.findByRole("button", { name: "Preview image" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Signing is temporarily unavailable.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry preview" }));
    await waitFor(() =>
      expect(screen.getByRole("img", { name: "Product photo" }).getAttribute("src")).toBe(
        "https://storage.example/retry.png",
      ),
    );
  });

  it("offers a retry after a library load failure and then shows the empty state", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "Media endpoint unavailable" }, 502))
      .mockResolvedValueOnce(
        jsonResponse({
          ...mediaResponse,
          total: 0,
          matched: 0,
          assets: [],
          permissions: { ...mediaResponse.permissions, export: false },
        }),
      );
    render(<MediaLibrary />);

    expect(await screen.findByText("Media endpoint unavailable")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Nothing matches that.")).toBeTruthy();
  });

  it("shows export network failures and leaves Export available to retry", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          ...mediaResponse,
          permissions: { ...mediaResponse.permissions, export: true },
        }),
      )
      .mockRejectedValueOnce(new Error("Network unavailable"));
    render(<MediaLibrary />);

    const exportButton = await screen.findByRole("button", { name: "Export" });
    fireEvent.click(exportButton);

    expect(await screen.findByText("Export failed: Network unavailable")).toBeTruthy();
    expect(exportButton.hasAttribute("disabled")).toBe(false);
  });
});
