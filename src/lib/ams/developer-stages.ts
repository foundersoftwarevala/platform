// Developer career progression — 10 unique stages. UI/UX data only.
// Each stage has its own material, palette, trophy shape, medal shape,
// passport style, badge motif, nameplate, background theme, and unlock preset.

import type { UnlockPreset } from "./trophy-sounds";

export interface StageReward {
  label: string;
  kind: "trophy" | "medal" | "badge" | "passport" | "certificate" | "frame" | "nameplate" | "identity" | "crown" | "collection" | "museum";
}

export interface StageBackground {
  gradient: string;    // CSS background gradient
  accent: string;      // main hex
  glow: string;        // glow color rgba
  particle: string;    // particle color
}

export interface DeveloperStage {
  n: number;
  code: string;                 // STAGE 01
  title: string;                // Developer Apprentice
  theme: string;                // Startup Developer
  tagline: string;
  material: string;             // Copper, Bronze, Silver, Gold...
  trophyShape: "cup" | "flame" | "obelisk" | "diamond" | "orb" | "crown" | "wing" | "prism" | "tower" | "star";
  medalShape: "circle" | "hexagon" | "shield" | "star" | "octagon" | "gear" | "diamond" | "sun" | "laurel" | "phoenix";
  passportMotif: string;        // pattern name for cover
  badgeStyle: string;
  nameplate: string;            // engraving surface
  ribbon: [string, string];     // ribbon gradient stops
  unlock: UnlockPreset;
  bg: StageBackground;
  rewards: StageReward[];
  animation: string[];
  sound: string[];
}

