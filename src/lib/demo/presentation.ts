/**
 * The Software Vala presentation of a demo.
 *
 * A demo is someone else's running software. Software Vala does not change it;
 * it changes what a visitor sees when the demo is opened through
 * softwarevala.net: the tab carries the Software Vala favicon, the developer's
 * logo is replaced by Software Vala's, and contact details the developer left
 * in the page (their phone, WhatsApp, e-mail, links to their own site) are
 * removed so the visitor is not led around the marketplace.
 *
 * Two halves, both pure so they can be tested without a network:
 *
 *   extractEvidence  - what is on the page: title, favicons, logo images,
 *                      e-mail addresses, phone and WhatsApp numbers, outside
 *                      links, "developed by" credits and visible strings;
 *   applyPresentation - the proxy's rewrite of one HTML page, plus a small
 *                      script that applies the same rules to what a
 *                      single-page app draws after it loads.
 *
 * Nothing is removed on a guess. The Demo Manager's investigation decides
 * which of the evidence is the developer's (and which is ordinary data the
 * software works with, such as a sample customer's e-mail), and only values
 * that literally appear in the demo are ever acted on.
 */

export type Evidence = {
  title: string | null;
  description: string | null;
  meta: Record<string, string>;
  favicons: string[];
  logos: string[];
  emails: string[];
  phones: string[];
  whatsapp: string[];
  externalLinks: { href: string; text: string }[];
  credits: string[];
  strings: string[];
};

