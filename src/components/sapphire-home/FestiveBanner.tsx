import { useEffect, useState } from "react";

import { X, PartyPopper, Tag, Handshake, Store, Share2, Building2, Search, Megaphone, Headphones } from "lucide-react";

/** Plain (single) premium colours — no gradients, no shades. */
const COLORS = [
  "bg-[oklch(0.55_0.19_264)]",
  "bg-[oklch(0.56_0.17_190)]",
  "bg-[oklch(0.55_0.20_25)]",
  "bg-[oklch(0.58_0.17_150)]",
  "bg-[oklch(0.55_0.19_300)]",
  "bg-[oklch(0.60_0.17_60)]",
  "bg-[oklch(0.54_0.18_340)]",
  "bg-[oklch(0.55_0.16_230)]",
];

const announcements = [
  { icon: Handshake, title: "🤝 Join as Reseller —", badge: "Upto 40% Margin", text: "Sell 147 products under your own brand." },
  { icon: Store, title: "🏪 Franchise Partner —", badge: "City Exclusive", text: "Own your territory with full support." },
  { icon: Share2, title: "🔗 Affiliate Program —", badge: "20% Commission", text: "Earn on every referral, lifetime." },
  { icon: Building2, title: "🏢 Become a Vendor —", badge: "0% Listing Fee", text: "List your software on our marketplace." },
  { icon: Search, title: "📈 SEO Partner —", badge: "Growth Plans", text: "Rank higher with our SEO experts." },
  { icon: Megaphone, title: "🎤 Influencer Program —", badge: "Paid Collabs", text: "Promote and earn with every campaign." },
  { icon: Headphones, title: "🌍 Global Support —", badge: "24×7 Live Help", text: "Human + AI assistance in 12 languages." },
  { icon: PartyPopper, title: "🎉 Mega Software Sale —", badge: "Flat 40% OFF", text: "Lifetime access on all 147 products!" },
];

const FestiveBanner = () => {
  const [dismissed, setDismissed] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % announcements.length), 4200);
    return () => clearInterval(t);
  }, []);

  if (dismissed) return null;
  const item = announcements[index]!;
  const Icon = item.icon;
  const color = COLORS[index % COLORS.length];

  return (
    <div className="w-full">
      <div className={`relative w-full overflow-hidden ${color} py-1 transition-colors duration-500`}>
        <div className="relative z-10 mx-auto px-8 flex items-center justify-center text-white">
          <div key={index} className="flex items-center gap-2 animate-[fade-in_.4s_ease-out]">
            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="text-[11px] sm:text-xs font-bold truncate">{item.title}</span>
            <span className="px-2 py-0.5 rounded-md bg-white/20 text-[11px] sm:text-xs font-black whitespace-nowrap border border-white/25">
              {item.badge}
            </span>
            <span className="hidden md:inline text-[11px] font-medium text-white/85 truncate">{item.text}</span>
            <Tag className="w-3 h-3 flex-shrink-0 hidden sm:block" />
          </div>
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-5 h-5 rounded-full bg-white/20 hover:bg-white/35 flex items-center justify-center text-white transition-colors border border-white/25"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

export default FestiveBanner;
