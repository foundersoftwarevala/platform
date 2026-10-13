import { chat } from "./model.server.ts";
import { getSettings } from "./settings.server.ts";

const FALLBACK_TEMPLATE = (name: string, color: string) => `
<!DOCTYPE html>
<html>
<head>
    <title>${name}</title>
    <style>
        body { font-family: sans-serif; margin: 0; padding: 2rem; color: #333; }
        header { border-bottom: 2px solid ${color}; padding-bottom: 1rem; }
        h1 { color: ${color}; }
        .content { margin-top: 2rem; }
    </style>
</head>
<body>
    <header><h1>${name}</h1></header>
    <div class="content">
        <p>Welcome to ${name}. This is a placeholder site generated offline.</p>
    </div>
</body>
</html>
`;

const THEMES: Record<string, string> = {
  modern: "#2563eb",
  classic: "#1e293b",
  playful: "#db2777",
  elegant: "#4f46e5"
};

export async function generateSite(pageType: string, businessName: string, theme: string, instruction?: string) {
  const settings = getSettings();
  const color = THEMES[theme] || THEMES.modern;

  if (settings.model_source === "local" && !settings.model_url) {
    return FALLBACK_TEMPLATE(businessName, color);
  }

  try {
    const prompt = instruction 
      ? `The user wants to update the following HTML site for a ${pageType} named "${businessName}". Theme color is ${color}. Instruction: ${instruction}`
      : `Create a single self-contained HTML file for a ${pageType} website named "${businessName}". Use a ${theme} theme with primary color ${color}. Include some sample content.`;
      
    const reply = await chat([
      { role: "system", content: "You are a web developer. Return only the full HTML code, nothing else." },
      { role: "user", content: prompt }
    ]);
    
    // Extract HTML if model wrapped it in code blocks
    let html = reply.text.trim();
    if (html.includes("<!DOCTYPE html>") || html.includes("<html>")) {
        html = html.replace(/^```html\n?/, "").replace(/\n?```$/, "");
    }
    return html;
  } catch (e) {
    return FALLBACK_TEMPLATE(businessName, color);
  }
}
