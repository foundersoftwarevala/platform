import { isIP } from "node:net";
import { z } from "zod";

import { deploymentSetting } from "@/lib/seo/seo-store.server";
import { withVpsPublicDatabase } from "@/lib/marketplace-manager/vps-rpc.server";

const VECTOR_DIMENSIONS = 1536;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EmbeddingResponseSchema = z.object({
  embeddings: z.array(z.array(z.number().finite())).min(1).max(1),
});

function localEmbedUrl(): { url: string; model: string } | null {
  const model = deploymentSetting("AYRA_EMBEDDING_MODEL");
  if (!model) return null;
  const url = new URL(deploymentSetting("OLLAMA_BASE_URL") || "http://127.0.0.1:11434");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const ipVersion = isIP(host);
  const privateHost =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "ollama" ||
    (ipVersion === 4 &&
      (host.startsWith("10.") ||
        host.startsWith("192.168.") ||
        (host.startsWith("172.") &&
          Number(host.split(".")[1]) >= 16 &&
          Number(host.split(".")[1]) <= 31))) ||
    (ipVersion === 6 &&
      (host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:")));
  if (url.protocol !== "http:" || !privateHost || url.username || url.password) {
    throw new Error("AYRA embeddings must use a local Ollama endpoint.");
  }
  url.pathname = "/api/embed";
  url.search = "";
  url.hash = "";
  return { url: url.toString(), model };
}

export async function createLocalAyraEmbedding(
  text: string,
): Promise<{ model: string; vector: number[] } | null> {
  const config = localEmbedUrl();
  if (!config) return null;
  const response = await fetch(config.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: config.model, input: text, dimensions: VECTOR_DIMENSIONS }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(
      `Local AYRA embedding failed (${response.status}): ${detail || response.statusText}`,
    );
  }
  const parsed = EmbeddingResponseSchema.parse(await response.json());
  const vector = parsed.embeddings[0];
  if (!vector || vector.length !== VECTOR_DIMENSIONS) {
    throw new Error(`AYRA embedding model must return exactly ${VECTOR_DIMENSIONS} dimensions.`);
  }
  return { model: config.model, vector };
}

export type AyraMemoryFact = { id: string; content: string; similarity: number; createdAt: string };
export type AyraMemoryRecall =
  | { status: "ready"; facts: AyraMemoryFact[] }
  | { status: "not_configured"; facts: []; reason: string };

export async function rememberFact(
  userId: string,
  content: string,
): Promise<{ id: string; createdAt: string }> {
  if (!UUID.test(userId)) throw new Error("A valid user is required to save AYRA memory.");
  const fact = content.trim();
  if (fact.length < 1 || fact.length > 2000)
    throw new Error("Memory must be between 1 and 2000 characters.");
  const embedded = await createLocalAyraEmbedding(fact);
  if (!embedded)
    throw new Error(
      "AYRA memory is not configured: set AYRA_EMBEDDING_MODEL to an installed local 1536-dimension Ollama embedding model.",
    );
  return withVpsPublicDatabase(async (tx) => {
    const [row] = await tx<{ id: string; created_at: string }[]>`
      insert into public.ayra_memory_vectors (user_id, content, embedding, embedding_model)
      values (${userId}::uuid, ${fact}, ${JSON.stringify(embedded.vector)}::vector, ${embedded.model})
      returning id::text, created_at::text
    `;
    if (!row) throw new Error("VPS Postgres did not return the saved AYRA memory fact.");
    return { id: row.id, createdAt: row.created_at };
  });
}

export async function recallFacts(userId: string, query: string): Promise<AyraMemoryRecall> {
  if (!UUID.test(userId)) throw new Error("A valid user is required to read AYRA memory.");
  const search = query.trim().slice(0, 2000);
  if (!search) return { status: "ready", facts: [] };
  const embedded = await createLocalAyraEmbedding(search);
  if (!embedded) {
    return {
      status: "not_configured",
      facts: [],
      reason:
        "Set AYRA_EMBEDDING_MODEL to an installed local 1536-dimension Ollama embedding model.",
    };
  }
  const facts = await withVpsPublicDatabase(
    (tx) => tx<
      {
        id: string;
        content: string;
        similarity: number;
        created_at: string;
      }[]
    >`
    select id::text, content, (1 - (embedding <=> ${JSON.stringify(embedded.vector)}::vector))::float8 as similarity,
           created_at::text
      from public.ayra_memory_vectors
     where user_id = ${userId}::uuid
     order by embedding <=> ${JSON.stringify(embedded.vector)}::vector, created_at desc
     limit 5
  `,
  );
  return {
    status: "ready",
    facts: facts.map((fact) => ({
      id: fact.id,
      content: fact.content,
      similarity: fact.similarity,
      createdAt: fact.created_at,
    })),
  };
}

export async function recordMemoryAction(
  userId: string,
  context: string,
  actionTaken: string,
  result: string,
  feedbackScore?: number,
): Promise<void> {
  if (!UUID.test(userId)) throw new Error("A valid user is required to record AYRA memory.");
  const fields = [context.trim(), actionTaken.trim(), result.trim()];
  if (
    fields[0].length < 1 ||
    fields[0].length > 2000 ||
    fields[1].length < 1 ||
    fields[1].length > 1000 ||
    fields[2].length < 1 ||
    fields[2].length > 2000
  ) {
    throw new Error("AYRA action memory fields exceed their allowed lengths.");
  }
  if (
    feedbackScore !== undefined &&
    (!Number.isInteger(feedbackScore) || feedbackScore < 0 || feedbackScore > 100)
  ) {
    throw new Error("AYRA feedback must be an integer from 0 to 100.");
  }
  await withVpsPublicDatabase(
    (tx) => tx`
    insert into public.ayra_memory (user_id, context, action_taken, result, feedback_score)
    values (${userId}::uuid, ${fields[0]}, ${fields[1]}, ${fields[2]}, ${feedbackScore ?? null})
  `,
  );
}

export type AyraStoredFact = { id: string; content: string; createdAt: string };

export async function listRememberedFacts(userId: string): Promise<AyraStoredFact[]> {
  if (!UUID.test(userId)) throw new Error("A valid user is required to list AYRA memory.");
  const facts = await withVpsPublicDatabase(
    (tx) => tx<{ id: string; content: string; created_at: string }[]>`
      select id::text, content, created_at::text
        from public.ayra_memory_vectors
       where user_id = ${userId}::uuid
       order by created_at desc
       limit 100
    `,
  );
  return facts.map((fact) => ({ id: fact.id, content: fact.content, createdAt: fact.created_at }));
}

export async function forgetFact(userId: string, id: string): Promise<boolean> {
  if (!UUID.test(userId) || !UUID.test(id))
    throw new Error("Valid user and memory IDs are required.");
  const rows = await withVpsPublicDatabase(
    (tx) => tx<{ id: string }[]>`
    delete from public.ayra_memory_vectors
     where id = ${id}::uuid and user_id = ${userId}::uuid
    returning id::text
  `,
  );
  return rows.length > 0;
}
