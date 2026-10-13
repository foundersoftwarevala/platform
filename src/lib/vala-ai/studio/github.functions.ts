import { studioOperator } from "@/lib/vala-ai/studio/auth.functions";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const TEXT_EXT =
  /\.(tsx?|jsx?|mjs|cjs|css|scss|html|json|md|py|go|rs|java|kt|php|rb|vue|svelte|ya?ml|toml|sql|sh|env\.example)$/i;
const SKIP = /(^|\/)(node_modules|dist|build|\.next|\.git|vendor|coverage)\//;
const MAX_FILES = 40;
const MAX_FILE = 60_000;
const MAX_TOTAL = 300_000;

export const fetchGithubRepoFn = createServerFn({ method: "POST" })
  .middleware([studioOperator])
  .inputValidator((d: unknown) => z.object({ url: z.string().trim().min(1).max(500) }).parse(d))
  .handler(async ({ data }) => {
    const m = data.url.match(
      /github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/tree\/([^/]+)(?:\/(.*))?)?\/?$/i,
    );
    if (!m)
      throw new Error("GitHub repo ka URL sahi nahi hai. Jaise: https://github.com/owner/repo");
    const [, owner, repo, branchIn, subdir] = m;
    const headers = {
      Accept: "application/vnd.github+json",
      "User-Agent": "software-vala-factory",
    };
    const gh = async (path: string) => {
      const r = await fetch(`https://api.github.com/${path}`, {
        headers,
        signal: AbortSignal.timeout(15000),
      });
      if (r.status === 404) throw new Error("Repo nahi mila — kya ye public hai?");
      if (r.status === 403 || r.status === 429)
        throw new Error("GitHub ne abhi rok diya (limit). Thodi der baad try karein.");
      if (!r.ok) throw new Error(`GitHub error ${r.status}`);
      return r.json() as Promise<unknown>;
    };
    const branch =
      branchIn ||
      z.object({ default_branch: z.string() }).parse(await gh(`repos/${owner}/${repo}`))
        .default_branch;
    const tree = z
      .object({
        truncated: z.boolean().optional(),
        tree: z.array(
          z.object({ path: z.string(), type: z.string(), size: z.number().optional() }),
        ),
      })
      .parse(
        await gh(`repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`),
      );
    const prefix = subdir ? subdir.replace(/\/$/, "") + "/" : "";
    const candidates = tree.tree
      .filter(
        (t) =>
          t.type === "blob" &&
          t.path.startsWith(prefix) &&
          TEXT_EXT.test(t.path) &&
          !SKIP.test(t.path) &&
          (t.size ?? 0) < MAX_FILE &&
          !/lock\.(json|yaml)$|\.lock$/.test(t.path),
      )
      .sort(
        (a, b) =>
          Number(/^src\//.test(b.path)) - Number(/^src\//.test(a.path)) ||
          a.path.length - b.path.length,
      )
      .slice(0, MAX_FILES);
    const files: { name: string; content: string }[] = [];
    let total = 0;
    for (const f of candidates) {
      const r = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${f.path.split("/").map(encodeURIComponent).join("/")}`,
        { signal: AbortSignal.timeout(15000) },
      );
      if (!r.ok)
        throw new Error(`GitHub file ${f.path} returned HTTP ${r.status}; import is incomplete.`);
      const content = await r.text();
      if (total + content.length > MAX_TOTAL) break;
      total += content.length;
      files.push({ name: `github:${f.path}`, content });
    }
    return {
      repo: `${owner}/${repo}`,
      branch,
      files,
      totalInRepo: tree.tree.length,
      truncated: Boolean(tree.truncated) || candidates.length === MAX_FILES || total >= MAX_TOTAL,
    };
  });
