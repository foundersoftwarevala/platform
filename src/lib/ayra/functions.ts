import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getAyraLiveFeed = createServerFn({ method: "GET" }).handler(async () => {
  const { loadAyraLiveFeed } = await import("./core.server");
  return loadAyraLiveFeed();
});

export const askAyra = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ prompt: z.string().trim().min(1).max(4000) }).strict().parse(input),
  )
  .handler(async ({ data }) => {
    const { askAyra: ask } = await import("./core.server");
    return ask(data.prompt);
  });
