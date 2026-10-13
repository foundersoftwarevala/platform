// CSS variables injected into the generated website (it lives in its own iframe, outside the app's design tokens).
const T: Record<string, [string, string, string, string]> = {
  // primary, accent, hero-from, hero-to
  default: ["#262a33", "#6b7280", "#f1f2f4", "#fafafa"],
  arctic: ["#0284c7", "#94a3b8", "#e0f2fe", "#f8fafc"],
  summer: ["#ea580c", "#f59e0b", "#fde8e4", "#fafafa"],
  fragrant: ["#8b5cf6", "#c4b5fd", "#f3e8ff", "#fafafa"],
  slate: ["#334155", "#94a3b8", "#e2e8f0", "#f8fafc"],
  feminine: ["#db2777", "#f9a8d4", "#fce7f3", "#fafafa"],
  forest: ["#15803d", "#86efac", "#dcfce7", "#f8fafc"],
  midnight: ["#1d4ed8", "#1e1b4b", "#c7d2fe", "#eef2ff"],
};

export function withTheme(html: string, theme: string) {
  const t = T[theme];
  if (!t) return html;
  const css = `<style id="vala-theme">:root{--primary:${t[0]} !important;--primary-foreground:#fff !important;--accent:${t[1]} !important;--hero-from:${t[2]} !important;--hero-to:${t[3]} !important}</style>`;
  return html.includes("</head>") ? html.replace("</head>", `${css}</head>`) : css + html;
}
