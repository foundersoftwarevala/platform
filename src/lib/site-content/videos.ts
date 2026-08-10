/**
 * Vala TV video content — editable from Marketplace Manager -> Growth -> Vala TV.
 */
import { createTable, uid } from "@/lib/marketplace-manager/store";

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

const seed: Array<[string, string, string, string, string]> = [
  ["How MediCore 360 powers 42 hospitals", "https://www.youtube.com/watch?v=aqz-KE-bpKQ", "4:12", "12k", "Customer Film"],
  ["Inside ShopEngine — multi-vendor at scale", "https://www.youtube.com/watch?v=aqz-KE-bpKQ", "7:48", "8.3k", "Product Demo"],
  ["Build a school OS with EduFlow", "https://www.youtube.com/watch?v=aqz-KE-bpKQ", "5:21", "15k", "Walkthrough"],
  ["Launch a white-label storefront in 24 hours", "https://www.youtube.com/watch?v=aqz-KE-bpKQ", "6:02", "9.4k", "White Label"],
  ["Turn any product into multi-tenant SaaS", "https://www.youtube.com/watch?v=aqz-KE-bpKQ", "8:15", "6.7k", "SaaS"],
  ["Reseller playbook — first 10 clients", "https://www.youtube.com/watch?v=aqz-KE-bpKQ", "9:03", "5.2k", "Academy"],
];

export const VIDEO_SEED: ValaVideo[] = seed.map(([title, url, duration, views, category], i) => ({
  id: `vtv-${i + 1}`,
  title,
  url,
  thumbnail: "",
  duration,
  views,
  category,
  published: true,
  order: i + 1,
}));

export const videoTable = createTable<ValaVideo>("vala-tv", VIDEO_SEED);

export const listVideos = () => videoTable.all().sort((a, b) => a.order - b.order);
export const listPublishedVideos = () => listVideos().filter((v) => v.published);

export const newVideo = (): ValaVideo => ({
  id: uid(),
  title: "",
  url: "",
  thumbnail: "",
  duration: "",
  views: "0",
  category: "Product Demo",
  published: false,
  order: listVideos().length + 1,
});

/** Best-effort embed URL for YouTube/Vimeo links, else the raw url. */
export function embedUrl(url: string): string {
  const yt = url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{6,})/);
  if (yt?.[1]) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm?.[1]) return `https://player.vimeo.com/video/${vm[1]}`;
  return url;
}