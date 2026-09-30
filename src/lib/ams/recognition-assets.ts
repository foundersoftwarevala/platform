// The art a recognition is presented with: the role's own badge, certificate
// and legacy medal, and the role-and-stage trophy render. Returns undefined
// when a role has no art of that kind, and the caller falls back to the
// generic 3D asset for the kind.
import { stageRender } from "@/lib/ams/trophy-stage-assets";

function keyed(map: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(map).map(([path, url]) => [path.slice(path.lastIndexOf("/") + 1).replace(/\.png$/, ""), url]),
  );
}

const badges = keyed(
  import.meta.glob<string>("/src/assets/badges/*.png", { eager: true, query: "?url", import: "default" }),
);
const certificates = keyed(
  import.meta.glob<string>("/src/assets/certificates/*.png", { eager: true, query: "?url", import: "default" }),
);
const legacyMedals = keyed(
  import.meta.glob<string>("/src/assets/legacy-medals/*.png", { eager: true, query: "?url", import: "default" }),
);

const two = (n: number) => String(n).padStart(2, "0");

/** Art for one recognition of a role, at a stage where the kind has one. */
export function recognitionArt(type: string, role: string, stage: number | null): string | undefined {
  switch (type) {
    case "trophy":
    case "stage":
    case "legendary":
      return stage ? stageRender(`${role}-${two(stage)}`) : undefined;
    case "legacy":
      return legacyMedals[role] ?? (stage ? stageRender(`${role}-${two(stage)}`) : undefined);
    case "badge":
    case "achievement":
    case "milestone":
      return badges[role];
    case "certificate":
    case "award":
      return certificates[role];
    default:
      return undefined;
  }
}
