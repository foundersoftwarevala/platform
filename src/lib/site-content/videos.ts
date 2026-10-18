/**
 * Vala TV helpers. The videos themselves live in vala_tv_videos: the storefront
 * reads them through the storefront chrome and Marketplace Manager -> Growth ->
 * Vala TV edits them (sections/ValaTvLive). The browser-side list of seeded
 * videos that used to live here, which the editor wrote to and nothing on the
 * site read, is gone.
 */

export type ValaVideo = {
  id: string;
  title: string;
  /** YouTube / Vimeo / MP4 URL. */
  url: string;
  thumbnail: string;
  duration: string;
  views: string;
  category: string;
  published: boolean;
  order: number;
};

export const VIDEO_CATEGORIES = [
  "Product Demo",
  "Walkthrough",
  "Customer Film",
  "White Label",
  "SaaS",
  "Academy",
] as const;

/**
 * The seeded rows all carry the same stand-in YouTube id, which points at
 * unrelated footage. Until a real URL is set from Marketplace Manager a video
 * counts as unpublished footage rather than something to open, so a viewer is
 * never sent to the wrong film.
 */
const PLACEHOLDER_IDS = ["aqz-KE-bpKQ"];

export function hasPlayableVideo(url: string): boolean {
  const value = (url ?? "").trim();
  if (!value) return false;
  return !PLACEHOLDER_IDS.some((id) => value.includes(id));
}

/** Best-effort embed URL for YouTube/Vimeo links, else the raw url. */
export function embedUrl(url: string): string {
  const yt = url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{6,})/);
  if (yt?.[1]) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm?.[1]) return `https://player.vimeo.com/video/${vm[1]}`;
  return url;
}