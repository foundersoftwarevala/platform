// Browser-only folder scanner. Reads manifest files locally and returns library metadata.
// Source code never leaves the machine during a scan.
type Dir = FileSystemDirectoryHandle & { values(): AsyncIterable<FileSystemHandle> };
export type ScannedItem = {
  source_key: string;
  name: string;
  category: string | null;
  modules: string[];
  features: string[];
  technology: string[];
  database_engine: string | null;
  framework: string | null;
  capabilities: string[];
  source_location: string;
  version: string | null;
  compatibility: string | null;
  known_requirements: string | null;
  metadata: Record<string, unknown>;
};

const SKIP = new Set([
  "node_modules",
  ".git",
  "vendor",
  "dist",
  "build",
  ".next",
  "__pycache__",
  ".venv",
  "venv",
  "storage",
  "cache",
  "logs",
]);
const MANIFESTS = [
  "package.json",
  "composer.json",
  "requirements.txt",
  "pyproject.toml",
  "pom.xml",
  "build.gradle",
  "go.mod",
  "Gemfile",
  "pubspec.yaml",
  "wp-config.php",
  "artisan",
  "index.php",
  "manage.py",
];
const TEXT_EXT =
  /\.(html?|css|scss|js|jsx|ts|tsx|json|php|py|rb|go|java|kt|dart|vue|svelte|md|txt|ya?ml|xml|env\.example|sql|ini|toml)$/i;

const FRAMEWORKS: [RegExp, string][] = [
  [/laravel/i, "laravel"],
  [/next/i, "next.js"],
  [/react/i, "react"],
  [/vue/i, "vue"],
  [/angular/i, "angular"],
  [/express/i, "express"],
  [/django/i, "django"],
  [/flask/i, "flask"],
  [/codeigniter/i, "codeigniter"],
  [/wordpress|wp-config/i, "wordpress"],
  [/flutter/i, "flutter"],
  [/spring/i, "spring"],
  [/rails/i, "rails"],
];
const DBS: [RegExp, string][] = [
  [/mysql|mysqli|mariadb/i, "mysql"],
  [/pg\b|postgres/i, "postgresql"],
  [/mongo/i, "mongodb"],
  [/sqlite/i, "sqlite"],
  [/firebase/i, "firebase"],
  [/redis/i, "redis"],
];
const FEATURES = [
  "pos",
  "inventory",
  "billing",
  "invoice",
  "gst",
  "cart",
  "checkout",
  "payment",
  "coupon",
  "crm",
  "hrm",
  "payroll",
  "attendance",
  "school",
  "student",
  "exam",
  "hospital",
  "pharmacy",
  "restaurant",
  "hotel",
  "booking",
  "ecommerce",
  "multi vendor",
  "blog",
  "chat",
  "delivery",
  "report",
  "dashboard",
  "barcode",
  "whatsapp",
  "sms",
  "otp",
  "login",
  "admin",
];

function words(name: string) {
  return name.toLowerCase().replace(/[-_.]+/g, " ");
}

async function readText(dir: Dir, name: string, max = 40_000) {
  try {
    const f = await (await dir.getFileHandle(name)).getFile();
    return await f.slice(0, max).text();
  } catch {
    return "";
  }
}

async function describe(dir: Dir, path: string, names: Set<string>): Promise<ScannedItem> {
  const pkg = names.has("package.json") ? await readText(dir, "package.json") : "";
  const composer = names.has("composer.json") ? await readText(dir, "composer.json") : "";
  const py =
    (names.has("requirements.txt") ? await readText(dir, "requirements.txt") : "") +
    (names.has("pyproject.toml") ? await readText(dir, "pyproject.toml") : "");
  const readme = [...names].find((n) => /^readme/i.test(n));
  const readmeText = readme ? await readText(dir, readme, 8_000) : "";
  const env = names.has(".env.example") ? await readText(dir, ".env.example", 4000) : "";
  let meta: { name?: string; version?: string; description?: string } = {};
  try {
    meta = JSON.parse(pkg || composer || "{}");
  } catch {
    /* ignore */
  }
  const blob = [pkg, composer, py, env, readmeText, [...names].join(" ")].join("\n");
  const tech = new Set<string>();
  if (pkg) tech.add("javascript");
  if (names.has("tsconfig.json")) tech.add("typescript");
  if (composer || [...names].some((n) => n.endsWith(".php"))) tech.add("php");
  if (py || names.has("manage.py")) tech.add("python");
  if (names.has("pubspec.yaml")) tech.add("dart");
  if (names.has("pom.xml") || names.has("build.gradle")) tech.add("java");
  if (names.has("go.mod")) tech.add("go");
  if ([...names].some((n) => /\.html?$/.test(n))) tech.add("html");
  const framework = FRAMEWORKS.find(([r]) => r.test(blob))?.[1] ?? null;
  const db = DBS.find(([r]) => r.test(blob))?.[1] ?? null;
  const text = (words(path) + " " + (meta.description ?? "") + " " + readmeText).toLowerCase();
  const features = FEATURES.filter((f) => text.includes(f));
  const folder = path.split("/").pop() || path;
  return {
    source_key: "ssd:" + path.toLowerCase(),
    name: meta.name && !meta.name.includes("/") ? meta.name : folder,
    category: features[0] ?? null,
    modules: features.slice(0, 12),
    features,
    technology: [...tech],
    database_engine: db,
    framework,
    capabilities: [],
    source_location: "SSD:/" + path,
    version: meta.version ?? null,
    compatibility: null,
    known_requirements: env ? "Needs .env configuration" : null,
    metadata: {
      description: (
        meta.description ??
        readmeText.split("\n").find((l) => l.trim() && !l.startsWith("#")) ??
        ""
      ).slice(0, 300),
      scanned_at: new Date().toISOString(),
    },
  };
}

export async function scanFolder(
  root: Dir,
  onProgress: (dirs: number, found: number) => void,
  maxDepth = 4,
) {
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
  await walk(root, root.name, 0);
  onProgress(dirs, found.length);
  return found;
}

/** Reads text files of one software folder for an isolated project workspace. */
export async function readWorkspaceFiles(root: Dir, maxFiles = 400, maxTotal = 3_000_000) {
  const files: { path: string; content: string }[] = [];
  let total = 0;
  let skipped = 0;
  const walk = async (dir: Dir, path: string) => {
    for await (const h of dir.values()) {
      const p = path ? `${path}/${h.name}` : h.name;
      if (h.kind === "directory") {
        if (!SKIP.has(h.name) && !h.name.startsWith(".")) await walk(h as Dir, p);
        continue;
      }
      if (!TEXT_EXT.test(h.name)) {
        skipped++;
        continue;
      }
      const f = await (h as FileSystemFileHandle).getFile();
      if (f.size > 200_000 || files.length >= maxFiles || total + f.size > maxTotal) {
        skipped++;
        continue;
      }
      const content = await f.text();
      total += content.length;
      files.push({ path: p, content });
    }
  };
  await walk(root, "");
  return { files, skipped };
}

export const canPickFolders = () =>
  typeof window !== "undefined" && "showDirectoryPicker" in window;
export const pickFolder = () =>
  (window as unknown as { showDirectoryPicker: (o?: object) => Promise<Dir> }).showDirectoryPicker({
    mode: "read",
  });
