// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://softwarevala.net/api/proxy/demo/example?t=pass","runScripts":"outside-only","pretendToBeVisual":true}
import { afterEach, describe, expect, it, vi } from "vitest";
import { presentationScript, type PresentationRules } from "./presentation";

const readyState = Object.getOwnPropertyDescriptor(document, "readyState");

afterEach(() => {
  vi.useRealTimers();
  if (readyState) Object.defineProperty(document, "readyState", readyState);
  else Reflect.deleteProperty(document, "readyState");
  document.body.replaceChildren();
});

describe("deferred demo presentation", () => {
  it("normalizes the proxy route immediately but waits for load, 2000ms and two frames before rewriting", () => {
    const rules: PresentationRules = {
      remove: [],
      rebrand: [],
      logos: [],
      links: [],
      brandLabels: ["Example ERP"],
      brandLabelPaths: ["/"],
    };
    vi.useFakeTimers({
      toFake: [
        "setTimeout",
        "clearTimeout",
        "requestAnimationFrame",
        "cancelAnimationFrame",
        "performance",
      ],
    });
    document.body.innerHTML =
      "<header><span>Example</span><span> ERP</span></header><table><tr><td>Example ERP</td></tr></table>";
    Object.defineProperty(document, "readyState", { configurable: true, get: () => "loading" });
    window.eval(
      presentationScript(rules, {
        favicon: "/favicon.png",
        logo: "/assets/sv-logo.jpg",
        name: "Software Vala",
      }),
    );

    const header = () => document.querySelector("header")?.textContent;
    expect(window.location.pathname).toBe("/");
    expect(header()).toBe("Example ERP");
    vi.advanceTimersByTime(3000);
    expect(header()).toBe("Example ERP");
    window.dispatchEvent(new Event("load"));
    vi.advanceTimersByTime(1999);
    expect(header()).toBe("Example ERP");
    vi.advanceTimersByTime(1);
    expect(header()).toBe("Example ERP");
    vi.advanceTimersToNextFrame();
    expect(header()).toBe("Example ERP");
    vi.advanceTimersToNextFrame();
    expect(header()).toBe("Software Vala");
    expect(document.querySelector("table")?.textContent).toBe("Example ERP");
  });
});
