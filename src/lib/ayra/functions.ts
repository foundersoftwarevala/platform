import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getAyraLiveFeed = createServerFn({ method: "GET" }).handler(async () => {
  const { loadAyraLiveFeed } = await import("./core.server");
  return loadAyraLiveFeed();
});

export const askAyra = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ prompt: z.string().trim().min(1).max(4000) })
      .strict()
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { askAyra: ask } = await import("./core.server");
    return ask(data.prompt);
  });

export const getAyraCommandSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { getAyraCommandSettings: get } = await import("./command-settings.server");
  return get();
});

export const saveAyraCommandSettings = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        brightness: z.number().int().min(0).max(100),
        liveReactions: z.boolean(),
        motionEnabled: z.boolean(),
      })
      .strict()
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { saveAyraCommandSettings: save } = await import("./command-settings.server");
    return save(data);
  });
