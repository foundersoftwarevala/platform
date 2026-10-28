import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireVpsExecutive } from "./vps-auth.server";
import { forgetFact, listRememberedFacts, rememberFact } from "./ayra-memory.server";

export const rememberAyraFact = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({ content: z.string().trim().min(1).max(2000) })
      .strict()
      .parse(input),
  )
  .handler(async ({ data }) => {
    const userId = await requireVpsExecutive();
    return rememberFact(userId, data.content);
  });

export const loadAyraMemoryFacts = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await requireVpsExecutive();
  return listRememberedFacts(userId);
});

export const forgetAyraFact = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).strict().parse(input))
  .handler(async ({ data }) => {
    const userId = await requireVpsExecutive();
    return { deleted: await forgetFact(userId, data.id) };
  });
