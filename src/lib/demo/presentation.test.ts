import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";

import {
  applyPresentation,
  bundleStrings,
  cleanText,
  cleanBundle,
  remainingBundleViolations,
  rewriteDemoAssetPaths,
  rewriteDemoHydrationAssets,
  contactKey,
  extractEvidence,
  keyHash,
  hasBrandFavicon,
  hasStarterApp,
  presentationScript,
  remainingViolations,
  SOFTWARE_VALA_CONTACT,
  stripPlatformBranding,
  type PresentationRules,
} from "./presentation";
import { addressBlocked, assertPublicUrl } from "./safe-fetch.server";

const BRAND = { favicon: "/favicon.png", logo: "/assets/sv-logo.jpg", name: "Software Vala" };

describe("template literal asset paths", () => {
  it("rewrites template CSS imports while retaining interpolation syntax", () => {
    const rules: PresentationRules = { remove: [], rebrand: [], logos: [], links: [] };
    expect(
      cleanBundle(
        "const css=`/assets/style.css`;const dynamic=`hello ${name}`;",
        rules,
        BRAND.name,
        "/api/proxy/demo/hotel-management",
      ),
    ).toBe(
      "const css=`/api/proxy/demo/hotel-management/assets/style.css`;const dynamic=`hello ${name}`;",
    );
    expect(
      cleanBundle("const label=`Vendor`;", { ...rules, rebrand: ["Vendor"] }, "Brand `${safe}`"),
    ).toBe("const label=`Brand \\`\\${safe}\\``;");
  });
});

describe("SSR hydration manifest assets", () => {
  it("preserves verified chrome labels in bundles until React hydration completes", () => {
    const rules: PresentationRules = {
      remove: [],
      rebrand: [],
      logos: [],
      links: [],
      brandLabels: ["Loomcart"],
    };
    expect(
      cleanBundle(
        'const label="Loomcart";const organization="Loomcart Central";const credentials={password:"Loomcart",email:"user@loomcart.test"};',
        rules,
        BRAND.name,
      ),
    ).toBe(
      'const label="Loomcart";const organization="Loomcart Central";const credentials={password:"Loomcart",email:"user@loomcart.test"};',
    );
  });

  it("proxies serialized module bootstrap children that the router replays after hydration", () => {
    const prefix = "/api/proxy/demo/clinical-health-suite";
    const bootstrap = 'import("/assets/main.js")';
    const code = `$_TSR.router={assets:[{tag:"script",attrs:{type:"module"},children:${JSON.stringify(bootstrap)}}],password:${JSON.stringify(bootstrap)},label:"/patients"};`;
    const result = rewriteDemoHydrationAssets(`<script>${code}</script>`, prefix);
    expect(result).toContain(`children:${JSON.stringify(`import("${prefix}/assets/main.js")`)}`);
    expect(result).toContain(`password:${JSON.stringify(bootstrap)}`);
    expect(result).toContain('label:"/patients"');
    expect(rewriteDemoHydrationAssets(result, prefix)).toBe(result);
  });

  it("proxies inline module entry imports without rewriting external scripts or data", () => {
    const prefix = "/api/proxy/demo/clinical-health-suite";
    const html =
      '<script type="module">import("/assets/main-BYNDnh8n.js")</script>' +
      '<script type="MODULE">import app from "/assets/app.js";import("https://vendor.test/app.js");const route="/patients";</script>' +
      '<script type="module" src="/assets/external.js"></script>' +
      '<script type="application/json">{"entry":"/assets/data.js"}</script>' +
      '<script>const untouched="/assets/ordinary.js";</script>';
    const result = rewriteDemoHydrationAssets(html, prefix);
    expect(result).toContain(`import("${prefix}/assets/main-BYNDnh8n.js")`);
    expect(result).toContain(`import app from "${prefix}/assets/app.js"`);
    expect(result).toContain('import("https://vendor.test/app.js")');
    expect(result).toContain('const route="/patients"');
    expect(result).toContain('<script type="module" src="/assets/external.js"></script>');
    expect(result).toContain(
      '<script type="application/json">{"entry":"/assets/data.js"}</script>',
    );
    expect(result).toContain('<script>const untouched="/assets/ordinary.js";</script>');
    expect(rewriteDemoHydrationAssets(result, prefix)).toBe(result);
  });

  it("proxies hydration preloads without changing route IDs or account values", () => {
    const code =
      '$_TSR.router={preloads:["/assets/login.js"],scripts:[{attrs:{src:"/assets/index.js"}}],matches:[{id:"/login"}],email:"gm.mumbai@nexora.io",password:"nexora-demo"};';
    const html = `<script>${code}</script><script type="application/json">{"src":"/assets/data.js"}</script>`;
    const result = rewriteDemoHydrationAssets(html, "/api/proxy/demo/hotel-management");
    expect(result).toContain('preloads:["/api/proxy/demo/hotel-management/assets/login.js"]');
    expect(result).toContain('src:"/api/proxy/demo/hotel-management/assets/index.js"');
    expect(result).toContain('id:"/login"');
    expect(result).toContain('email:"gm.mumbai@nexora.io"');
    expect(result).toContain('password:"nexora-demo"');
    expect(result).toContain('<script type="application/json">{"src":"/assets/data.js"}</script>');
    expect(rewriteDemoHydrationAssets(result, "/api/proxy/demo/hotel-management")).toBe(result);
  });
});