/* Palette per stage — hand-tuned so no two stages share the same feel. */
export const DEVELOPER_STAGES: DeveloperStage[] = [
  {
    n: 1, code: "STAGE 01",
    title: "Developer Apprentice", theme: "Startup Developer",
    tagline: "First keystrokes. First green build. The journey begins.",
    material: "Copper", trophyShape: "cup", medalShape: "circle",
    passportMotif: "Grid Terminal", badgeStyle: "Pixel Pin",
    nameplate: "Etched Copper Plate", ribbon: ["#b87333", "#6b3a1f"],
    unlock: "starter",
    bg: {
      gradient: "radial-gradient(1200px 500px at 20% 0%, rgba(184,115,51,0.22), transparent 60%), linear-gradient(160deg, #1a120a 0%, #0d0906 100%)",
      accent: "#b87333", glow: "rgba(184,115,51,0.55)", particle: "#e8b47a",
    },
    rewards: [
      { label: "Basic Digital Passport", kind: "passport" },
      { label: "Rookie ID Card", kind: "identity" },
      { label: "Copper Trophy", kind: "trophy" },
      { label: "Rookie Medal", kind: "medal" },
      { label: "Starter Badge", kind: "badge" },
      { label: "Basic Certificate", kind: "certificate" },
      { label: "Simple Profile Frame", kind: "frame" },
      { label: "Starter Nameplate", kind: "nameplate" },
    ],
    animation: ["Soft Glow", "Badge Drop", "Passport Open", "Small Confetti"],
    sound: ["Keyboard Click", "Success Bell", "UI Unlock"],
  },
  {
    n: 2, code: "STAGE 02",
    title: "Junior Developer", theme: "Growing Engineer",
    tagline: "Shipping features. Learning the codebase. Earning trust.",
    material: "Bronze", trophyShape: "flame", medalShape: "hexagon",
    passportMotif: "Bronze Emboss", badgeStyle: "Enamel Pin",
    nameplate: "Brushed Bronze", ribbon: ["#cd7f32", "#5c3410"],
    unlock: "bronze",
    bg: {
      gradient: "radial-gradient(1200px 500px at 80% 0%, rgba(205,127,50,0.28), transparent 60%), linear-gradient(160deg, #1c150c 0%, #100a06 100%)",
      accent: "#cd7f32", glow: "rgba(205,127,50,0.55)", particle: "#f2c98a",
    },
    rewards: [
      { label: "Bronze Passport", kind: "passport" },
      { label: "Bronze Trophy", kind: "trophy" },
      { label: "Bronze Medal", kind: "medal" },
      { label: "Junior Badge", kind: "badge" },
      { label: "Better Certificate", kind: "certificate" },
      { label: "Bronze Profile Frame", kind: "frame" },
      { label: "Bronze Nameplate", kind: "nameplate" },
    ],
    animation: ["Passport Flip", "Trophy Rise", "Light Burst", "Card Shine"],
    sound: ["Build Complete", "UI Sweep", "Digital Unlock"],
  },
  {
    n: 3, code: "STAGE 03",
    title: "Software Engineer", theme: "Professional Practitioner",
    tagline: "You own systems. You review PRs. You mentor apprentices.",
    material: "Silver", trophyShape: "obelisk", medalShape: "shield",
    passportMotif: "Silver Weave", badgeStyle: "Polished Silver",
    nameplate: "Silver Chrome", ribbon: ["#d9d9d9", "#5a6472"],
    unlock: "silver",
    bg: {
      gradient: "radial-gradient(1200px 500px at 50% 0%, rgba(200,210,225,0.22), transparent 60%), linear-gradient(160deg, #10151d 0%, #070a0f 100%)",
      accent: "#c8d2e1", glow: "rgba(200,210,225,0.55)", particle: "#eaf2ff",
    },
    rewards: [
      { label: "Silver Passport", kind: "passport" },
      { label: "Engineering Trophy", kind: "trophy" },
      { label: "Engineering Medal", kind: "medal" },
      { label: "Software Badge", kind: "badge" },
      { label: "Silver Certificate", kind: "certificate" },
      { label: "Silver Frame", kind: "frame" },
      { label: "Silver Identity Card", kind: "identity" },
    ],
    animation: ["Crystal Reflection", "Hologram Reveal", "Rotating Trophy", "Particle Burst"],
    sound: ["Metal Impact", "Crystal Ring", "Premium Notification"],
  },
  {
    n: 4, code: "STAGE 04",
    title: "Senior Engineer", theme: "Golden Standard",
    tagline: "The engineer other engineers ask for help. Golden hour.",
    material: "Gold", trophyShape: "diamond", medalShape: "star",
    passportMotif: "Gold Leaf", badgeStyle: "Gold Plated",
    nameplate: "Engraved Gold Bar", ribbon: ["#f5c542", "#7a5008"],
    unlock: "gold",
    bg: {
      gradient: "radial-gradient(1200px 500px at 30% 0%, rgba(245,197,66,0.28), transparent 60%), linear-gradient(160deg, #1a1508 0%, #0a0803 100%)",
      accent: "#f5c542", glow: "rgba(245,197,66,0.6)", particle: "#ffe28a",
    },
    rewards: [
      { label: "Gold Passport", kind: "passport" },
      { label: "Golden Trophy", kind: "trophy" },
      { label: "Gold Medal", kind: "medal" },
      { label: "Senior Engineer Badge", kind: "badge" },
      { label: "Premium Certificate", kind: "certificate" },
      { label: "Gold Frame", kind: "frame" },
      { label: "Golden Identity Card", kind: "identity" },
    ],
    animation: ["Golden Rays", "Luxury Shine", "Spotlight", "Energy Ring"],
    sound: ["Golden Bell", "Achievement Fanfare", "Energy Pulse"],
  },
  {
    n: 5, code: "STAGE 05",
    title: "Lead Developer", theme: "Platinum Command",
    tagline: "You set the tempo. Teams follow your architecture.",
    material: "Platinum", trophyShape: "orb", medalShape: "octagon",
    passportMotif: "Platinum Circuit", badgeStyle: "Platinum Enamel",
    nameplate: "Polished Platinum", ribbon: ["#e5e4e2", "#7d8794"],
    unlock: "elite",
    bg: {
      gradient: "radial-gradient(1200px 500px at 60% 0%, rgba(229,228,226,0.22), transparent 60%), linear-gradient(160deg, #14171c 0%, #08090c 100%)",
      accent: "#e5e4e2", glow: "rgba(229,228,226,0.5)", particle: "#f7f8fb",
    },
    rewards: [
      { label: "New Trophy Collection", kind: "collection" },
      { label: "New Medal Collection", kind: "medal" },
      { label: "New Passport Cover", kind: "passport" },
      { label: "New Badge Collection", kind: "badge" },
      { label: "Premium Profile Theme", kind: "frame" },
      { label: "Animated Border", kind: "frame" },
      { label: "Dynamic Background", kind: "frame" },
    ],
    animation: ["Cinematic Zoom", "Aurora Sweep", "Confetti Storm", "Ambient Lighting"],
    sound: ["Orchestral Hit", "Digital Chime", "Premium Alert"],
  },
  {
    n: 6, code: "STAGE 06",
    title: "Solution Architect", theme: "Crystal & Glass",
    tagline: "You design what a hundred engineers will build.",
    material: "Crystal Glass", trophyShape: "prism", medalShape: "diamond",
    passportMotif: "Etched Crystal", badgeStyle: "Beveled Glass",
    nameplate: "Frosted Crystal Slab", ribbon: ["#8de9ff", "#0b6ea6"],
    unlock: "diamond",
    bg: {
      gradient: "radial-gradient(1200px 500px at 40% 0%, rgba(141,233,255,0.28), transparent 60%), linear-gradient(160deg, #071824 0%, #030a11 100%)",
      accent: "#8de9ff", glow: "rgba(141,233,255,0.55)", particle: "#c7f3ff",
    },
    rewards: [
      { label: "Glass Trophy", kind: "trophy" },
      { label: "Crystal Medal", kind: "medal" },
      { label: "Architect Passport", kind: "passport" },
      { label: "Architecture Badge", kind: "badge" },
      { label: "Executive Certificate", kind: "certificate" },
      { label: "Premium Identity Card", kind: "identity" },
    ],
    animation: ["Prism Refraction", "Slow Rotation", "Holographic Sheen", "Depth Parallax"],
    sound: ["Crystal Ring", "Glass Chime", "Ambient Pad"],
  },
  {
    n: 7, code: "STAGE 07",
    title: "Principal Engineer", theme: "Titanium & Diamond",
    tagline: "Rare air. Company-wide influence. Named on the patents.",
    material: "Titanium", trophyShape: "wing", medalShape: "gear",
    passportMotif: "Titanium Machined", badgeStyle: "Diamond Cut",
    nameplate: "Laser-Etched Titanium", ribbon: ["#b5c0d0", "#3a4a5e"],
    unlock: "legend",
    bg: {
      gradient: "radial-gradient(1200px 500px at 70% 0%, rgba(181,192,208,0.22), transparent 60%), linear-gradient(160deg, #0e1319 0%, #05080b 100%)",
      accent: "#b5c0d0", glow: "rgba(120,255,240,0.4)", particle: "#7de1d3",
    },
    rewards: [
      { label: "Titanium Trophy", kind: "trophy" },
      { label: "Diamond Medal", kind: "medal" },
      { label: "Elite Passport", kind: "passport" },
      { label: "Elite Badge", kind: "badge" },
      { label: "Legend Profile Frame", kind: "frame" },
      { label: "Luxury Nameplate", kind: "nameplate" },
    ],
    animation: ["Electric Arc", "Diamond Sparkle", "Titanium Shine", "Slow Cinematic Pan"],
    sound: ["Electric Spark", "Diamond Ring", "Cinematic Rise"],
  },
  {
    n: 8, code: "STAGE 08",
    title: "Engineering Master", theme: "Obsidian & Amethyst",
    tagline: "You've built the systems that built the company.",
    material: "Obsidian & Amethyst", trophyShape: "tower", medalShape: "sun",
    passportMotif: "Obsidian Sigil", badgeStyle: "Amethyst Inlay",
    nameplate: "Obsidian Slab", ribbon: ["#c084fc", "#3b0f5c"],
    unlock: "master",
    bg: {
      gradient: "radial-gradient(1200px 500px at 40% 0%, rgba(192,132,252,0.32), transparent 60%), linear-gradient(160deg, #0f0819 0%, #050310 100%)",
      accent: "#c084fc", glow: "rgba(192,132,252,0.6)", particle: "#e4c9ff",
    },
    rewards: [
      { label: "Master Trophy Collection", kind: "collection" },
      { label: "Master Passport", kind: "passport" },
      { label: "Master Badge", kind: "badge" },
      { label: "Master Medal", kind: "medal" },
      { label: "Executive Identity", kind: "identity" },
      { label: "Luxury Showcase", kind: "collection" },
    ],
    animation: ["Amethyst Bloom", "Sigil Reveal", "Museum Spotlight", "Volumetric Fog"],
    sound: ["Deep Bell", "Orchestral Swell", "Ceremonial Gong"],
  },
  {
    n: 9, code: "STAGE 09",
    title: "Technology Legend", theme: "Solar Gold",
    tagline: "Written about. Quoted in keynotes. Standard-bearer.",
    material: "24k Legend Gold", trophyShape: "star", medalShape: "laurel",
    passportMotif: "Solar Emboss", badgeStyle: "Legend Seal",
    nameplate: "24k Legend Plaque", ribbon: ["#facc15", "#7a3e00"],
    unlock: "legend",
    bg: {
      gradient: "radial-gradient(1400px 600px at 50% 0%, rgba(250,204,21,0.35), transparent 60%), linear-gradient(160deg, #1a1305 0%, #0a0702 100%)",
      accent: "#facc15", glow: "rgba(250,204,21,0.7)", particle: "#fff2a8",
    },
    rewards: [
      { label: "Legend Trophy", kind: "trophy" },
      { label: "Legend Medal", kind: "medal" },
      { label: "Legend Passport", kind: "passport" },
      { label: "Legend Badge", kind: "badge" },
      { label: "Legend Certificate", kind: "certificate" },
      { label: "Legend Frame", kind: "frame" },
    ],
    animation: ["Sunburst Halo", "Legend Rays", "Cinematic Reveal", "Sparkle Rain"],
    sound: ["Victory Orchestra", "Golden Bell", "Legend Fanfare"],
  },
  {
    n: 10, code: "STAGE 10",
    title: "Chief Architect", theme: "Founder Level Experience",
    tagline: "The Museum. The Crown. The final chapter you never close.",
    material: "Meteorite · Diamond · Founder Gold", trophyShape: "crown", medalShape: "phoenix",
    passportMotif: "Founder Sigil, Meteorite Cover", badgeStyle: "Founder Crown Seal",
    nameplate: "Meteorite & Diamond Plaque", ribbon: ["#fff2b0", "#8a5a00"],
    unlock: "founder",
    bg: {
      gradient: "radial-gradient(1600px 700px at 50% 0%, rgba(255,242,176,0.35), transparent 65%), radial-gradient(900px 500px at 50% 100%, rgba(200,120,255,0.25), transparent 60%), linear-gradient(160deg, #1a1204 0%, #05030a 100%)",
      accent: "#fff2b0", glow: "rgba(255,242,176,0.75)", particle: "#ffe98a",
    },
    rewards: [
      { label: "Founder Trophy", kind: "trophy" },
      { label: "Founder Crown", kind: "crown" },
      { label: "Founder Medal", kind: "medal" },
      { label: "Founder Passport", kind: "passport" },
      { label: "Founder Badge", kind: "badge" },
      { label: "Founder Certificate", kind: "certificate" },
      { label: "Founder Identity Card", kind: "identity" },
      { label: "Founder Frame", kind: "frame" },
      { label: "Founder Collection Room", kind: "collection" },
      { label: "Founder Museum", kind: "museum" },
    ],
    animation: ["Museum Cinematic", "Crown Descent", "Aurora Fanfare", "Phoenix Rise", "Volumetric Confetti"],
    sound: ["Founder Fanfare", "Choir Swell", "Ceremonial Gong", "Aurora Pad"],
  },
];
