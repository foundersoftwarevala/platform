import { TopUtilityBar } from "@/components/sapphire-home/TopUtilityBar";

/**
 * Utility strip — exact clone of FeatureStrip (same shell, same size, same
 * flat 11px text + 3.5 icon style). Only the subject changes:
 * Apply Now · Language · Calendar · Calculator · Login · Currency ·
 * Notifications · My Favorites · AI Chat
 */
const UtilityStrip = ({ favoritesCount = 0 }: { favoritesCount?: number }) => (
  <div className="relative z-30 border-b border-white/10 bg-black/40 px-4 py-2.5 backdrop-blur-md sm:px-6 lg:px-10">
    <div className="feature-clone mx-auto w-full max-w-7xl text-[11px] text-white/80">
      <TopUtilityBar favoritesCount={favoritesCount} />
    </div>
  </div>
);

export default UtilityStrip;