describe("Vite lazy module preload paths", () => {
  it("preserves Vite leading-slash concatenation while proxying relative preload assets", () => {
    const prefix = "/api/proxy/demo/smart-pos-billing";
    const rules: PresentationRules = { remove: [], rebrand: [], logos: [], links: [] };
    const bundle = 'const files=["assets/Landing.js","assets/hero.js","./assets/style.css"];';
    expect(cleanBundle(bundle, rules, BRAND.name, prefix)).toBe(
      'const files=["api/proxy/demo/smart-pos-billing/assets/Landing.js","api/proxy/demo/smart-pos-billing/assets/hero.js","api/proxy/demo/smart-pos-billing/assets/style.css"];',
    );
    expect(rewriteDemoAssetPaths("assets/Landing.js", prefix)).toBe(
      `${prefix.slice(1)}/assets/Landing.js`,
    );
    expect(
      new URL(
        "/" + rewriteDemoAssetPaths("assets/Landing.js", prefix),
        "https://www.softwarevala.net",
      ).href,
    ).toBe(`https://www.softwarevala.net${prefix}/assets/Landing.js`);
    for (const untouched of [
      "assets/customer",
      "../assets/private.js",
      "https://vendor.test/assets/app.js",
      "/api/proxy/demo/smart-pos-billing/assets/app.js",
      "/api/data",
    ]) {
      expect(rewriteDemoAssetPaths(untouched, prefix)).toBe(untouched);
    }
  });
});

