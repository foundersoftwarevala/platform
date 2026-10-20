import { beforeEach, describe, expect, it, vi } from "vitest";
import { APPLICATION_KINDS, isApplicationKind } from "./kinds";
import { getRole } from "./config";

const gateway = vi.hoisted(() => ({ rest: vi.fn(), rpc: vi.fn() }));
vi.mock("./gateway.server", () => ({ serviceRest: gateway.rest, rpcAs: gateway.rpc }));
import { countApplications, definitionOf, listApplications } from "./registry.server";
import { submitApplication } from "./submit.server";

beforeEach(() => vi.resetAllMocks());

describe("application registry", () => {
  it.each(APPLICATION_KINDS)(
    "wires %s to a real form, table and authenticated decision RPC",
    (kind) => {
      expect(isApplicationKind(kind)).toBe(true);
      expect(getRole(kind)?.sections.length).toBeGreaterThan(0);
      const definition = definitionOf(kind);
      expect(definition.table).toBeTruthy();
      expect(definition.review("id", definition.approvedStatus, null).fn).toBeTruthy();
    },
  );
  it("refuses unknown roles", () => expect(isApplicationKind("administrator")).toBe(false));
  it("counts exact pending totals above the REST row cap, with separate seller scopes", async () => {
    gateway.rest.mockImplementation(async (_url: string, options: RequestInit) => {
      expect(options.method).toBe("HEAD");
      expect(options.headers).toEqual({ Prefer: "count=exact" });
      return new Response(null, { headers: { "Content-Range": "*/1250" } });
    });
    const counts = await countApplications();
    expect(counts.total).toBe(8750);
    expect(counts.byRole.map((row) => row.kind)).toEqual(APPLICATION_KINDS);
    const urls = gateway.rest.mock.calls.map(([url]) => String(url));
    expect(urls).toContain(
      "marketplace_sellers?select=id&status=in.(pending,in_review)&seller_kind=eq.vendor",
    );
    expect(urls).toContain(
      "marketplace_sellers?select=id&status=in.(pending,in_review)&seller_kind=eq.author",
    );
  });
  it.each([null, "*/a", "*/*", "*/9007199254740992"])(
    "does not invent a zero for invalid count %s",
    async (range) => {
      gateway.rest.mockResolvedValue(
        new Response(null, {
          headers: range ? { "Content-Range": range } : {},
        }),
      );
      await expect(countApplications()).rejects.toThrow(/count/);
    },
  );
  it("surfaces a missing table or unavailable database", async () => {
    gateway.rest.mockResolvedValue(new Response(null, { status: 404 }));
    await expect(countApplications()).rejects.toThrow(/could not be read/);
  });
  it("reads every open application beyond 1,000 with stable page ordering", async () => {
    gateway.rest.mockImplementation(async (url: string) => {
      const offset = Number(new URL(`https://fixture.invalid/${url}`).searchParams.get("offset"));
      expect(url).toContain("order=created_at.desc,id.desc");
      return Response.json(
        Array.from({ length: offset === 0 ? 1000 : 1 }, (_, index) => ({
          id: `employee-${offset + index}`,
          status: "pending",
          full_name: "Fixture",
          application_number: `SVE-${offset + index}`,
          created_at: "2026-10-16T00:00:00Z",
        })),
      );
    });
    const rows = await listApplications(["employee"], true);
    expect(rows).toHaveLength(1001);
    expect(new Set(rows.map((row) => row.id)).size).toBe(1001);
    expect(gateway.rest).toHaveBeenCalledTimes(2);
  });
  it("does not return a partial pending queue after a later page fails", async () => {
    gateway.rest
      .mockResolvedValueOnce(Response.json(Array.from({ length: 1000 }, (_, id) => ({ id }))))
      .mockResolvedValueOnce(new Response(null, { status: 503 }));
    await expect(listApplications(["employee"], true)).rejects.toThrow(/503/);
  });
});

describe("employee submission", () => {
  const answers = {
    fullName: "Fixture Applicant",
    email: "applicant@fixture.invalid",
    phone: "+91 90000 12345",
    country: "India",
    idType: "PAN",
    department: "Engineering",
    position: "Developer",
    totalExperience: "0",
    skills: "TypeScript",
  };
  it("submits validated answers as the applicant without granting a role", async () => {
    gateway.rpc.mockResolvedValue({
      ok: true,
      data: {
        id: "fixture-id",
        application_number: "SVE-FIXTURE",
        status: "pending",
        duplicate: false,
      },
    });
    const result = await submitApplication(
      "employee",
      {
        ...answers,
        accountNumber: "must-not-be-kept",
        resume: "not-a-file",
        role: "admin",
      },
      true,
      "fixture-token",
      "fixture-user",
    );
    expect(result).toMatchObject({ kind: "employee", status: "pending", number: "SVE-FIXTURE" });
    expect(gateway.rpc).toHaveBeenCalledWith("fixture-token", "submit_employee_application", {
      p_application: { ...answers, agreementAccepted: true },
    });
    expect(gateway.rest).not.toHaveBeenCalled();
  });
  it("requires agreement and required form fields", async () => {
    expect(await submitApplication("employee", answers, false, "token", "user")).toMatchObject({
      status: 400,
    });
    expect(await submitApplication("employee", {}, true, "token", "user")).toMatchObject({
      status: 400,
    });
    expect(gateway.rpc).not.toHaveBeenCalled();
  });
  it("surfaces the authenticated database's refusal", async () => {
    gateway.rpc.mockResolvedValue({ ok: false, status: 403, message: "Sign in to apply" });
    expect(await submitApplication("employee", answers, true, "token", "user")).toEqual({
      status: 403,
      error: "Sign in to apply",
    });
  });
});
