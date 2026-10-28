import type { AyraFormFieldDescriptor, AyraFormFill } from "./ayra-autofill.server";

export type CompanyFormControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

type InspectedCompanyForm = {
  controls: CompanyFormControl[];
  fields: AyraFormFieldDescriptor[];
};

const ALLOWED_INPUT_TYPES = new Set(["text", "email", "tel", "url", "search"]);
const SENSITIVE_FIELD = /(?:password|secret|token|credit|debit|card|cvv|cvc|ssn|tax|vat|iban|swift|routing|bank)/i;
const DISALLOWED_AUTOCOMPLETE = /(?:password|one-time-code|cc-|transaction-amount|transaction-currency)/i;

function nonEmpty(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 200) : undefined;
}

function controlLabel(control: CompanyFormControl): string | undefined {
  const labels = control.labels ? Array.from(control.labels) : [];
  return nonEmpty(
    [
      ...labels.map((label) => label.textContent ?? ""),
      control.getAttribute("aria-label") ?? "",
      control.getAttribute("title") ?? "",
    ].join(" "),
  );
}

function isAllowed(control: CompanyFormControl): boolean {
  if ((control as HTMLInputElement).disabled || (control as HTMLInputElement).readOnly) return false;
  if (control instanceof control.ownerDocument.defaultView!.HTMLInputElement) {
    if (!ALLOWED_INPUT_TYPES.has(control.type.toLowerCase())) return false;
  }
  const metadata = [
    control.name,
    control.id,
    control.getAttribute("autocomplete") ?? "",
    control.getAttribute("aria-label") ?? "",
  ].join(" ");
  if (SENSITIVE_FIELD.test(metadata)) return false;
  if (DISALLOWED_AUTOCOMPLETE.test(control.getAttribute("autocomplete") ?? "")) return false;
  return true;
}

function isEmpty(control: CompanyFormControl): boolean {
  return control.value.trim() === "";
}

export function inspectEmptyCompanyFormControls(page: Document): InspectedCompanyForm {
  const view = page.defaultView;
  if (!view) return { controls: [], fields: [] };
  const controls = Array.from(page.querySelectorAll("input, textarea, select"))
    .filter((element): element is CompanyFormControl =>
      element instanceof view.HTMLInputElement ||
      element instanceof view.HTMLTextAreaElement ||
      element instanceof view.HTMLSelectElement,
    )
    .filter((control) => isAllowed(control) && isEmpty(control));
  return {
    controls,
    fields: controls.map((control, index) => ({
      index,
      name: nonEmpty(control.name),
      id: nonEmpty(control.id),
      label: controlLabel(control),
      placeholder: nonEmpty(control.getAttribute("placeholder")),
      autocomplete: nonEmpty(control.getAttribute("autocomplete"))?.split(/\s+/).at(-1),
    })),
  };
}

function normalizeOption(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function setControlValue(control: CompanyFormControl, value: string): boolean {
  const view = control.ownerDocument.defaultView;
  if (!view || !isEmpty(control)) return false;
  if (control instanceof view.HTMLSelectElement) {
    const wanted = normalizeOption(value);
    const option = Array.from(control.options).find(
      (candidate) =>
        candidate.value.trim() !== "" &&
        (normalizeOption(candidate.value) === wanted || normalizeOption(candidate.text) === wanted),
    );
    if (!option) return false;
    control.value = option.value;
  } else {
    const prototype =
      control instanceof view.HTMLTextAreaElement
        ? view.HTMLTextAreaElement.prototype
        : view.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (!setter) return false;
    setter.call(control, value);
  }
  control.dispatchEvent(new view.Event("input", { bubbles: true }));
  control.dispatchEvent(new view.Event("change", { bubbles: true }));
  return true;
}

export function fillCompanyFormControls(
  controls: CompanyFormControl[],
  matches: AyraFormFill[],
  view: Window | null,
): number {
  if (!view) return 0;
  let filled = 0;
  for (const match of matches) {
    const control = controls[match.index];
    if (control && isAllowed(control) && setControlValue(control, match.value)) filled += 1;
  }
  return filled;
}