describe("unbuilt upstream starter apps", () => {
  it("detects the actual blank landing-page copy in HTML and compiled JavaScript", () => {
    const heading = "Welcome to Your Blank App";
    const body = "Start building your amazing project here!";
    expect(hasStarterApp(`<h1>${heading}</h1><p>${body}</p>`)).toBe(true);
    expect(
      hasStarterApp("", [
        `const page={children:[${JSON.stringify(heading)},${JSON.stringify(body)}]};`,
      ]),
    ).toBe(true);
  });
  it("does not mistake comments or working application copy for a blank app", () => {
    expect(
      hasStarterApp("", [
        '/* Welcome to Your Blank App: Start building your amazing project here! */ const title="Nursing Training Institute";',
      ]),
    ).toBe(false);
    expect(hasStarterApp("<h1>Nursing Training Institute</h1><p>Student Portal</p>")).toBe(false);
  });
});

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
    expect(e.emails).toEqual(
      expect.arrayContaining(["jane.roe@patient.test", "sales@acme-devs.example"]),
    );
    expect(e.phones.join(" ")).toContain("98765 43210");
    expect(e.whatsapp).toContain("https://wa.me/919876543210");
    expect(e.credits.join(" ")).toContain("Developed by Acme Devs");
    expect(e.meta.author).toBe("Acme Devs");
  });

  it("reads interface strings and contacts out of a single-page app bundle", () => {
    const bundle = `const a="Book an appointment today";const b="support@acme-devs.example";const c="https://wa.me/447700900123";`;
    const e = extractEvidence(
      "<html><head></head><body><div id=root></div></body></html>",
      "https://x.example/",
      [bundle],
    );
    expect(e.emails).toContain("support@acme-devs.example");
    expect(e.whatsapp).toContain("https://wa.me/447700900123");
    expect(e.strings).toContain("Book an appointment today");
  });
});

