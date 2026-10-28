(() => {
  if (globalThis.__ayraAutofillLoaded) return;
  globalThis.__ayraAutofillLoaded = true;

  const sensitive =
    /(?:password|secret|token|credit|debit|card|cvv|cvc|ssn|tax|vat|iban|swift|routing|bank)/i;
  const blockedAutocomplete =
    /(?:password|one-time-code|cc-|transaction-amount|transaction-currency)/i;
  const inputTypes = new Set(["text", "email", "tel", "url", "search"]);
  const clean = (value) => {
    const text = String(value || "").trim();
    return text ? text.slice(0, 200) : undefined;
  };

  function labelFor(control) {
    const labels = control.labels
      ? Array.from(control.labels, (label) => label.textContent || "")
      : [];
    const labelledBy = (control.getAttribute("aria-labelledby") || "")
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => document.getElementById(id)?.textContent || "");
    return clean(
      [
        ...labels,
        ...labelledBy,
        control.getAttribute("aria-label") || "",
        control.getAttribute("title") || "",
      ].join(" "),
    );
  }

  function inspect() {
    const controls = Array.from(document.querySelectorAll("input, textarea, select"))
      .filter((element) => {
        if (element.disabled || element.readOnly || element.value.trim() !== "") return false;
        if (element instanceof HTMLInputElement && !inputTypes.has(element.type.toLowerCase()))
          return false;
        const autocomplete = element.getAttribute("autocomplete") || "";
        const metadata = [
          element.name,
          element.id,
          autocomplete,
          element.getAttribute("aria-label"),
          element.getAttribute("placeholder"),
          labelFor(element),
        ].join(" ");
        return !sensitive.test(metadata) && !blockedAutocomplete.test(autocomplete);
      })
      .slice(0, 100);

    return {
      controls,
      fields: controls.map((control, index) => ({
        index,
        name: clean(control.name),
        id: clean(control.id),
        label: labelFor(control),
        placeholder: clean(control.getAttribute("placeholder")),
        autocomplete: clean(control.getAttribute("autocomplete"))?.split(/\s+/).at(-1),
      })),
    };
  }

  function normalize(value) {
    return String(value || "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function setValue(control, value) {
    if (!control || control.disabled || control.readOnly || control.value.trim() !== "")
      return false;
    if (control instanceof HTMLSelectElement) {
      const wanted = normalize(value);
      const option = Array.from(control.options).find(
        (candidate) =>
          candidate.value.trim() &&
          (normalize(candidate.value) === wanted || normalize(candidate.text) === wanted),
      );
      if (!option) return false;
      control.value = option.value;
    } else {
      const prototype =
        control instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
      if (!setter) return false;
      setter.call(control, value);
    }
    control.dispatchEvent(new Event("input", { bubbles: true }));
    control.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "AYRA_START_FILL") return false;
    const { controls, fields } = inspect();
    if (!fields.length) {
      sendResponse({ ok: true, filled: 0, message: "No supported empty fields were found." });
      return false;
    }

    chrome.runtime.sendMessage({ type: "AYRA_MATCH_FIELDS", fields }, (result) => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      if (result?.error) {
        sendResponse({ ok: false, error: result.error });
        return;
      }
      const fills = Array.isArray(result?.fills) ? result.fills : [];
      const filled = fills.reduce(
        (count, item) => count + (setValue(controls[item.index], item.value) ? 1 : 0),
        0,
      );
      sendResponse({
        ok: true,
        filled,
        message: filled
          ? `Filled ${filled} field${filled === 1 ? "" : "s"}. Review before submitting.`
          : "No matching fields were found.",
      });
    });
    return true;
  });
})();
