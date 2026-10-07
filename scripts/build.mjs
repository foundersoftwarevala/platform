import { build } from "vite";

process.env.NITRO_PRESET ??= "node-server";

await build();