describe("Software Vala presentation", () => {
  const out = applyPresentation(PAGE, RULES, BRAND);
  it("keeps actual table/form data even when it duplicates a public footer contact", () => {
    const data =
      '<table><tbody><tr><td>+91 98765 43210</td><td><a href="mailto:sales@acme-devs.example">sales@acme-devs.example</a></td></tr></tbody></table><input placeholder="sales@acme-devs.example">';
    const presented = applyPresentation(PAGE.replace("</body>", `${data}</body>`), RULES, BRAND);
    expect(presented).toContain(data);
    expect(remainingViolations(presented, RULES)).toEqual([]);
    expect(
      extractEvidence(`<html><body>${data}</body></html>`, "https://example.com/").emails,
    ).toEqual([]);
    expect(
      extractEvidence(`<html><body>${data}</body></html>`, "https://example.com/").phones,
    ).toEqual([]);
  });

  it("replaces every favicon with Software Vala's", () => {
    expect(hasBrandFavicon(out, BRAND.favicon)).toBe(true);
    expect(out).not.toContain("dev-favicon.ico");
  });

  it("preserves verified chrome labels in SSR HTML until React hydration completes", () => {
    const rules: PresentationRules = {
      remove: [],
      rebrand: [],
      logos: [],
      links: [],
      brandLabels: ["Example ERP"],
      brandLabelPaths: ["/"],
    };
    const html = applyPresentation(
      "<html><head></head><body><header><span>Example ERP</span></header><table><tr><td>Example ERP</td></tr></table></body></html>",
      rules,
      BRAND,
    );

    expect(html).toContain("<header><span>Example ERP</span></header>");
    expect(html).toContain("<td>Example ERP</td>");
  });

  it("replaces the developer logo", () => {
    expect(out).toContain(`src="${BRAND.logo}"`);
    expect(out).not.toMatch(/<img[^>]*acme-logo/);
  });

  it("removes developer contact details and links, keeps application data", () => {
    expect(remainingViolations(out, RULES)).toEqual([]);
    expect(out).not.toContain("https://wa.me/919876543210");
    expect(out).toContain(
      `<a href="https://wa.me/${SOFTWARE_VALA_CONTACT.phone.replace(/\D/g, "")}">`,
    );
    expect(out).toContain(`<a href="mailto:${SOFTWARE_VALA_CONTACT.email}">`);
    expect(out).not.toContain('acme-devs.example"');
    // The sample patient is the software's own data and stays.
    expect(out).toContain("jane.roe@patient.test");
    expect(out).toContain("+1 555 010 7788");
    expect(out).toContain("Developed by Software Vala");
  });

  it("accepts a branded WhatsApp replacement when the original link is only a base URL", () => {
    const rules: PresentationRules = {
      remove: [],
      rebrand: [],
      logos: [],
      links: ["https://wa.me/"],
    };
    const presented = applyPresentation(
      '<html><head></head><body><a href="https://wa.me/">WhatsApp</a></body></html>',
      rules,
      BRAND,
    );

    expect(presented).toContain(
      `<a href="https://wa.me/${SOFTWARE_VALA_CONTACT.phone.replace(/\D/g, "")}">`,
    );
    expect(remainingViolations(presented, rules)).toEqual([]);
  });

  it("installs the script that applies the same rules after a single-page app renders", () => {
    expect(out).toContain("<script data-sv-presentation>");
    expect(out).toContain('el.closest("#lovable-badge")');
    expect(out).toContain(
      'window.history.replaceState(window.history.state,"",(route[1]||"/")+window.location.search+window.location.hash)',
    );
    // The script identifies the developer's contacts by hash only.
    expect(out).toContain(keyHash("d:919876543210"));
    expect(out).toContain(keyHash("e:sales@acme-devs.example"));
    expect(out).toContain(keyHash("h:acme-devs.example"));
    expect(out).not.toMatch(
      /<script data-sv-presentation>[^<]*<\/script>[\s\S]*<script data-sv-presentation>/,
    );
  });

  it("defers DOM rewriting until after load while keeping proxy route normalization immediate", () => {
    const rules: PresentationRules = {
      remove: [],
      rebrand: [],
      logos: [],
      links: [],
      brandLabels: ["Example ERP"],
      brandLabelPaths: ["/"],
    };
    const dom = new JSDOM(
      "<!doctype html><html><head></head><body><header><span>Example</span><span> ERP</span></header><table><tr><td>Example ERP</td></tr></table></body></html>",
      {
        url: "https://softwarevala.net/api/proxy/demo/example?t=pass",
        pretendToBeVisual: true,
        runScripts: "outside-only",
      },
    );
    const frames: FrameRequestCallback[] = [];
    dom.window.requestAnimationFrame = (callback) => {
      frames.push(callback);
      return frames.length;
    };
    Object.defineProperty(dom.window.document, "readyState", {
      configurable: true,
      get: () => "loading",
    });

    dom.window.eval(presentationScript(rules, BRAND));

    expect(dom.window.location.pathname).toBe("/");
    expect(dom.window.document.querySelector("header")?.textContent).toBe("Example ERP");
    dom.window.dispatchEvent(new dom.window.Event("load"));
    expect(frames).toHaveLength(1);
    frames.shift()?.(0);
    expect(dom.window.document.querySelector("header")?.textContent).toBe("Example ERP");
    frames.shift()?.(16);
    expect(dom.window.document.querySelector("header")?.textContent).toBe("Software Vala");
    expect(dom.window.document.querySelector("table")?.textContent).toBe("Example ERP");

    dom.window.close();
  });

  it("reports what is left when a rule did not take", () => {
    expect(remainingViolations(PAGE, RULES)).toEqual(
      expect.arrayContaining(["sales@acme-devs.example"]),
    );
  });

  it("cleans a single-page app bundle without touching its code", () => {
    const js = `var a={email:"sales@acme-devs.example",by:"Acme Devs",n:1};`;
    // The developer's address used to be deleted, leaving email:"" - so an app
    // whose own "contact us" read from that string showed an empty line and the
    // demo looked broken rather than rebranded. It carries ours now. The shape
    // of the code around it is still untouched, which is what this test is for.
    expect(cleanText(js, RULES, BRAND.name)).toBe(
      `var a={email:"${SOFTWARE_VALA_CONTACT.email}",by:"Software Vala",n:1};`,
    );
  });

  it("rewrites a base WhatsApp URL in a bundle without duplicating the new destination", () => {
    const rules: PresentationRules = {
      remove: [],
      rebrand: [],
      logos: [],
      links: ["https://wa.me/"],
    };
    const cleaned = cleanBundle('const contact = "https://wa.me/";', rules, BRAND.name);

    expect(cleaned).toContain(`"https://wa.me/${SOFTWARE_VALA_CONTACT.phone.replace(/\D/g, "")}"`);
    expect(remainingBundleViolations(cleaned, rules)).toEqual([]);
  });

  it("keys contact details the same way however they are written", () => {
    expect(contactKey("tel:+91 98765 43210")).toBe(contactKey("https://wa.me/919876543210"));
    expect(contactKey("mailto:Sales@Acme-Devs.example")).toBe("e:sales@acme-devs.example");
    expect(contactKey("https://www.acme-devs.example/about")).toBe("h:acme-devs.example");
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
    expect(assertPublicUrl("https://some-random-domain.com/demo").hostname).toBe(
      "some-random-domain.com",
    );
  });

  it.each([
    "10.1.2.3",
    "172.20.0.1",
    "100.64.0.1",
    "::ffff:127.0.0.1",
    "fd00::1",
    "fe80::1",
    "0.0.0.0",
  ])("blocks the resolved address %s", (ip) => expect(addressBlocked(ip)).toBe(true));
  it.each(["93.184.216.34", "2606:4700::6810:84e5"])("allows %s", (ip) =>
    expect(addressBlocked(ip)).toBe(false),
  );
});

