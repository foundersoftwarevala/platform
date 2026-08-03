import { ShieldCheck, Clock, BadgeCheck, Lock, Boxes, Zap, Globe2 } from "lucide-react";

const ITEMS = [
  { icon: ShieldCheck, label: "No Advance Payment", color: "text-emerald-300" },
  { icon: Clock, label: "2-Hour Delivery", color: "text-cyan-300" },
  { icon: BadgeCheck, label: "No Hidden Charges", color: "text-amber-300" },
  { icon: Lock, label: "Trademark Protected", color: "text-rose-300" },
  { icon: Boxes, label: "204+ Solutions", color: "text-violet-300" },
  { icon: Zap, label: "20 Live Demos", color: "text-fuchsia-300" },
  { icon: Globe2, label: "Global Support", color: "text-sky-300" },
];

const FeatureStrip = () => (
  <div className="relative z-20 border-b border-white/10 bg-black/40 backdrop-blur-md px-4 sm:px-6 lg:px-10 py-2">
    <div className="max-w-7xl mx-auto w-full flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-[11px] text-white/80">
      {ITEMS.map(({ icon: Icon, label, color }) => (
        <span key={label} className="flex items-center gap-1.5 whitespace-nowrap">
          <Icon className={`h-3.5 w-3.5 ${color} drop-shadow`} /> {label}
        </span>
      ))}
    </div>
  </div>
);

export default FeatureStrip;
