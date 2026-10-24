import { mergeConfig } from "vite";
import { defineConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default defineConfig(async (environment) =>
  mergeConfig(await viteConfig(environment), {
    test: {
      coverage: {
        provider: "v8",
        include: [
          "src/lib/marketplace/author-guard.ts",
          "src/lib/influencer/analytics.ts",
          "src/routes/api/marketplace/media.ts",
        ],
        reporter: ["text-summary"],
        thresholds: {
          lines: 50,
        },
      },
    },
  }),
);