describe("stripPlatformBranding", () => {
  it("takes out the hosting platform's badge, script and back-link", () => {
    const page = [
      "<html><head>",
      '<meta property="og:title" content="my-app | Built with Lovable">',
      '<script src="https://cdn.gpteng.co/gptengineer.js"></script>',
      "</head><body>",
      '<aside id="lovable-badge" aria-label="Edit with Lovable"><a id="lovable-badge-cta" href="https://lovable.dev/projects/abc123">Edit with Lovable</a><button>Dismiss</button></aside>',
      '<script src="/_vercel/insights/script.js"></script>',
      "<p>Real product content stays</p>",
      "</body></html>",
    ].join("");

    const { html, removed } = stripPlatformBranding(page);

    expect(html).not.toContain("gpteng.co");
    expect(html).not.toContain("lovable.dev/projects");
    expect(html).not.toContain('id="lovable-badge"');
    expect(html).not.toContain("Edit with Lovable");
    expect(html).not.toContain("_vercel/insights");
    // The preview tag is kept and rewritten, not deleted.
    expect(html).toContain('property="og:title"');
    expect(html).toContain('content="Software Vala"');
    // Nothing of the product itself is touched.
    expect(html).toContain("Real product content stays");
    expect(removed.length).toBeGreaterThan(0);
  });

  it("leaves a page that carries no platform furniture alone", () => {
    const page =
      '<html><head><meta name="description" content="A school ERP"></head><body>Hello</body></html>';
    const { html, removed } = stripPlatformBranding(page);
    expect(html).toBe(page);
    expect(removed).toEqual([]);
  });
});

