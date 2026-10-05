export function monitorDemoLogin() {
  let previous: boolean | undefined;
  const report = () => {
    const oneClickSuperAdmin = Array.from(
      document.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLElement>(
        'button, input[type="button"], input[type="submit"], [role="button"]',
      ),
    ).some((element) => {
      const label = (
        element.getAttribute("aria-label") ||
        element.textContent ||
        ("value" in element ? element.value : "") ||
        ""
      )
        .trim()
        .replace(/\s+/g, " ");
      if (
        !/^(?:(?:quick|demo)\s+)?super\s*admin(?:istrator)?(?:\s+(?:login|sign in))?$/i.test(label)
      )
        return false;
      let current: HTMLElement | null = element;
      while (current) {
        const style = getComputedStyle(current);
        if (current.hidden || style.display === "none" || style.visibility === "hidden")
          return false;
        current = current.parentElement;
      }
      return true;
    });
    if (oneClickSuperAdmin === previous) return;
    previous = oneClickSuperAdmin;
    window.parent.postMessage(
      { type: "sv-demo-login-options", oneClickSuperAdmin },
      "https://softwarevala.net",
    );
  };
  const observer = new MutationObserver(report);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["aria-label", "hidden", "style", "class", "role"],
  });
  report();
  return () => observer.disconnect();
}

export function demoLoginMonitorScript(): string {
  return `<script id="sv-demo-login-options">(${monitorDemoLogin.toString()})();</script>`;
}
