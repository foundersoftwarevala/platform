import { describe, expect, it } from "vitest";

import {
  applyPresentation,
  cleanText,
  contactKey,
  hostBrandingLeft,
  extractEvidence,
  keyHash,
  hasBrandFavicon,
  remainingViolations,
  type PresentationRules,
} from "./presentation";
import { addressBlocked, assertPublicUrl } from "./safe-fetch.server";

const BRAND = { favicon: "/favicon.png", logo: "/assets/sv-logo.jpg", name: "Software Vala" };

const PAGE = `<!doctype html><html><head><title>ClinicDesk</title>
<link rel="icon" href="/dev-favicon.ico"><link rel="shortcut icon" href="https://cdn.dev.example/fav.png">
<meta name="author" content="Acme Devs"></head><body>
<header><img src="/img/acme-logo.png" alt="Acme logo"><h1>ClinicDesk</h1></header>
<p>Patient: Jane Roe, jane.roe@patient.test, +1 555 010 7788</p>
<footer>Developed by Acme Devs · Call +91 98765 43210 · <a href="https://wa.me/919876543210">WhatsApp us</a>
<a href="mailto:sales@acme-devs.example">sales@acme-devs.example</a> <a href="https://acme-devs.example">acme-devs.example</a></footer>
</body></html>`;

const RULES: PresentationRules = {
  remove: ["+91 98765 43210", "sales@acme-devs.example"],
  rebrand: ["Acme Devs"],
  logos: ["/img/acme-logo.png"],
  links: ["https://wa.me/919876543210", "https://acme-devs.example"],
};

describe("demo evidence", () => {
  it("finds favicons, logos, contacts and credits", () => {
    const e = extractEvidence(PAGE, "https://clinic.example/demo");
    expect(e.title).toBe("ClinicDesk");
    expect(e.favicons).toEqual(["/dev-favicon.ico", "https://cdn.dev.example/fav.png"]);
    expect(e.logos).toContain("/img/acme-logo.png");
    expect(e.emails).toEqual(expect.arrayContaining(["jane.roe@patient.test", "sales@acme-devs.example"]));
    expect(e.phones.join(" ")).toContain("98765 43210");
    expect(e.whatsapp).toContain("https://wa.me/919876543210");
    expect(e.credits.join(" ")).toContain("Developed by Acme Devs");
    expect(e.meta.author).toBe("Acme Devs");
  });

  it("reads interface strings and contacts out of a single-page app bundle", () => {
    const bundle = `const a="Book an appointment today";const b="support@acme-devs.example";const c="https://wa.me/447700900123";`;
    const e = extractEvidence("<html><head></head><body><div id=root></div></body></html>", "https://x.example/", [bundle]);
    expect(e.emails).toContain("support@acme-devs.example");
    expect(e.whatsapp).toContain("https://wa.me/447700900123");
    expect(e.strings).toContain("Book an appointment today");
  });

  it("reaches the app's contact section past a megabyte of framework code", () => {
    // A quote inside a regular expression, then hundreds of framework strings,
    // then the app's own contact section - the order a Vite bundle has.
    const framework =
      `var q=/["']/g;` + Array.from({ length: 900 }, (_, i) => `f${i}("Minified React error number ${i}");`).join("");
    const app = `[{label:"Email",value:"info@musicacademy.com"},{label:"Phone",value:"+1 (555) 123-4567"},{label:"Address",value:"123 Music Lane, NYC"}];`;
    const e = extractEvidence("<html><head></head><body><div id=root></div></body></html>", "https://x.lovable.app/", [framework + app]);
    expect(e.emails).toContain("info@musicacademy.com");
    expect(e.phones).toContain("+1 (555) 123-4567");
    expect(e.strings.slice(0, 200)).toContain("123 Music Lane, NYC");
  });
});