describe("cleanText contact replacement", () => {
  const rules = {
    remove: ["hello@devstudio.com", "+91 90000 00001"],
    rebrand: ["DevStudio"],
    logos: [],
    links: [],
  };

  it("puts Software Vala's contact where the developer's was", () => {
    const cleaned = cleanText(
      "Write to hello@devstudio.com or call +91 90000 00001. Made by DevStudio.",
      rules,
      "Software Vala",
    );
    expect(cleaned).not.toContain("hello@devstudio.com");
    expect(cleaned).not.toContain("90000 00001");
    expect(cleaned).toContain(SOFTWARE_VALA_CONTACT.email);
    expect(cleaned).toContain(SOFTWARE_VALA_CONTACT.phone);
    // A studio name still becomes ours rather than being replaced by a contact.
    expect(cleaned).toContain("Made by Software Vala");
  });
  describe("SPA bundle contact evidence", () => {
    it("preserves real record identities, barcodes, licenses and displayed admin accounts", () => {
      const bundle = `const user={phone:"9876543210",parentPhone:"9876543211",emergencyContact:"9876543212"};
        const item={barcode:"8901725111113",licenseKey:"2345-3456-4567",backupKey:"5678-2345-3456"};
        const credentials={usernames:["softwarevala@admin.com"],keys:["234534564567"]};
        const vector={viewBox:"0 0 600 450"};
        jsx("div",{children:[jsx("p",{children:"Admin User"}),jsx("p",{children:"admin@vtc.com"})]});
        jsx("div",{children:[jsx("p",{children:"License Key"}),jsx("p",{children:"2345-3456-4567"})]});
        const footer=[" info@nursinginstitute.edu"," +91 98765 43210"];`;
      const evidence = extractEvidence("<html></html>", "https://health-prep-forge.lovable.app/", [
        bundle,
      ]);
      expect(evidence.emails).toEqual(["info@nursinginstitute.edu"]);
      expect(evidence.phones).toEqual(["+91 98765 43210"]);
      const rules: PresentationRules = {
        remove: [
          "9876543210",
          "9876543211",
          "9876543212",
          "8901725111113",
          "2345-3456-4567",
          "5678-2345-3456",
          "softwarevala@admin.com",
          "234534564567",
          "0 0 600 450",
          "admin@vtc.com",
          "info@nursinginstitute.edu",
          "+91 98765 43210",
        ],
        links: [],
        logos: [],
        rebrand: [],
      };
      const cleaned = cleanBundle(bundle, rules, BRAND.name);
      expect(cleaned).toContain('barcode:"8901725111113"');
      expect(cleaned).toContain('phone:"9876543210"');
      expect(cleaned).toContain('usernames:["softwarevala@admin.com"]');
      expect(cleaned).toContain('children:"admin@vtc.com"');
      expect(cleaned).toContain('children:"2345-3456-4567"');
      expect(remainingBundleViolations(cleaned, rules)).toEqual([]);
    });

    it("proxies real root-relative CSS images and literal assets without changing app routes", () => {
      const prefix = "/api/proxy/demo/nursing-training-institute";
      expect(rewriteDemoAssetPaths("url('/images/hero-bg.jpg')", prefix)).toBe(
        `url('${prefix}/images/hero-bg.jpg')`,
      );
      expect(rewriteDemoAssetPaths("/images/hero-bg.jpg", prefix)).toBe(
        `${prefix}/images/hero-bg.jpg`,
      );
      expect(rewriteDemoAssetPaths("/student", prefix)).toBe("/student");
      expect(rewriteDemoAssetPaths("https://example.com/image.jpg", prefix)).toBe(
        "https://example.com/image.jpg",
      );
      expect(rewriteDemoAssetPaths(`${prefix}/images/hero-bg.jpg`, prefix)).toBe(
        `${prefix}/images/hero-bg.jpg`,
      );
      const rules: PresentationRules = { remove: [], links: [], logos: [], rebrand: [] };
      const cleaned = cleanBundle(
        `const style="url('/images/hero-bg.jpg')"; const route="/student";`,
        rules,
        BRAND.name,
        prefix,
      );
      expect(cleaned).toContain(`${prefix}/images/hero-bg.jpg`);
      expect(cleaned).toContain('route="/student"');
    });

    it("protects actual login, placeholder and vector properties while replacing footer literals", () => {
      const bundle = `const login={email:"admin@nursing.edu"};
        const form={placeholder:"+91 98765 43210"};
        const vector={points:"12 6 12 12 16 14",xmlns:"http://www.w3.org/2000/svg"};
        const api="https://project.supabase.co";
        const link={href:"https://vendor.example/contact"};
        const footer=[" info@nursinginstitute.edu"," +91 98765 43210"];`;
      const evidence = extractEvidence("<html></html>", "https://health-prep-forge.lovable.app/", [
        bundle,
      ]);
      expect(evidence.emails).toEqual(["info@nursinginstitute.edu"]);
      expect(evidence.phones).toEqual(["+91 98765 43210"]);
      expect(evidence.externalLinks.map((link) => link.href)).toEqual([
        "https://vendor.example/contact",
      ]);
      const rules: PresentationRules = {
        remove: [
          "admin@nursing.edu",
          "info@nursinginstitute.edu",
          "+91 98765 43210",
          "12 6 12 12 16 14",
        ],
        rebrand: [],
        logos: [],
        links: [
          "http://www.w3.org/2000/svg",
          "https://project.supabase.co",
          "https://vendor.example/contact",
        ],
      };
      const cleaned = cleanBundle(bundle, rules, BRAND.name);
      expect(cleaned).toContain('email:"admin@nursing.edu"');
      expect(cleaned).toContain('placeholder:"+91 98765 43210"');
      expect(cleaned).toContain('points:"12 6 12 12 16 14"');
      expect(cleaned).toContain('xmlns:"http://www.w3.org/2000/svg"');
      expect(cleaned).toContain('"https://project.supabase.co"');
      expect(cleaned).toContain(SOFTWARE_VALA_CONTACT.email);
      expect(cleaned).toContain(` ${SOFTWARE_VALA_CONTACT.phone}`);
      expect(remainingBundleViolations(cleaned, rules)).toEqual([]);
    });

    it("does not manufacture phone evidence by joining unrelated interface strings", () => {
      const bundle = 'const a="office extension 12345"; const b="56789 reception desk";';
      const evidence = extractEvidence("<html></html>", "https://health-prep-forge.lovable.app/", [
        bundle,
      ]);
      expect(evidence.phones).toEqual([]);
    });

    it("lexes real footer literals after empty strings, long strings, comments and quote regexes", () => {
      const bundle = `/* a developer's comment */
        const quote = /["']/;
        const empty = "";
        const long = "${"x".repeat(400)}";
        u.jsxs("div",{className:"space-y-2",children:[
          u.jsxs("div",{className:"flex items-center gap-2 text-sm text-primary-foreground/60",children:[u.jsx(UU,{className:"h-4 w-4"})," +91 98765 43210"]}),
          u.jsxs("div",{className:"flex items-center gap-2 text-sm text-primary-foreground/60",children:[u.jsx(GN,{className:"h-4 w-4"})," info@nursinginstitute.edu"]})
        ]});`;
      const evidence = extractEvidence("<html></html>", "https://health-prep-forge.lovable.app/", [
        bundle,
      ]);
      expect(evidence.emails).toContain("info@nursinginstitute.edu");
      expect(evidence.phones).toContain("+91 98765 43210");
      expect(bundleStrings(bundle)).not.toContain("x".repeat(400));
    });

    it("reads footer contacts after the old library-string ceiling", () => {
      const prefix = Array.from({ length: 2500 }, (_, index) =>
        JSON.stringify(`Framework library message ${index}`),
      ).join(";");
      const bundle = `${prefix};["info@nursinginstitute.edu","+91 98765 43210","Contact Us"];`;
      const evidence = extractEvidence(
        "<html><body></body></html>",
        "https://health-prep-forge.lovable.app/",
        [bundle],
      );
      expect(evidence.emails).toContain("info@nursinginstitute.edu");
      expect(evidence.phones).toContain("+91 98765 43210");
      expect(bundleStrings(bundle).length).toBeLessThanOrEqual(600);
    });

    it("retains phone-only literals and contact links within the evidence budget", () => {
      const strings = bundleStrings(
        '["+91 98765 43210","tel:+919876543210","mailto:info@nursinginstitute.edu","https://vendor.example/contact"]',
      );
      expect(strings).toContain("+91 98765 43210");
      expect(strings).toContain("tel:+919876543210");
      expect(strings).toContain("mailto:info@nursinginstitute.edu");
      expect(strings).toContain("https://vendor.example/contact");
    });
  });
});
