/**
 * Browser-only, read-only scan of a software library folder (e.g. the 2 TB SSD).
 * Reads manifest files locally to describe each codebase; only metadata
 * (name, stack, features, counts, manifest hash) is sent to the server.
 * No file is written, and no source code leaves the machine.
 */
type Dir = FileSystemDirectoryHandle & { values(): AsyncIterable<FileSystemHandle> };

export type ScannedItem = {
  name: string;
  version: string;
  relPath: string;
  stack: string[];
  features: string[];
  fileCount: number;
  sizeBytes: number;
  manifestSha256: string;
};

const SKIP = new Set(["node_modules", ".git", "vendor", "dist", "build", ".next", "__pycache__", ".venv", "venv", "cache", "logs"]);
const MANIFESTS = ["package.json", "composer.json", "requirements.txt", "pyproject.toml", "pom.xml", "build.gradle", "go.mod", "Gemfile", "pubspec.yaml", "wp-config.php", "artisan", "manage.py"];
const STACKS: [RegExp, string][] = [
  [/laravel/i, "laravel"], [/"next"/i, "next.js"], [/"react"/i, "react"], [/"vue"/i, "vue"], [/angular/i, "angular"],
  [/express/i, "express"], [/django/i, "django"], [/flask/i, "flask"], [/codeigniter/i, "codeigniter"],
  [/wordpress|wp-config/i, "wordpress"], [/flutter/i, "flutter"], [/spring/i, "spring"], [/rails/i, "rails"],
  [/mysql|mariadb/i, "mysql"], [/postgres/i, "postgresql"], [/mongo/i, "mongodb"], [/sqlite/i, "sqlite"],
];
const FEATURES = ["pos", "inventory", "billing", "invoice", "gst", "cart", "checkout", "payment", "crm", "hrm", "payroll", "attendance", "school", "student", "exam", "fees", "hospital", "pharmacy", "restaurant", "hotel", "booking", "ecommerce", "multi vendor", "blog", "chat", "delivery", "report", "dashboard", "barcode", "whatsapp", "sms", "otp", "admin", "parent"];
const MAX_FILES_PER_ITEM = 50_000;

async function readText(dir: Dir, name: string, max = 40_000) {
  try {
    const f = await (await dir.getFileHandle(name)).getFile();
    return await f.slice(0, max).text();
  } catch {
    return "";
  }
}

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** File list fingerprint: sorted "path size mtime" lines, hashed. Detects any change to the codebase. */
async function inventory(dir: Dir) {
  const lines: string[] = [];
  let size = 0;
  const walk = async (d: Dir, p: string) => {
    for await (const h of d.values()) {
      if (lines.length >= MAX_FILES_PER_ITEM) return;
      const rel = p ? `${p}/${h.name}` : h.name;
      if (h.kind === "directory") {
        if (!SKIP.has(h.name)) await walk(h as Dir, rel);
      } else {
        const f = await (h as FileSystemFileHandle).getFile();
        size += f.size;
        lines.push(`${rel}\t${f.size}\t${f.lastModified}`);
      }
    }
  };
  await walk(dir, "");
  lines.sort();
  return { fileCount: lines.length, sizeBytes: size, manifestSha256: await sha256Hex(lines.join("\n")) };
}

async function describe(dir: Dir, relPath: string, names: Set<string>): Promise<ScannedItem> {
  const manifest = (await readText(dir, "package.json")) || (await readText(dir, "composer.json"));
  const py = (await readText(dir, "requirements.txt")) + (await readText(dir, "pyproject.toml"));
  const readme = [...names].find((n) => /^readme/i.test(n));
  const readmeText = readme ? await readText(dir, readme, 8_000) : "";
  let meta: { name?: string; version?: string; description?: string } = {};
  try {
    meta = JSON.parse(manifest || "{}");
  } catch {
    /* not JSON */
  }
  const blob = [manifest, py, readmeText, [...names].join(" ")].join("\n");
  const stack = new Set<string>();
  if (names.has("package.json")) stack.add("javascript");
  if (names.has("tsconfig.json")) stack.add("typescript");
  if (names.has("composer.json") || [...names].some((n) => n.endsWith(".php"))) stack.add("php");
  if (py || names.has("manage.py")) stack.add("python");
  if (names.has("pubspec.yaml")) stack.add("dart");
  if (names.has("pom.xml") || names.has("build.gradle")) stack.add("java");
  if (names.has("go.mod")) stack.add("go");
  for (const [r, s] of STACKS) if (r.test(blob)) stack.add(s);
  const text = `${relPath.replace(/[-_./]+/g, " ")} ${meta.description ?? ""} ${readmeText}`.toLowerCase();
  const folder = relPath.split("/").pop() || relPath;
  return {
    name: meta.name && !meta.name.includes("/") ? meta.name : folder,
    version: meta.version ?? "",
    relPath,
    stack: [...stack],
    features: FEATURES.filter((f) => text.includes(f)),
    ...(await inventory(dir)),
  };
}

export async function scanLibrary(root: Dir, onProgress: (dirs: number, found: number) => void, maxDepth = 4) {
  const found: ScannedItem[] = [];
  let dirs = 0;
  const walk = async (dir: Dir, path: string, depth: number) => {
    dirs++;
    if (dirs % 20 === 0) onProgress(dirs, found.length);
    const names = new Set<string>();
    const subs: Dir[] = [];
    for await (const h of dir.values()) {
      if (h.kind === "file") names.add(h.name);
      else if (!SKIP.has(h.name) && !h.name.startsWith(".")) subs.push(h as Dir);
    }
    if (depth > 0 && MANIFESTS.some((m) => names.has(m))) {
      found.push(await describe(dir, path, names));
      return;
    }
    if (depth >= maxDepth || found.length >= 2000) return;
    for (const s of subs) await walk(s, path ? `${path}/${s.name}` : s.name, depth + 1);
  };
  await walk(root, "", 0);
  onProgress(dirs, found.length);
  return found;
}

export const canPickFolders = () => typeof window !== "undefined" && "showDirectoryPicker" in window;
export const pickFolder = () =>
  (window as unknown as { showDirectoryPicker: (o?: object) => Promise<Dir> }).showDirectoryPicker({ mode: "read" });