describe("Software Vala presentation", () => {
  const out = applyPresentation(PAGE, RULES, BRAND);

  it("replaces every favicon with Software Vala's", () => {
    expect(hasBrandFavicon(out, BRAND.favicon)).toBe(true);
    expect(out).not.toContain("dev-favicon.ico");
  });

  it("replaces the developer logo", () => {
    expect(out).toContain(`src="${BRAND.logo}"`);
    expect(out).not.toMatch(/<img[^>]*acme-logo/);
  });

  it("removes developer contact details and links, keeps application data", () => {
    expect(remainingViolations(out, RULES)).toEqual([]);
    expect(out).not.toContain("wa.me");
    expect(out).not.toContain("acme-devs.example\"");
    // The sample patient is the software's own data and stays.
    expect(out).toContain("jane.roe@patient.test");
    expect(out).toContain("+1 555 010 7788");
    expect(out).toContain("Developed by Software Vala");
  });

  it("installs the script that applies the same rules after a single-page app renders", () => {
    expect(out).toContain("<script data-sv-presentation>");
    // The script identifies the developer's contacts by hash only.
    expect(out).toContain(keyHash("d:919876543210"));
    expect(out).toContain(keyHash("e:sales@acme-devs.example"));
    expect(out).toContain(keyHash("h:acme-devs.example"));
    expect(out).not.toMatch(/<script data-sv-presentation>[^<]*<\/script>[\s\S]*<script data-sv-presentation>/);
  });

  it("reports what is left when a rule did not take", () => {
    expect(remainingViolations(PAGE, RULES)).toEqual(expect.arrayContaining(["sales@acme-devs.example"]));
  });

  it("cleans a single-page app bundle without touching its code", () => {
    const js = `var a={email:"sales@acme-devs.example",by:"Acme Devs",n:1};`;
    expect(cleanText(js, RULES, BRAND)).toBe(`var a={email:"",by:"Software Vala",n:1};`);
  });

  it("keys contact details the same way however they are written", () => {
    expect(contactKey("tel:+91 98765 43210")).toBe(contactKey("https://wa.me/919876543210"));
    expect(contactKey("mailto:Sales@Acme-Devs.example")).toBe("e:sales@acme-devs.example");
    expect(contactKey("https://www.acme-devs.example/about")).toBe("h:acme-devs.example");
  });
});

// The shape of a Lovable app as it is served (virtuoso-track.lovable.app):
// the platform's badge and tags in the page, the business's contact details
// and name in the bundle, the demo's login accounts beside them.
const LOVABLE_PAGE = `<!doctype html><html lang="en"><head><meta charset="UTF-8" />
<!-- TODO: Set the document title to the name of your application -->
<title>Lovable App</title><meta name="description" content="Lovable Generated Project" />
<meta name="author" content="Lovable" /><meta property="og:image" content="https://lovable.dev/opengraph-image-p98pqg.png" />
<meta name="twitter:site" content="@Lovable" /><script type="module" crossorigin src="/assets/index-GB_HiC2t.js"></script>
<style>#lovable-badge { position: fixed; }</style>
<script defer src="/~flock.js" data-proxy-url="/~api/analytics"></script></head><body><div id="root"></div>
<aside id="lovable-badge" aria-label="Edit with Lovable"><a id="lovable-badge-cta" href="https://lovable.dev/projects/lovp_5z2q?utm_source=lovable-badge"><span>Edit with</span></a></aside>
<script>var badge = document.getElementById('lovable-badge');</script></body></html>`;
const LOVABLE_BUNDLE = `[{label:"Email",value:"info@musicacademy.com"},{label:"Phone",value:"+1 (555) 123-4567"},{label:"Address",value:"123 Music Lane, NYC"}];
u.jsx("p",{children:"© 2026 Music Academy. Powered by Software Vala™"});const logins=["student@musicacademy.com","admin@musicacademy.com"];`;
const SV = { ...BRAND, email: "support@softwarevala.net", phone: "+91 83488 38383", whatsapp: "https://wa.me/918348838383" };
const LOVABLE_RULES: PresentationRules = {
  replace: ["info@musicacademy.com", "+1 (555) 123-4567"],
  remove: ["123 Music Lane, NYC"],
  rebrand: ["Music Academy"],
  logos: [],
  links: [],
};

