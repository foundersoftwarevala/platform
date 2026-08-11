import { Store, Package, TrendingUp, Star } from "lucide-react";
import type { RoleConfig } from "@/lib/roles";
import { SlidingHero, type HeroSlide } from "./AuthorHero";

const VENDOR_SLIDES: HeroSlide[] = [
  {
    eyebrow: "Vendor Storefront",
    title: "Launch and manage your store",
    sub: "Products, orders and fulfillment — one unified command center for your brand.",
    icon: Store,
    gradient: "linear-gradient(120deg, oklch(0.24 0.06 210), oklch(0.32 0.14 200), oklch(0.42 0.18 195))",
    accent: "oklch(0.80 0.16 205)",
  },
  {
    eyebrow: "Catalog",
    title: "Ship products faster",
    sub: "Publish, version and price your catalog with zero-friction workflows.",
    icon: Package,
    gradient: "linear-gradient(120deg, oklch(0.24 0.08 245), oklch(0.32 0.16 235), oklch(0.42 0.20 220))",
    accent: "oklch(0.80 0.18 235)",
  },
  {
    eyebrow: "Revenue",
    title: "Grow sales, own the margin",
    sub: "Live revenue, refunds and payouts wired straight to your dashboard.",
    icon: TrendingUp,
    gradient: "linear-gradient(120deg, oklch(0.24 0.10 175), oklch(0.32 0.16 165), oklch(0.42 0.22 155))",
    accent: "oklch(0.80 0.18 165)",
  },
  {
    eyebrow: "Trust & Reviews",
    title: "Build a 5-star reputation",
    sub: "Ratings, verified badges and buyer trust signals in one place.",
    icon: Star,
    gradient: "linear-gradient(120deg, oklch(0.26 0.08 60), oklch(0.34 0.16 50), oklch(0.46 0.20 35))",
    accent: "oklch(0.82 0.18 60)",
  },
];

export function VendorSliderHero({ role, onCta }: { role: RoleConfig; onCta?: () => void }) {
  return <SlidingHero role={role} onCta={onCta} slides={VENDOR_SLIDES} />;
}