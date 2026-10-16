import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const writes: { table: string; value: unknown }[] = [];
  const filters: unknown[][] = [];
  return {
    writes,
    filters,
    notificationError: false,
    checkError: false,
    duplicate: false,
    count: 0,
    tracked: false,
    blocked: false,
    guard: vi.fn(async () => {
      throw new Error("Control Panel access required");
    }),
    sign: vi.fn(async () => ({ data: { token: "isolated-upload-token" }, error: null })),
    upload: vi.fn(async () => ({ data: { path: "pending/fixture" }, error: null })),
  };
});

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate: (input: unknown) => unknown = (input) => input;
    let middleware: (() => Promise<unknown>)[] = [];
    const builder = {
      middleware(value: typeof middleware) {
        middleware = value;
        return builder;
      },
      inputValidator(value: typeof validate) {
        validate = value;
        return builder;
      },
      handler(rpc: (args: { data: unknown }) => Promise<unknown>, implementation?: typeof rpc) {
        const fn = implementation ?? rpc;
        const execute = async (args: { data?: unknown } = {}) => {
          for (const check of middleware) await check();
          return fn({ data: validate(args.data) });
        };
        return Object.assign(execute, { __executeServer: execute });
      },
    };
    return builder;
  },
}));
vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: (name: string) =>
    name === "cf-connecting-ip" ? "192.0.2.20" : "isolated-test",
}));
vi.mock("./auth.functions", () => ({ rdOperator: state.guard }));
vi.mock("@/lib/i18n/limits", () => ({
  SlidingWindowLimiter: class {
    hit() {
      return state.blocked;
    }
  },
}));
vi.mock("./supabase/client.server", () => ({
  rdAttachmentStorage: () => ({
    createSignedUploadUrl: state.sign,
    uploadToSignedUrl: state.upload,
  }),
  supabaseAdmin: {
    from: (table: string) => new Query(table),
    storage: { from: () => ({ createSignedUploadUrl: state.sign }) },
  },
}));

type Result = { data: unknown; count: number; error: { message: string } | null };
class Query {
  private value: unknown;
  constructor(private table: string) {}
  select() {
    return this;
  }
  eq(...args: unknown[]) {
    state.filters.push(args);
    return this;
  }
  ilike(...args: unknown[]) {
    state.filters.push(args);
    return this;
  }
  gte() {
    return this;
  }
  limit() {
    return this;
  }
  insert(value: unknown) {
    this.value = value;
    state.writes.push({ table: this.table, value });
    return this;
  }
  private result(): Result {
    return {
      data: state.duplicate ? [{ public_request_id: "SV-RD-ABCDEF" }] : [],
      count: state.count,
      error: state.checkError
        ? { message: "isolated database outage" }
        : this.table === "rnd_notifications" && state.notificationError
          ? { message: "isolated notification outage" }
          : null,
    };
  }
  async single() {
    if (typeof this.value !== "object" || !this.value || !("public_request_id" in this.value))
      throw new Error("Expected opportunity insert");
    return {
      data: {
        id: "c733350b-27f5-424e-9b21-f6b837c48018",
        public_request_id: this.value.public_request_id,
        status: "NEW",
        created_at: "2026-10-16T14:00:00Z",
      },
      error: null,
    };
  }
  async maybeSingle() {
    return {
      data: state.tracked
        ? {
            public_request_id: "SV-RD-ABCDEF",
            title: "Transport software",
            type: "SOFTWARE_ON_DEMAND",
            status: "NEW",
            created_at: "2026-10-16T14:00:00Z",
            updated_at: "2026-10-16T14:00:00Z",
          }
        : null,
      error: null,
    };
  }
  then<T = Result, E = never>(
    fulfilled?: ((value: Result) => T | PromiseLike<T>) | null,
    rejected?: ((reason: unknown) => E | PromiseLike<E>) | null,
  ) {
    return Promise.resolve(this.result()).then(fulfilled, rejected);
  }
}