describe("a Lovable demo shown as Software Vala", () => {
  const out = applyPresentation(LOVABLE_PAGE, LOVABLE_RULES, SV);

  it("removes the platform's badge, its project link, analytics and share tags", () => {
    expect(hostBrandingLeft(out)).toEqual([]);
    // Outside the rules script, which names the badge so it can remove one added later.
    expect(out.replace(/<script data-sv-presentation>[\s\S]*?<\/script>/, "")).not.toMatch(/lovable/i);
    expect(out).not.toContain("og:image");
    expect(out).toContain('<meta name="author" content="Software Vala">');
    // The application itself still loads.
    expect(out).toContain('src="/assets/index-GB_HiC2t.js"');
    expect(hasBrandFavicon(out, SV.favicon)).toBe(true);
  });

  it("strips the platform branding even from a demo with no rules yet", () => {
    const bare = applyPresentation(LOVABLE_PAGE, { remove: [], rebrand: [], logos: [], links: [] }, SV);
    expect(hostBrandingLeft(bare)).toEqual([]);
  });

  it("shows Software Vala's contact in place of the business's, and keeps the login accounts", () => {
    const js = cleanText(LOVABLE_BUNDLE, LOVABLE_RULES, SV);
    expect(js).toContain('value:"support@softwarevala.net"');
    expect(js).toContain('value:"+91 83488 38383"');
    expect(js).toContain('value:""');
    expect(js).toContain("© 2026 Software Vala. Powered by Software Vala™");
    expect(js).toContain("student@musicacademy.com");
    expect(js).toContain("admin@musicacademy.com");
    expect(remainingViolations(js, LOVABLE_RULES)).toEqual([]);
  });

  it("points the business's contact links at Software Vala", () => {
    const page = `<html><head></head><body><a href="mailto:info@musicacademy.com">Mail</a>
<a href="tel:+15551234567">Call</a><a href="https://wa.me/15551234567">WhatsApp</a></body></html>`;
    const html = applyPresentation(page, LOVABLE_RULES, SV);
    expect(html).toContain('href="mailto:support@softwarevala.net"');
    expect(html).toContain('href="tel:+918348838383"');
    expect(html).toContain('href="https://wa.me/918348838383"');
    expect(html).not.toContain("5551234567");
  });

  it("gives the browser script only hashes of the business's contact details", () => {
    expect(out).not.toContain("info@musicacademy.com");
    expect(out).not.toContain("555");
  });
});

describe("demo address safety", () => {
  it.each([
    "http://127.0.0.1/",
    "http://localhost:3000/",
    "https://10.0.0.5/",
    "http://169.254.169.254/latest/meta-data",
    "https://[::1]/",
    "http://192.168.1.1/",
    "ftp://example.com/",
    "https://user:pw@example.com/",
    "https://example.com:8443/",
    "http://intranet/",
  ])("refuses %s", (url) => {
    expect(() => assertPublicUrl(url)).toThrow();
  });

  it("accepts an ordinary public address", () => {
    expect(assertPublicUrl("https://some-random-domain.com/demo").hostname).toBe("some-random-domain.com");
  });

  it.each(["10.1.2.3", "172.20.0.1", "100.64.0.1", "::ffff:127.0.0.1", "fd00::1", "fe80::1", "0.0.0.0"])(
    "blocks the resolved address %s",
    (ip) => expect(addressBlocked(ip)).toBe(true),
  );
  it.each(["93.184.216.34", "2606:4700::6810:84e5"])("allows %s", (ip) => expect(addressBlocked(ip)).toBe(false));
});
