// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { presentationScript, SOFTWARE_VALA_CONTACT } from "./presentation";

it("keeps a proxied service worker inside its demo without allowing root or sibling scope", async () => {
  const register = vi.fn().mockResolvedValue({ scope: "registered" });
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { register },
  });
  try {
    window.history.replaceState(null, "", "/api/proxy/demo/charity-donation-platform/");
    window.eval(
      presentationScript(
        { remove: [], rebrand: [], logos: [], links: [] },
        { name: "Software Vala", favicon: "/favicon.png", logo: "/assets/sv-logo.jpg" },
      ),
    );
    const prefix = "/api/proxy/demo/charity-donation-platform/";
    const script = `${prefix}sw.js`;
    const options: RegistrationOptions = { scope: "/", type: "module" };
    await navigator.serviceWorker.register(script, options);
    expect(register).toHaveBeenLastCalledWith(script, {
      scope: new URL(prefix, window.location.origin).href,
      type: "module",
    });
    expect(options.scope).toBe("/");
    await navigator.serviceWorker.register(script, { scope: "/api/proxy/demo/another/" });
    expect(register).toHaveBeenLastCalledWith(script, {
      scope: new URL(prefix, window.location.origin).href,
    });
    await navigator.serviceWorker.register(script, { scope: `${prefix}offline/` });
    expect(register).toHaveBeenLastCalledWith(script, { scope: `${prefix}offline/` });
    await navigator.serviceWorker.register(script);
    expect(register).toHaveBeenLastCalledWith(script, undefined);
    const failure = new Error("registration denied");
    register.mockRejectedValueOnce(failure);
    await expect(navigator.serviceWorker.register(script)).rejects.toBe(failure);
  } finally {
    Reflect.deleteProperty(navigator, "serviceWorker");
  }
});

