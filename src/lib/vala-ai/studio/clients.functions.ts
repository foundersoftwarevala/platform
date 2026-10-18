import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { studioOperator } from "./auth.functions";

export const studioClientInput = z.object({
  id: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(300),
  email: z.string().email().max(300).nullish(),
  phone: z.string().max(50).nullish(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export const syncControlPanelClientFn = createServerFn({ method: "POST" })
  .middleware([studioOperator])
  .inputValidator((data: unknown) => studioClientInput.parse(data))
  .handler(async ({ data }) => {
    const { upsertClient } = await import("./developer/developer.server");
    const client = await upsertClient({
      external_id: `cp:${data.id}`,
      name: data.name,
      email: data.email,
      phone: data.phone,
      data: data.data,
      source: "control_panel",
    });
    return { ok: true, client_id: client.id };
  });
