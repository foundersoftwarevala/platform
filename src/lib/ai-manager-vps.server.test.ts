import { afterEach, describe, expect, it, vi } from "vitest";

import { encryptAiCredential } from "./ai-credentials.server";
import { requestVpsAiCompletion } from "./ai-manager-vps.server";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("VPS AI API Manager routing and metering", () => {
  const service = {
    id: "00000000-0000-4000-8000-000000000001",
    name: "OpenAI API",
    slug: "openai-api",
    provider_id: "00000000-0000-4000-8000-000000000002",
    provider_name: "OpenAI",
    provider_slug: "openai",
    endpoint_url: "https://api.openai.com/v1/chat/completions",
  };
  const model = {
    id: "00000000-0000-4000-8000-000000000003",
    model_id: "gpt-4o-mini",
    input_cost_per_1k: "0.00015",
    output_cost_per_1k: "0.0006",
  };

  function fixtureRunner(
    keys: { id: string; secret_encrypted: string; expires_at?: string | null }[],
  ) {
    const queries: { sql: string; values: unknown[] }[] = [];
    const tx = async <Rows extends unknown[]>(
      strings: TemplateStringsArray,
      ...values: unknown[]
    ): Promise<Rows> => {
      const sql = strings.join("?");
      queries.push({ sql, values });
      if (sql.includes("from public.api_services")) return [service] as Rows;
      if (sql.includes("from public.ai_models")) return [model] as Rows;
      if (sql.includes("from public.api_keys")) {
        const excluded = values.filter(Array.isArray).flat();
        return keys
          .filter(
            (key) =>
              !excluded.includes(key.id) &&
              (!key.expires_at || new Date(key.expires_at).getTime() > Date.now()),
          )
          .slice(0, 1) as Rows;
      }
      return [] as unknown as Rows;
    };
    const withDatabase = <T>(run: (database: typeof tx) => Promise<T>) => run(tx as never);
    return { queries, withDatabase: withDatabase as never };
  }

  it("marks an HTTP 401 credential invalid and tries a different active account", async () => {
    vi.stubEnv("AI_API_CREDENTIAL_ENCRYPTION_KEY", "22".repeat(32));
    const runner = fixtureRunner([
      {
        id: "00000000-0000-4000-8000-000000000010",
        secret_encrypted: encryptAiCredential("first-key"),
      },
      {
        id: "00000000-0000-4000-8000-000000000011",
        secret_encrypted: encryptAiCredential("second-key"),
      },
    ]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "Invalid key" } }), { status: 401 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "Succeeded with the other account." } }],
            usage: { prompt_tokens: 8, completion_tokens: 4 },
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      requestVpsAiCompletion({
        withDatabase: runner.withDatabase,
        serviceName: "OpenAI API",
        modelId: "gpt-4o-mini",
        product: "test",
        source: "unit-test",
        system: "Test.",
        prompt: "Say OK.",
      }),
    ).resolves.toMatchObject({ text: "Succeeded with the other account." });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const invalidation = runner.queries.find(
      ({ sql }) =>
        sql.includes("update public.api_keys") && sql.includes("health_status = 'invalid'"),
    );
    expect(invalidation?.values).toContain("00000000-0000-4000-8000-000000000010");
    expect(
      runner.queries.filter(({ sql }) => sql.includes("insert into public.usage_events")),
    ).toHaveLength(2);
  });

  it("records HTTP 429 cooldown guidance and never switches accounts", async () => {
    vi.stubEnv("AI_API_CREDENTIAL_ENCRYPTION_KEY", "33".repeat(32));
    const runner = fixtureRunner([
      {
        id: "00000000-0000-4000-8000-000000000010",
        secret_encrypted: encryptAiCredential("first-key"),
      },
      {
        id: "00000000-0000-4000-8000-000000000011",
        secret_encrypted: encryptAiCredential("second-key"),
      },
    ]);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "Rate limited" } }), {
        status: 429,
        headers: { "retry-after": "30" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      requestVpsAiCompletion({
        withDatabase: runner.withDatabase,
        serviceName: "OpenAI API",
        modelId: "gpt-4o-mini",
        product: "test",
        source: "unit-test",
        system: "Test.",
        prompt: "Say OK.",
      }),
    ).rejects.toThrow("Rate limited");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const throttle = runner.queries.find(
      ({ sql }) =>
        sql.includes("update public.api_keys") && sql.includes("health_status = 'throttled'"),
    );
    expect(throttle?.values).toContain("00000000-0000-4000-8000-000000000010");
    expect(
      throttle?.values.some((value) => String(value).includes("No account failover was attempted")),
    ).toBe(true);
  });

  it("does not select expired credentials", async () => {
    vi.stubEnv("AI_API_CREDENTIAL_ENCRYPTION_KEY", "44".repeat(32));
    const runner = fixtureRunner([
      {
        id: "00000000-0000-4000-8000-000000000010",
        secret_encrypted: encryptAiCredential("expired-key"),
        expires_at: "2020-01-01T00:00:00.000Z",
      },
    ]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      requestVpsAiCompletion({
        withDatabase: runner.withDatabase,
        serviceName: "OpenAI API",
        modelId: "gpt-4o-mini",
        product: "test",
        source: "unit-test",
        system: "Test.",
        prompt: "Say OK.",
      }),
    ).rejects.toThrow("No active production credential");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(runner.queries.some(({ sql }) => sql.includes("expires_at > now()"))).toBe(true);
  });

  it("bounds consecutive HTTP 401 credential failovers", async () => {
    vi.stubEnv("AI_API_CREDENTIAL_ENCRYPTION_KEY", "55".repeat(32));
    const runner = fixtureRunner(
      Array.from({ length: 10 }, (_, index) => ({
        id: `00000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`,
        secret_encrypted: encryptAiCredential(`fixture-key-${index}`),
      })),
    );
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ error: { message: "Invalid key" } }), { status: 401 }),
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      requestVpsAiCompletion({
        withDatabase: runner.withDatabase,
        serviceName: "OpenAI API",
        modelId: "gpt-4o-mini",
        product: "test",
        source: "unit-test",
        system: "Test.",
        prompt: "Say OK.",
      }),
    ).rejects.toThrow("Invalid key");

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("uses the active encrypted service key and records agent tokens and registered cost", async () => {
    vi.stubEnv("AI_API_CREDENTIAL_ENCRYPTION_KEY", "11".repeat(32));
    const secret = "fixture-only-provider-key";
    const queries: { sql: string; values: unknown[] }[] = [];
    const tx = async <Rows extends unknown[]>(
      strings: TemplateStringsArray,
      ...values: unknown[]
    ): Promise<Rows> => {
      const sql = strings.join("?");
      queries.push({ sql, values });
      if (sql.includes("from public.api_services")) {
        return [
          {
            id: "00000000-0000-4000-8000-000000000001",
            name: "OpenAI API",
            slug: "openai-api",
            provider_id: "00000000-0000-4000-8000-000000000002",
            provider_name: "OpenAI",
            provider_slug: "openai",
            endpoint_url: "https://api.openai.com/v1/chat/completions",
          },
        ] as Rows;
      }
      if (sql.includes("from public.ai_models")) {
        return [
          {
            id: "00000000-0000-4000-8000-000000000003",
            model_id: "gpt-4o-mini",
            input_cost_per_1k: "0.00015",
            output_cost_per_1k: "0.0006",
          },
        ] as Rows;
      }
      if (sql.includes("from public.api_keys")) {
        return [{ secret_encrypted: encryptAiCredential(secret) }] as Rows;
      }
      return [] as unknown as Rows;
    };
    const withDatabase = <T>(run: (database: typeof tx) => Promise<T>) => run(tx as never);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          model: "gpt-4o-mini",
          choices: [{ message: { content: "A private draft." } }],
          usage: { prompt_tokens: 1000, completion_tokens: 500 },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      requestVpsAiCompletion({
        withDatabase: withDatabase as never,
        serviceName: "OpenAI API",
        modelId: "gpt-4o-mini",
        agentId: "00000000-0000-4000-8000-000000000004",
        product: "agent:support-reply-drafter",
        source: "ai-agent-runner",
        system: "Be careful.",
        prompt: "Draft a response.",
      }),
    ).resolves.toEqual({
      text: "A private draft.",
      model: "gpt-4o-mini",
      service: "OpenAI API",
      tokensIn: 1000,
      tokensOut: 500,
    });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${secret}`);
    expect(init.redirect).toBe("error");
    const insert = queries.find(({ sql }) => sql.includes("insert into public.usage_events"));
    expect(insert?.sql).toContain("ai_agent_id");
    expect(insert?.values).toContain("00000000-0000-4000-8000-000000000004");
    expect(
      insert?.values.some(
        (value) => typeof value === "number" && Math.abs(value - 0.00045) < 1e-12,
      ),
    ).toBe(true);
    expect(insert?.values).toContain(1000);
    expect(insert?.values).toContain(500);
  });

  it("records local Ollama token usage at zero provider cost without sending authorization", async () => {
    const queries: { sql: string; values: unknown[] }[] = [];
    const tx = async <Rows extends unknown[]>(
      strings: TemplateStringsArray,
      ...values: unknown[]
    ): Promise<Rows> => {
      const sql = strings.join("?");
      queries.push({ sql, values });
      if (sql.includes("from public.api_services")) {
        return [
          {
            id: "00000000-0000-4000-8000-000000000001",
            name: "Ollama Local",
            slug: "ollama-local",
            provider_id: "00000000-0000-4000-8000-000000000002",
            provider_name: "Ollama Local",
            provider_slug: "ollama-local",
            endpoint_url: "http://127.0.0.1:11434/v1/chat/completions",
          },
        ] as Rows;
      }
      if (sql.includes("from public.ai_models")) {
        return [
          {
            id: "00000000-0000-4000-8000-000000000003",
            model_id: "qwen2.5:3b",
            input_cost_per_1k: "0",
            output_cost_per_1k: "0",
          },
        ] as Rows;
      }
      return [] as unknown as Rows;
    };
    const withDatabase = <T>(run: (database: typeof tx) => Promise<T>) => run(tx as never);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "A local draft." } }],
          usage: { prompt_tokens: 37, completion_tokens: 12 },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await requestVpsAiCompletion({
      withDatabase: withDatabase as never,
      serviceName: "Ollama Local",
      modelId: "qwen2.5:3b",
      agentId: "00000000-0000-4000-8000-000000000004",
      product: "agent:support-reply-drafter",
      source: "ai-agent-runner",
      system: "Be careful.",
      prompt: "Draft a response.",
    });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.headers).toEqual({ "content-type": "application/json" });
    const insert = queries.find(({ sql }) => sql.includes("insert into public.usage_events"));
    expect(insert?.values).toContain(0);
    expect(insert?.values).toContain(37);
    expect(insert?.values).toContain(12);
  });
});