it("replaces late-rendered vendor contacts without deleting contact actions or application data", async () => {
  window.history.replaceState(
    null,
    "",
    "/api/proxy/demo/hotel-management/login?next=dashboard#employee",
  );
  window.eval(
    presentationScript(
      {
        remove: ["info@nursinginstitute.edu", "+91 98765 43210"],
        brandLabels: ["Study Abroad"],
        brandLabelPaths: ["/login"],
        brandMonograms: ["LT"],
        publicContactPaths: ["/contact"],
        rebrand: ["SmartPOS"],
        logos: [],
        links: ["https://wa.me/919876543210"],
      },
      {
        name: "Software Vala",
        favicon: "/favicon.png",
        logo: "/assets/sv-logo.jpg",
      },
    ),
  );
  document.dispatchEvent(new Event("DOMContentLoaded"));
  expect(window.location.pathname).toBe("/login");
  expect(window.location.search).toBe("?next=dashboard");
  expect(window.location.hash).toBe("#employee");
  document.body.innerHTML = `<footer>
    <a href="mailto:info@nursinginstitute.edu">info@nursinginstitute.edu</a>
    <a href="tel:+919876543210">+91 98765 43210</a>
    <a href="https://wa.me/919876543210">WhatsApp us</a>
  </footer><input placeholder="you@nursing.edu"><p>jane.roe@patient.test</p><section data-record-card><h3>Contact Information</h3><p>+91 98765 43210</p><a href="mailto:info@nursinginstitute.edu">info@nursinginstitute.edu</a></section><table><tbody><tr><td>+91 98765 43210</td><td><a href="mailto:info@nursinginstitute.edu">info@nursinginstitute.edu</a></td></tr></tbody></table>`;
  document.body.insertAdjacentHTML(
    "beforeend",
    '<nav><a href="#features"><span data-nav-brand>Smart<span>POS</span></span></a><span data-nav-feature>Study Abroad courses</span><span data-monogram>LT</span></nav><footer><span>Study Abroad</span><p data-split-brand>Smart<span>POS</span></p></footer><p data-feature>Comprehensive Study Abroad Support</p><p data-login-brand>Study Abroad</p><p data-login-monogram>LT</p><form><p data-monogram-record>LT</p></form><footer><table><tbody><tr><td data-brand-record>Study <span>Abroad</span></td></tr></tbody></table></footer>',
  );
  document.body.insertAdjacentHTML(
    "beforeend",
    '<section id="contact"><div><div><h2>Contact Us</h2></div><div><article><h3>Email</h3><p>info@nursinginstitute.edu</p></article><article><h3>Phone</h3><p>+91 98765 43210</p></article></div></div></section>',
  );
  await expect
    .poll(() => document.querySelector("footer")?.textContent)
    .toContain(SOFTWARE_VALA_CONTACT.email);
  expect(document.querySelector("footer")?.textContent).toContain(SOFTWARE_VALA_CONTACT.phone);
  expect(document.querySelector('a[href^="mailto:"]')?.getAttribute("href")).toBe(
    `mailto:${SOFTWARE_VALA_CONTACT.email}`,
  );
  expect(document.querySelector('a[href^="tel:"]')?.getAttribute("href")).toBe(
    `tel:${SOFTWARE_VALA_CONTACT.phone.replace(/\s/g, "")}`,
  );
  expect(document.querySelector("input")?.getAttribute("placeholder")).toBe("you@nursing.edu");
  expect(document.querySelector('a[href^="https://wa.me/"]')?.getAttribute("href")).toBe(
    `https://wa.me/${SOFTWARE_VALA_CONTACT.phone.replace(/\D/g, "")}`,
  );
  await expect
    .poll(() => document.querySelector("section#contact")?.textContent)
    .toContain(SOFTWARE_VALA_CONTACT.email);
  expect(document.querySelector("section#contact")?.textContent).toContain(
    SOFTWARE_VALA_CONTACT.phone,
  );
  expect(document.body.textContent).toContain("jane.roe@patient.test");
  expect(document.querySelector("footer span")?.textContent).toBe("Software Vala");
  expect(document.querySelector("[data-split-brand]")?.textContent).toBe("Software Vala");
  expect(document.querySelector("[data-split-brand] span")).not.toBeNull();
  expect(document.querySelector("[data-brand-record]")?.textContent).toBe("Study Abroad");
  expect(document.querySelector("[data-nav-brand]")?.textContent).toBe("Software Vala");
  expect(document.querySelector("nav a")?.getAttribute("href")).toBe("#features");
  expect(document.querySelector("[data-nav-feature]")?.textContent).toBe("Study Abroad courses");
  expect(document.querySelector("[data-monogram]")?.textContent).toBe("SV");
  expect(document.querySelector("[data-login-brand]")?.textContent).toBe("Software Vala");
  expect(document.querySelector("[data-login-monogram]")?.textContent).toBe("SV");
  expect(document.querySelector("[data-monogram-record]")?.textContent).toBe("LT");
  window.history.replaceState(null, "", "/contact");
  document.body.insertAdjacentHTML(
    "beforeend",
    "<main><article data-public-contact><h3>Email</h3><p>info@nursinginstitute.edu</p></article><form><article data-form-contact><h3>Email</h3><p>info@nursinginstitute.edu</p></article></form><article data-record-card data-private-contact><h3>Email</h3><p>info@nursinginstitute.edu</p></article></main>",
  );
  await expect
    .poll(() => document.querySelector("[data-public-contact] p")?.textContent)
    .toBe(SOFTWARE_VALA_CONTACT.email);
  expect(document.querySelector("[data-form-contact] p")?.textContent).toBe(
    "info@nursinginstitute.edu",
  );
  expect(document.querySelector("[data-private-contact] p")?.textContent).toBe(
    "info@nursinginstitute.edu",
  );
  window.history.replaceState(null, "", "/students");
  document.body.insertAdjacentHTML(
    "beforeend",
    "<article data-other-page><h3>Email</h3><p>info@nursinginstitute.edu</p></article>",
  );
  await new Promise((resolve) => setTimeout(resolve, 450));
  expect(document.querySelector("[data-other-page] p")?.textContent).toBe(
    "info@nursinginstitute.edu",
  );
  expect(document.querySelector("[data-feature]")?.textContent).toBe(
    "Comprehensive Study Abroad Support",
  );
  expect(document.querySelector("table")?.textContent).toContain("+91 98765 43210");
  expect(document.querySelector("table a")?.getAttribute("href")).toBe(
    "mailto:info@nursinginstitute.edu",
  );
  expect(document.querySelector("[data-record-card]")?.textContent).toContain("+91 98765 43210");
  expect(document.querySelector("[data-record-card] a")?.getAttribute("href")).toBe(
    "mailto:info@nursinginstitute.edu",
  );
});
