import { useTranslation } from "@/lib/i18n/use-translation";

/**
 * The first thing a keyboard user reaches on every page: a link that jumps
 * past the language selector, sidebar and top bar to the page's content.
 * Hidden until it has focus. Mounted once, in the root layout.
 *
 * It goes to #main-content where a page names its content that way, and
 * otherwise to the page's <main>. Focus is moved by hand rather than by
 * following the #hash, so the router never sees a navigation and focus lands
 * on the content itself, from where the next Tab reaches the first control in
 * it. A target that is not focusable is given tabIndex -1, which lets it take
 * focus without joining the tab order.
 */
export function SkipToContent() {
  const { t } = useTranslation();
  return (
    <a
      href="#main-content"
      onClick={(event) => {
        const target = document.getElementById("main-content") ?? document.querySelector("main");
        if (!(target instanceof HTMLElement)) return;
        event.preventDefault();
        if (!target.hasAttribute("tabindex")) target.tabIndex = -1;
        target.focus();
        target.scrollIntoView({ block: "start" });
      }}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {t("common.skip_to_content")}
    </a>
  );
}