export type PresentationRules = {
  /** Literal text removed wherever it appears (contact details). */
  remove: string[];
  /** Literal developer names/credits shown as "Software Vala" instead. */
  rebrand: string[];
  /** Image addresses (as written in the page) replaced by the Software Vala logo. */
  logos: string[];
  /** Link targets containing any of these are unlinked and their text dropped. */
  links: string[];
};

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,24}/gi;
// A number worth a second look: at least 8 digits, allowing the usual separators.
const PHONE = /(?:\+|\b00)?\d[\d\s().-]{6,18}\d/g;
const WHATSAPP = /(?:https?:)?\/\/(?:wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|web\.whatsapp\.com)\/[^\s"'<>)]*|whatsapp:\/\/[^\s"'<>)]*/gi;
const CREDIT = /\b(?:developed|designed|powered|created|built|made|crafted|maintained)\s+(?:with\s+\S+\s+)?by\s*:?\s*([^<>"'\n|©]{2,60})/gi;
const ASSET_EMAIL = /\.(?:png|jpe?g|gif|svg|webp|avif|js|css|woff2?)$/i;

const unique = <T,>(list: T[]) => [...new Set(list)];

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? (m[1] ?? m[2] ?? m[3] ?? "").trim() : null;
}

export function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function phonesIn(text: string): string[] {
  return (text.match(PHONE) ?? [])
    .map((p) => p.trim())
    .filter((p) => {
      const d = digits(p);
      // Real phone numbers, not years, prices, versions or dates.
      return d.length >= 8 && d.length <= 15 && !/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(p);
    });
}

/**
 * String literals from a JavaScript bundle that read like interface text.
 * A single-page app ships its words in its bundle, not in its HTML.
 */
export function bundleStrings(js: string, limit = 600): string[] {
  const out: string[] = [];
  const re = /(["'`])((?:(?!\1)[^\\\n]|\\.){3,160})\1/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(js)) && out.length < limit * 4) {
    const s = m[2];
    if (!/[a-z]{2,}\s+[a-z]{2,}/i.test(s) && !EMAIL.test(s) && !/wa\.me|whatsapp|\+\d/i.test(s)) {
      EMAIL.lastIndex = 0;
      continue;
    }
    EMAIL.lastIndex = 0;
    if (/[{};=<>]|function|return |\bvar |\bconst |\\u/.test(s)) continue;
    out.push(s.trim());
  }
  return unique(out).slice(0, limit);
}

export function extractEvidence(
  html: string,
  pageUrl: string,
  bundles: string[] = [],
): Evidence {
  const origin = new URL(pageUrl);
  const text = visibleText(html);
  const strings = unique([...bundles.flatMap((b) => bundleStrings(b))]);
  const corpus = [text, ...strings].join("\n");

  const meta: Record<string, string> = {};
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (attr(tag, "name") ?? attr(tag, "property") ?? "").toLowerCase();
    const content = attr(tag, "content");
    if (
      content &&
      /^(author|generator|application-name|og:site_name|og:title|og:description|twitter:site|twitter:creator|copyright|publisher)$/.test(key)
    ) {
      meta[key] = content.slice(0, 200);
    }
  }

  const favicons = unique(
    (html.match(/<link\b[^>]*>/gi) ?? [])
      .filter((tag) => /\brel\s*=\s*["']?[^"'>]*icon/i.test(tag))
      .map((tag) => attr(tag, "href"))
      .filter((h): h is string => Boolean(h)),
  );

  const logos = unique(
    (html.match(/<img\b[^>]*>/gi) ?? [])
      .filter((tag) => /logo|brand/i.test(`${attr(tag, "src")} ${attr(tag, "alt")} ${attr(tag, "class")} ${attr(tag, "id")}`))
      .map((tag) => attr(tag, "src"))
      .filter((s): s is string => Boolean(s))
      .concat(
        bundles.flatMap((b) =>
          (b.match(/["'`](\/?[\w./-]*(?:logo|brand)[\w./-]*\.(?:png|jpe?g|svg|webp|gif))["'`]/gi) ?? []).map((q) =>
            q.slice(1, -1),
          ),
        ),
      ),
  ).slice(0, 20);

  const emails = unique(
    [...(html.match(EMAIL) ?? []), ...(corpus.match(EMAIL) ?? [])].filter((e) => !ASSET_EMAIL.test(e)),
  ).slice(0, 40);

  const telLinks = (html.match(/href\s*=\s*["']tel:([^"']+)["']/gi) ?? []).map((h) =>
    h.replace(/^href\s*=\s*["']tel:/i, "").replace(/["']$/, ""),
  );
  const phones = unique([...telLinks, ...phonesIn(corpus)]).slice(0, 40);

  const whatsapp = unique([...(html.match(WHATSAPP) ?? []), ...(corpus.match(WHATSAPP) ?? [])]).slice(0, 20);

  const externalLinks: { href: string; text: string }[] = [];
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = attr(`<a ${m[1]}>`, "href");
    if (!href || !/^https?:\/\//i.test(href)) continue;
    try {
      if (new URL(href).hostname === origin.hostname) continue;
    } catch {
      continue;
    }
    externalLinks.push({ href, text: visibleText(m[2]).slice(0, 80) });
    if (externalLinks.length >= 30) break;
  }
  for (const s of strings) {
    const m = s.match(/^https?:\/\/[^\s"'<>]+$/i);
    if (m && externalLinks.length < 40) {
      try {
        if (new URL(s).hostname !== origin.hostname) externalLinks.push({ href: s, text: "" });
      } catch {
        /* not a link */
      }
    }
  }

  const credits = unique(
    [...corpus.matchAll(CREDIT)].map((m) => m[0].trim().replace(/[.,;:]+$/, "")),
  ).slice(0, 20);

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? null;
  return {
    title,
    description: meta["og:description"] ?? null,
    meta,
    favicons,
    logos,
    emails,
    phones,
    whatsapp,
    externalLinks,
    credits,
    strings: [text.slice(0, 3000), ...strings].filter(Boolean).slice(0, 300),
  };
}

/** Everything in the demo a rule could match, for checking the AI's answer. */
export function evidenceCorpus(html: string, bundles: string[]): string {
  return [html, ...bundles].join("\n");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/**
 * The proxy's rewrite of one HTML page. `brand` holds absolute addresses on
 * softwarevala.net, so the proxy's own asset rewriting leaves them alone.
 */
export function applyPresentation(
  html: string,
  rules: PresentationRules,
  brand: { favicon: string; logo: string; name: string },
): string {
  let out = html;

  // 1. Favicon: every icon the page declares goes; Software Vala's is added.
  out = out.replace(/<link\b[^>]*\brel\s*=\s*["']?[^"'>]*icon[^>]*>\s*/gi, "");
  const icon = `<link rel="icon" href="${escapeHtml(brand.favicon)}"><link rel="apple-touch-icon" href="${escapeHtml(brand.favicon)}">`;
  out = /<head[^>]*>/i.test(out) ? out.replace(/<head([^>]*)>/i, `<head$1>${icon}`) : icon + out;

  // 2. Developer logo images show the Software Vala logo.
  for (const src of rules.logos) {
    if (!src) continue;
    out = out.replace(
      new RegExp(`(\\ssrc\\s*=\\s*["'])${escapeRegExp(src)}(["'])`, "g"),
      `$1${escapeHtml(brand.logo)}$2 data-sv-brand="logo"`,
    );
  }

  // 3. Links to the developer (mail, phone, WhatsApp, their site) are removed.
  const linkNeedles = unique([...rules.links, ...rules.remove]).filter((n) => n.length >= 4);
  if (linkNeedles.length) {
    out = out.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (whole, attrs: string) => {
      const href = attr(`<a ${attrs}>`, "href") ?? "";
      const hrefDigits = digits(href);
      const hit = linkNeedles.some(
        (n) => href.includes(n) || (digits(n).length >= 8 && hrefDigits.includes(digits(n))),
      );
      return hit ? "" : whole;
    });
  }

  // 4. Contact details left in the text are removed; developer credits read
  //    "Software Vala". Longest first, so a number is not half-removed by a
  //    shorter one inside it.
  out = cleanText(out, rules, brand.name);

  // 5. The same rules for what a single-page app draws after it loads.
  const script = `<script data-sv-presentation>${presentationScript(rules, brand)}</script>`;
  out = /<\/head>/i.test(out) ? out.replace(/<\/head>/i, `${script}</head>`) : out + script;
  return out;
}

/**
 * The same text rules for a script, stylesheet or data file of the demo. A
 * single-page app ships its words - and the developer's phone number - in its
 * bundle, so the bundle is cleaned too. Only whole literal values are
 * replaced, inside what are string literals in practice (e-mail addresses,
 * phone numbers, names), so the code around them is untouched.
 */
export function cleanText(text: string, rules: PresentationRules, brandName: string): string {
  let out = text;
  for (const value of unique([...rules.remove, ...rules.links]).sort((a, b) => b.length - a.length)) {
    if (value.length >= 4) out = out.split(value).join("");
  }
  for (const value of [...rules.rebrand].sort((a, b) => b.length - a.length)) {
    if (value.length >= 3) out = out.split(value).join(brandName);
  }
  return out;
}

/**
 * A contact detail reduced to what identifies it: an e-mail address, the
 * digits of a phone or WhatsApp number, or the host of a website. The browser
 * script is given only a hash of these, so the page source a visitor can read
 * does not carry the developer's contact details the page no longer shows.
 */
export function contactKey(value: string): string | null {
  const v = String(value ?? "").trim().toLowerCase().replace(/^(mailto|tel):/, "");
  const d = v.replace(/\D/g, "");
  if (/wa\.me|whatsapp/.test(v)) return d.length >= 8 ? `d:${d}` : null;
  if (v.includes("@")) return `e:${v.split("?")[0]}`;
  if (/^https?:\/\//.test(v)) {
    try {
      return `h:${new URL(v).hostname.replace(/^www\./, "")}`;
    } catch {
      return null;
    }
  }
  return d.length >= 8 ? `d:${d}` : null;
}

/** FNV-1a, 32 bit. The same function runs in the browser script below. */
export function keyHash(key: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

/** Browser half: applies the rules to the live document and keeps applying them. */
export function presentationScript(
  rules: PresentationRules,
  brand: { favicon: string; logo: string; name: string },
): string {
  const hashes = unique(
    [...rules.remove, ...rules.links].map(contactKey).filter((k): k is string => Boolean(k)).map(keyHash),
  );
  const payload = JSON.stringify({ h: hashes, b: rules.rebrand, l: rules.logos, brand }).replace(/</g, "\\u003c");
  return `(function(){var R=${payload};var H={};R.h.forEach(function(x){H[x]=1});
function hash(k){var h=0x811c9dc5;for(var i=0;i<k.length;i++){h^=k.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}return h.toString(16);}
function key(v){v=String(v||"").trim().toLowerCase().replace(/^(mailto|tel):/,"");var d=v.replace(/\\D/g,"");
if(/wa\\.me|whatsapp/.test(v))return d.length>=8?"d:"+d:null;if(v.indexOf("@")>=0)return "e:"+v.split("?")[0];
if(/^https?:\\/\\//.test(v)){try{return "h:"+new URL(v).hostname.replace(/^www\\./,"")}catch(e){return null}}return d.length>=8?"d:"+d:null;}
function hit(v){var k=key(v);return !!(k&&H[hash(k)]);}
var EM=/[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\\.[A-Z0-9-]+)*\\.[A-Z]{2,24}/gi,PH=/(?:\\+|\\b00)?\\d[\\d\\s().-]{6,18}\\d/g;
function fixText(node){var v=node.nodeValue,o=v;
v=v.replace(EM,function(m){return hit(m)?"":m}).replace(PH,function(m){return hit(m)?"":m});
R.b.slice().sort(function(a,b){return b.length-a.length}).forEach(function(n){if(n.length>=3&&v.indexOf(n)>=0)v=v.split(n).join(R.brand.name)});
if(v!==o)node.nodeValue=v;}
function fixEl(el){if(el.tagName==="A"&&hit(el.getAttribute("href"))){el.remove();return;}
if(el.tagName==="IMG"){var s=el.getAttribute("src")||"";for(var j=0;j<R.l.length;j++){var l=R.l[j];if(l&&(s===l||s.slice(-l.length)===l||l.slice(-s.length)===s&&s.length>4)){el.setAttribute("src",R.brand.logo);break;}}}
if(el.tagName==="LINK"&&/icon/i.test(el.getAttribute("rel")||"")&&el.getAttribute("href")!==R.brand.favicon)el.setAttribute("href",R.brand.favicon);}
function walk(root){if(!root)return;if(root.nodeType===3){fixText(root);return;}if(root.nodeType!==1)return;fixEl(root);
var w=document.createTreeWalker(root,5,null),n;while((n=w.nextNode())){if(n.nodeType===3)fixText(n);else fixEl(n);}}
function run(){walk(document.documentElement);}
var queued=false;new MutationObserver(function(ms){ms.forEach(function(m){m.addedNodes.forEach(walk);if(m.type==="characterData")fixText(m.target);if(m.type==="attributes")fixEl(m.target);});
if(!queued){queued=true;setTimeout(function(){queued=false;run();},400);}}).observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:["href","src","rel"]});
if(document.readyState!=="loading")run();else document.addEventListener("DOMContentLoaded",run);})();`;
}

/**
 * What is left of the rules in a presented page. Empty means the page is
 * clean. Contact details and developer links are looked for everywhere,
 * including the rules script; a developer name only outside it (the script
 * needs the name to replace it).
 */
export function remainingViolations(presented: string, rules: PresentationRules): string[] {
  const body = presented.replace(/<script data-sv-presentation>[\s\S]*?<\/script>/i, "");
  const left: string[] = [];
  for (const value of unique([...rules.remove, ...rules.links])) {
    if (value.length >= 4 && presented.includes(value)) left.push(value);
  }
  for (const value of rules.rebrand) {
    if (value.length >= 3 && body.includes(value)) left.push(value);
  }
  return left;
}

export function hasBrandFavicon(presented: string, favicon: string): boolean {
  const icons = (presented.match(/<link\b[^>]*\brel\s*=\s*["']?[^"'>]*icon[^>]*>/gi) ?? []).map(
    (tag) => attr(tag, "href"),
  );
  return icons.length > 0 && icons.every((h) => h === favicon);
}
