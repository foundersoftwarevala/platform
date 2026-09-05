// Registry for the 180 staged trophy renders (18 roles × 10 progression stages)
// and the studio reference photography that art-directs them.

const renders = import.meta.glob<string>("/src/assets/trophy-stages/*.png", {
  eager: true,
  query: "?url",
  import: "default",
});

const references = import.meta.glob<string>("/src/assets/reference-trophies/*.jpg", {
  eager: true,
  query: "?url",
  import: "default",
});

function keyed(map: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(map).map(([path, url]) => [
      path.slice(path.lastIndexOf("/") + 1).replace(/\.(png|jpg)$/, ""),
      url,
    ]),
  );
}

/** id -> render url, e.g. "developer-01". */
export const TROPHY_STAGE_RENDERS = keyed(renders);

export function stageRender(id: string): string | undefined {
  return TROPHY_STAGE_RENDERS[id];
}

export interface ReferencePhoto {
  key: string;
  roleSlug: string;
  src: string;
  label: string;
}

/** Studio reference photography, one per role, keyed by file name. */
export const REFERENCE_PHOTOS: ReferencePhoto[] = Object.entries(keyed(references))
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([key, src], i) => ({
    key,
    roleSlug: key.split("-reference-")[0] ?? key,
    src,
    label: `Reference ${String(i + 1).padStart(2, "0")}`,
  }));

export function referenceForRole(roleSlug: string): ReferencePhoto | undefined {
  return REFERENCE_PHOTOS.find((r) => r.roleSlug === roleSlug);
}
