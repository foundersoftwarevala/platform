/**
 * Just enough module resolution to load the real source in a test.
 *
 * The code under test imports through the project's "@/" alias, which is a
 * bundler convention Node knows nothing about. Rather than reimplementing the
 * module — which would test the copy, not the code — this hook teaches Node the
 * one thing it is missing. Node strips the TypeScript types itself.
 *
 * Nothing here is used by the application. It exists only so a test can import
 * a source file directly.
 */

import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "src");

// The alias is written without a file extension, the way a bundler expects, so
// the candidates are tried in the order a bundler would try them.
const EXTENSIONS = ["", ".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.js"];

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const base = path.join(SRC, specifier.slice(2));
    for (const extension of EXTENSIONS) {
      const candidate = base + extension;
      if (extension !== "" && existsSync(candidate)) {
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }
    // Fall through to the plain path so the error names the file that is
    // genuinely missing rather than the last extension tried.
    return { url: pathToFileURL(base).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
