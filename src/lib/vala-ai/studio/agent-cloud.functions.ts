import { studioOperator, studioViewer } from "@/lib/vala-ai/studio/auth.functions";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Build links remain private to the authenticated Control Panel operator.
const id = z.string().uuid();

export const saveBuildFn = createServerFn({ method: "POST" })
  .middleware([studioOperator])
  .inputValidator((d: unknown) =>
    z.object({ id: id.optional(), data: z.string().max(600_000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data.data);
    } catch {
      throw new Error("Invalid build data.");
    }
    const { studioStore } = await import("./store.server");
    const supabaseAdmin = studioStore(context.studioOperator);
    const now = new Date().toISOString();
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("agent_builds")
        .upsert({ id: data.id, data: parsed as never, updated_at: now });
      if (error) throw new Error("Cloud save failed.");
      return { id: data.id };
    }
    const { data: row, error } = await supabaseAdmin
      .from("agent_builds")
      .insert({ data: parsed as never })
      .select("id")
      .single();
    if (error || !row) throw new Error("Cloud save failed.");
    return { id: row.id };
  });

export const loadBuildFn = createServerFn({ method: "POST" })
  .middleware([studioViewer])
  .inputValidator((d: unknown) => z.object({ id }).parse(d))
  .handler(async ({ data, context }) => {
    const { studioStore } = await import("./store.server");
    const supabaseAdmin = studioStore(context.studioOperator);
    const { data: row, error } = await supabaseAdmin
      .from("agent_builds")
      .select("data, updated_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error("Cloud load failed.");
    return row ? { json: JSON.stringify(row.data) } : null;
  });
