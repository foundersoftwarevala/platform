// @vitest-environment jsdom
import { expect, it } from "vitest";
import { presentationScript, SOFTWARE_VALA_CONTACT } from "./presentation";

it("replaces late-rendered vendor contacts without deleting contact actions or application data", async () => {
  window.eval(
    presentationScript(
      {
        remove: ["info@nursinginstitute.edu", "+91 98765 43210"],
        rebrand: [],
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
  document.body.innerHTML = `<footer>
    <a href="mailto:info@nursinginstitute.edu">info@nursinginstitute.edu</a>
    <a href="tel:+919876543210">+91 98765 43210</a>
    <a href="https://wa.me/919876543210">WhatsApp us</a>
  </footer><input placeholder="you@nursing.edu"><p>jane.roe@patient.test</p><section data-record-card><h3>Contact Information</h3><p>+91 98765 43210</p><a href="mailto:info@nursinginstitute.edu">info@nursinginstitute.edu</a></section><table><tbody><tr><td>+91 98765 43210</td><td><a href="mailto:info@nursinginstitute.edu">info@nursinginstitute.edu</a></td></tr></tbody></table>`;
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
  expect(document.querySelector("table")?.textContent).toContain("+91 98765 43210");
  expect(document.querySelector("table a")?.getAttribute("href")).toBe(
    "mailto:info@nursinginstitute.edu",
  );
  expect(document.querySelector("[data-record-card]")?.textContent).toContain("+91 98765 43210");
  expect(document.querySelector("[data-record-card] a")?.getAttribute("href")).toBe(
    "mailto:info@nursinginstitute.edu",
  );
});
