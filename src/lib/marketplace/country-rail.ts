import {
  Activity, Anchor, Award, Baby, BarChart3, BookOpen, Boxes, Brain, Briefcase,
  Building, Building2, Bus, Calculator, Calendar, Camera, Car, ClipboardCheck,
  Cloud, Cpu, CreditCard, Database, Dumbbell, Factory, FileText, Gamepad2,
  GraduationCap, Headphones, Heart, Home, Hospital, Hotel, Key, Landmark,
  Layers, Lock, Megaphone, Mic, MonitorPlay, Package, PawPrint, PhoneCall,
  Plane, Recycle, Scale, Scissors, Settings, Shield, ShoppingBag, ShoppingCart,
  Sparkles, Sprout, Star, Stethoscope, Trophy, Truck, UserCheck, Users,
  Utensils, Wallet, Waves, Zap, type LucideIcon,
} from "lucide-react";

import type { Demo } from "@/data/extraDemos";
import { RAIL_COUNTRY_BY_MARKER } from "./rail-countries";

/**
 * The real catalogue products behind a home page shelf, one per country.
 *
 * A shelf is one category and every card on it is one country, so the fifth
 * card is the same country whichever shelf a visitor is looking at: someone in
 * Kenya scrolling the page sees a different product on every shelf, each one
 * targeted at Kenya. The catalogue already holds that relationship - one
 * product per category per country - and this fetches it through the endpoint
 * the marketplace already uses, in country order.
 *
 * Nothing here invents a product. A card carries only what the catalogue
 * records: its name, its description, its price label, the features that are
 * stored against it. Where the catalogue has no product for a country, that
 * country simply has no card, and the response says which ones those are.
 *
 * The shelf's own cards are not touched. These are added after them.
 */

/** What the catalogue endpoint returns for one card. */
export type RailCard = {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  industry: string | null;
  price: string | null;
  period: string | null;
  country: string | null;
  href: string;
  description: string | null;
  features: string[];
  tech: string[];
  subcategory: string | null;
  hasDemo: boolean;
};

export type RailPage = {
  category: { name: string; slug: string };
  cards: RailCard[];
  total: number;
  countries: number;
  missing: string[];
};

const ICONS: Record<string, LucideIcon> = {
  Activity, Anchor, Award, Baby, BarChart3, BookOpen, Boxes, Brain, Briefcase,
  Building, Building2, Bus, Calculator, Calendar, Camera, Car, ClipboardCheck,
  Cloud, Cpu, CreditCard, Database, Dumbbell, Factory, FileText, Gamepad2,
  GraduationCap, Headphones, Heart, Home, Hospital, Hotel, Key, Landmark,
  Layers, Lock, Megaphone, Mic, MonitorPlay, Package, PawPrint, PhoneCall,
  Plane, Recycle, Scale, Scissors, Settings, Shield, ShoppingBag, ShoppingCart,
  Sparkles, Sprout, Star, Stethoscope, Trophy, Truck, UserCheck, Users,
  Utensils, Wallet, Waves, Zap,
};

/**
 * One shelf's country cards.
 *
 * Asks for the whole shelf at once because a shelf is as long as the country
 * list and the endpoint caches its answer for a minute, so a second visitor
 * within that minute costs the database nothing.
 */
export async function fetchCountryRail(
  slug: string,
  limit: number,
  signal?: AbortSignal,
): Promise<RailPage | null> {
  try {
    const response = await fetch(
      `/api/marketplace/catalog?category=${encodeURIComponent(slug)}&order=country&limit=${limit}`,
      { signal },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as Partial<RailPage> & { error?: string };
    if (payload.error || !Array.isArray(payload.cards)) return null;
    return {
      category: payload.category ?? { name: slug, slug },
      cards: payload.cards,
      total: payload.total ?? payload.cards.length,
      countries: payload.countries ?? 0,
      missing: payload.missing ?? [],
    };
  } catch {
    // An aborted or failed request leaves the shelf exactly as it was.
    return null;
  }
}

/**
 * A catalogue card as the home page's card component reads it.
 *
 * The shelf's own cards carry a gradient and a pair of prices because that is
 * how they were written. A catalogue product carries one price label and no
 * gradient, so the gradient is taken from the shelf it is on - the same one
 * its neighbours use - and the second price is left empty rather than
 * invented. Nothing is claimed about a product that the catalogue does not
 * record: no rating, no download count, no technology.
 */
export function railCardToDemo(card: RailCard, shelf: string, color: string): Demo {
  const country = card.country ? RAIL_COUNTRY_BY_MARKER.get(card.country) ?? null : null;
  const icon = (card.icon && ICONS[card.icon]) || Boxes;
  const region = country ? `${country.label} · ${country.region}` : null;

  return {
    id: `catalogue-${card.id}`,
    name: card.name,
    category: card.subcategory || card.industry || shelf,
    masterCategory: shelf,
    description: card.description ?? "",
    // The product page, which is where a card has always led. A demo is only
    // opened from here when the catalogue records one.
    url: card.href,
    icon,
    status: card.hasDemo ? "ACTIVE" : "COMING_SOON",
    features: card.features ?? [],
    // The catalogue records a stack per product only where an author gave one,
    // so the card says the stack depends on the product rather than naming one.
    frontend: [],
    backend: [],
    color,
    price: card.price ?? "",
    discountPrice: "",
    technologyNote:
      card.tech && card.tech.length
        ? card.tech.join(", ")
        : "Product-dependent; exact technology stack must be verified from the actual implementation.",
    businessType: region ?? undefined,
    softwareType: card.industry ?? undefined,
  };
}

/** The gradient a shelf's own cards use, so an added card matches them. */
export function shelfColour(existing: { color?: string }[] | undefined): string {
  const found = existing?.find((d) => typeof d.color === "string" && d.color);
  return found?.color ?? "from-slate-600 to-slate-700";
}
