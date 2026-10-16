import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  bucket: vi.fn(() => ({ bucket: "fixture" })),
  create: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: state.create }));
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:3010");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "isolated-database-key");
  vi.stubEnv("SUPABASE_STORAGE_URL", "https://storage.fixture.invalid");
  vi.stubEnv("SUPABASE_STORAGE_SERVICE_KEY", "isolated-private-storage-key");
  state.create.mockReturnValue({ storage: { from: state.bucket } });
});
afterEach(() => vi.unstubAllEnvs());

describe("R&D private storage configuration", () => {
  it("uses the existing separate storage service, never VPS PostgREST credentials", async () => {
    const { rdAttachmentStorage } = await import("./client.server");
    rdAttachmentStorage();
    expect(state.create).toHaveBeenCalledWith(
      "https://storage.fixture.invalid",
      "isolated-private-storage-key",
      expect.objectContaining({ auth: { persistSession: false, autoRefreshToken: false } }),
    );
    expect(state.bucket).toHaveBeenCalledWith("rd-attachments");
    rdAttachmentStorage();
    expect(state.create).toHaveBeenCalledTimes(1);
  });
  it.each(["SUPABASE_STORAGE_URL", "SUPABASE_STORAGE_SERVICE_KEY"])(
    "rejects partial storage configuration missing %s",
    async (name) => {
      vi.stubEnv(name, "");
      const { rdAttachmentStorage } = await import("./client.server");
      expect(() => rdAttachmentStorage()).toThrow("storage credentials are not configured");
      expect(state.create).not.toHaveBeenCalled();
    },
  );
  it("retains same-service hosted deployments when no separate storage is configured", async () => {
    vi.stubEnv("SUPABASE_STORAGE_URL", "");
    vi.stubEnv("SUPABASE_STORAGE_SERVICE_KEY", "");
    vi.stubEnv("SUPABASE_URL", "https://hosted.fixture.invalid");
    const { rdAttachmentStorage } = await import("./client.server");
    rdAttachmentStorage();
    expect(state.create).toHaveBeenCalledWith(
      "https://hosted.fixture.invalid",
      "isolated-database-key",
      expect.any(Object),
    );
  });
});
