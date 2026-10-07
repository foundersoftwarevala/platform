// `NITRO_PRESET=node-server vite build`, in a form every shell runs (Windows
// npm scripts run under cmd, which cannot set a variable inline).
//
// It must build the whole app - client, SSR and the Nitro server - exactly as
// the `vite build` command does. Vite's programmatic build() builds only the
// default (client) environment and leaves no .output/server, which the deploy
// script then rightly refuses; createBuilder().buildApp() is what the CLI runs.
import { createBuilder } from "vite";

process.env.NITRO_PRESET ??= "node-server";

const builder = await createBuilder({}, null);
await builder.buildApp();