type Functions = typeof import("./rd-opportunities.functions");
type Providers = { [K in keyof Functions as `${K & string}_createServerFn_handler`]: Functions[K] };
const {
  createAttachmentUploads_createServerFn_handler: createAttachmentUploads,
  getAttachmentUrl_createServerFn_handler: getAttachmentUrl,
  listOpportunities_createServerFn_handler: listOpportunities,
  submitOpportunity_createServerFn_handler: submitOpportunity,
  trackOpportunity_createServerFn_handler: trackOpportunity,
  uploadOpportunityAttachment_createServerFn_handler: uploadOpportunityAttachment,
} = await vi.importActual<Providers>("./rd-opportunities.functions.ts?tss-serverfn-split");
import { MAX_ATTACHMENT_BYTES } from "./rd-opportunity-types";

const application = {
  type: "SOFTWARE_ON_DEMAND" as const,
  title: "Transport software",
  need: "Manage school transport routes and attendance.",
  name: "Fixture Applicant",
  email: "Applicant_1@fixture.invalid",
  country: "India",
};

beforeEach(() => {
  vi.clearAllMocks();
  state.writes.length = 0;
  state.filters.length = 0;
  Object.assign(state, {
    notificationError: false,
    checkError: false,
    duplicate: false,
    count: 0,
    tracked: false,
    blocked: false,
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("public R&D intake with protected manager surfaces", () => {
  it("saves a real-schema opportunity, inbox event and admin alert without an operator session", async () => {
    const result = await submitOpportunity({ data: application });
    expect(result.requestId).toMatch(/^SV-RD-[A-Z0-9]{6}$/);
    expect(state.guard).not.toHaveBeenCalled();
    expect(state.writes).toEqual([
      {
        table: "rd_opportunities",
        value: expect.objectContaining({
          contact_email: "applicant_1@fixture.invalid",
          description: application.need,
          type: application.type,
        }),
      },
      {
        table: "rd_opportunity_events",
        value: expect.objectContaining({ kind: "created", to_value: "NEW" }),
      },
      {
        table: "rnd_notifications",
        value: expect.objectContaining({
          title: "New Software On Demand request",
          message: `${result.requestId}: ${application.title}`,
        }),
      },
    ]);
  });
  it("creates private signed PDF uploads and preserves their attachment metadata in the inbox", async () => {
    const [slot] = await createAttachmentUploads({
      data: { files: [{ name: "software brief.pdf", size: 1024 }] },
    });
    expect(slot.path).toMatch(/^pending\/[0-9a-f-]{36}\/0-software_brief.pdf$/);
    expect(slot.token).toBe("isolated-upload-token");
    const attachment = {
      path: slot.path,
      name: "software brief.pdf",
      size: 1024,
      type: "application/pdf",
    };
    await submitOpportunity({ data: { ...application, attachments: [attachment] } });
    expect(state.writes[0].value).toEqual(expect.objectContaining({ attachments: [attachment] }));
    expect(state.guard).not.toHaveBeenCalled();
  });
  it("rejects oversized attachments before asking storage for upload tokens", async () => {
    await expect(
      createAttachmentUploads({
        data: { files: [{ name: "large.pdf", size: MAX_ATTACHMENT_BYTES + 1 }] },
      }),
    ).rejects.toThrow();
    expect(state.sign).not.toHaveBeenCalled();
  });
  it("uploads the actual PDF through the server's private storage adapter", async () => {
    const form = new FormData();
    const path = "pending/c733350b-27f5-424e-9b21-f6b837c48018/0-brief.pdf";
    const file = new File(["%PDF-1.4\nfixture"], "brief.pdf", { type: "application/pdf" });
    form.set("path", path);
    form.set("token", "isolated-token");
    form.set("file", file);
    expect(await uploadOpportunityAttachment({ data: form })).toEqual({ path });
    expect(state.upload).toHaveBeenCalledWith(path, "isolated-token", file, {
      contentType: "application/pdf",
    });
    expect(state.guard).not.toHaveBeenCalled();
  });
  it.each(["missing-file", "empty-file", "invalid-path", "missing-token"])(
    "refuses %s upload data before storage access",
    async (kind) => {
      const form = new FormData();
      form.set(
        "path",
        kind === "invalid-path"
          ? "../outside.pdf"
          : "pending/c733350b-27f5-424e-9b21-f6b837c48018/0-brief.pdf",
      );
      if (kind !== "missing-token") form.set("token", "isolated-token");
      if (kind !== "missing-file")
        form.set("file", new File(kind === "empty-file" ? [] : ["%PDF-1.4"], "brief.pdf"));
      await expect(uploadOpportunityAttachment({ data: form })).rejects.toThrow();
      expect(state.upload).not.toHaveBeenCalled();
    },
  );
  it("keeps email matching exact, including underscores, for public status lookup", async () => {
    state.tracked = true;
    expect(
      await trackOpportunity({ data: { requestId: "sv-rd-abcdef", email: application.email } }),
    ).toEqual(expect.objectContaining({ found: true, title: application.title }));
    expect(state.filters).toContainEqual(["contact_email", "applicant_1@fixture.invalid"]);
    expect(state.guard).not.toHaveBeenCalled();
  });
  it("does not expose a request when ID/email does not match", async () => {
    expect(
      await trackOpportunity({ data: { requestId: "SV-RD-ABCDEF", email: application.email } }),
    ).toEqual({ found: false });
  });
  it("retains authentication on manager inbox and attachment downloads", async () => {
    await expect(listOpportunities()).rejects.toThrow("Control Panel");
    await expect(
      getAttachmentUrl({ data: { path: "pending/fixture/private.pdf" } }),
    ).rejects.toThrow("Control Panel");
    expect(state.writes).toHaveLength(0);
  });
  it("fails closed on database throttle/duplicate check errors", async () => {
    state.checkError = true;
    await expect(submitOpportunity({ data: application })).rejects.toThrow("Could not validate");
    expect(state.writes).toHaveLength(0);
    expect(console.error).toHaveBeenCalled();
  });
  it("does not silently claim admin notification success after a partial database failure", async () => {
    state.notificationError = true;
    await expect(submitOpportunity({ data: application })).rejects.toThrow(
      /Request SV-RD-[A-Z0-9]{6} was saved/,
    );
    expect(console.error).toHaveBeenCalled();
    expect(state.writes.filter((write) => write.table === "rd_opportunities")).toHaveLength(1);
  });
  it.each(["duplicate", "count"] as const)(
    "rejects %s submissions without another write",
    async (kind) => {
      if (kind === "duplicate") state.duplicate = true;
      else state.count = 5;
      await expect(submitOpportunity({ data: application })).rejects.toThrow();
      expect(state.writes).toHaveLength(0);
    },
  );
  it("throttles public submission, upload tokens and tracking before database access", async () => {
    state.blocked = true;
    await expect(submitOpportunity({ data: application })).rejects.toThrow("Too many requests");
    await expect(
      createAttachmentUploads({ data: { files: [{ name: "brief.pdf", size: 12 }] } }),
    ).rejects.toThrow("Too many requests");
    await expect(
      trackOpportunity({ data: { requestId: "SV-RD-ABCDEF", email: application.email } }),
    ).rejects.toThrow("Too many requests");
    expect(state.writes).toHaveLength(0);
    expect(state.sign).not.toHaveBeenCalled();
  });
  it("rejects honeypots and invalid contact/requirements before writing", async () => {
    await expect(
      submitOpportunity({ data: { ...application, website_hp: "bot" } }),
    ).rejects.toThrow();
    await expect(
      submitOpportunity({ data: { ...application, email: "invalid", need: "" } }),
    ).rejects.toThrow();
    expect(state.writes).toHaveLength(0);
  });
});
