/**
 * The blog, read from the content the SEO Manager already stores.
 *
 * seo_content_items has held the platform's articles since it was written, and
 * the manager can create, review and publish them, but no public route ever
 * rendered one: /blog and every /blog/<slug> answered 404 while rows sat there
 * marked published. This is the missing half.
 *
 * A post is publishable only when it is marked published AND actually has a
 * body. Three rows are marked published today with a word count recorded and
 * no body stored at all, and a page built from one of those would be an empty
 * page wearing a title. Those are held back, counted, and reported rather than
 * filled in with something invented.
 *
 * Server only: it reads with the service role.
 */

export type BlogPost = {
  id: string;
  slug: string;
  url: string;
  title: string;
  keyword: string | null;
  body: string;
  wordCount: number;
  publishedAt: string | null;
  updatedAt: string | null;
};

export type BlogIndex = {
  posts: BlogPost[];
  /** Marked published but with nothing stored to render. Never shown, always counted. */
  withoutBody: number;
};

type Row = Record<string, unknown>;

function base() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}` };
}

const FIELDS = "id,title,target_keyword,body,word_count,status,url,published_at,updated_at";

/** "/blog/pos-software-guide" -> "pos-software-guide". */
export function blogSlug(url: unknown): string {
  const path = String(url ?? "").trim();
  if (!path) return "";
  const at = path.lastIndexOf("/");
  return at >= 0 ? path.slice(at + 1) : path;
}

function hasBody(row: Row): boolean {
  return typeof row.body === "string" && row.body.trim().length > 0;
}

function toPost(row: Row): BlogPost {
  const slug = blogSlug(row.url);
  return {
    id: String(row.id),
    slug,
    url: `/blog/${slug}`,
    title: String(row.title ?? ""),
    keyword: row.target_keyword == null ? null : String(row.target_keyword),
    body: String(row.body ?? ""),
    wordCount: Number(row.word_count ?? 0),
    publishedAt: row.published_at == null ? null : String(row.published_at),
    updatedAt: row.updated_at == null ? null : String(row.updated_at),
  };
}

async function read(query: string): Promise<Row[]> {
  const response = await fetch(`${base()}/rest/v1/seo_content_items?${query}`, {
    headers: admin(),
  });
  if (!response.ok) throw new Error(`seo_content_items -> HTTP ${response.status}`);
  return (await response.json()) as Row[];
}

/** Every post the site can actually show, newest first. */
export async function readBlogIndex(limit = 100): Promise<BlogIndex> {
  if (!base()) return { posts: [], withoutBody: 0 };
  const rows = await read(
    `select=${FIELDS}&status=eq.published&order=published_at.desc&limit=${limit}`,
  );
  const publishable = rows.filter((row) => hasBody(row) && blogSlug(row.url));
  return {
    posts: publishable.map(toPost),
    withoutBody: rows.length - publishable.length,
  };
}

/** One post, or null when it is not published, has no body, or does not exist. */
export async function readBlogPost(slug: string): Promise<BlogPost | null> {
  if (!base() || !slug) return null;
  const rows = await read(
    `select=${FIELDS}&status=eq.published&url=eq.${encodeURIComponent(`/blog/${slug}`)}&limit=1`,
  );
  const row = rows[0];
  if (!row || !hasBody(row)) return null;
  return toPost(row);
}

export type BlogBlock =
  | { kind: "heading"; level: 2 | 3; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "item"; text: string };

/**
 * A stored body, broken into blocks the page can draw as elements.
 *
 * The body is treated as text, never as markup: nothing an author writes is
 * ever handed to the browser as HTML, so a post cannot inject a script into a
 * reader's page. Leading "#" marks become headings and leading "-" marks become
 * list items, which is how the bodies in this table are written.
 */
export function blogBlocks(body: string): BlogBlock[] {
  const blocks: BlogBlock[] = [];
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("### ")) {
      blocks.push({ kind: "heading", level: 3, text: line.slice(4).trim() });
    } else if (line.startsWith("## ")) {
      blocks.push({ kind: "heading", level: 2, text: line.slice(3).trim() });
    } else if (line.startsWith("# ")) {
      blocks.push({ kind: "heading", level: 2, text: line.slice(2).trim() });
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      blocks.push({ kind: "item", text: line.slice(2).trim() });
    } else {
      blocks.push({ kind: "paragraph", text: line });
    }
  }
  return blocks;
}

/** The first sentences of a post, for a meta description and a card. */
export function blogExcerpt(body: string, length = 180): string {
  const first = blogBlocks(body).find((block) => block.kind === "paragraph");
  const text = first ? first.text : "";
  if (text.length <= length) return text;
  const cut = text.slice(0, length);
  const stop = cut.lastIndexOf(" ");
  return `${stop > 60 ? cut.slice(0, stop) : cut}…`;
}
