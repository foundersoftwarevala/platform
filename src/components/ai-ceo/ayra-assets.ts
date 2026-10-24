import ayraAmberFront from "@/assets/ayra-banner/ayra-amber-front.jpg";
import ayraAmberProfile from "@/assets/ayra-banner/ayra-amber-profile.jpg";
import ayraAmberSide from "@/assets/ayra-banner/ayra-amber-side.jpg";
import ayraBob from "@/assets/ayra-banner/ayra-bob.jpg";
import ayraBraids from "@/assets/ayra-banner/ayra-braids.jpg";
import ayraCrystal from "@/assets/ayra-banner/ayra-crystal.jpg";
import ayraCyan from "@/assets/ayra-banner/ayra-cyan.jpg";
import ayraCyanJacket from "@/assets/ayra-banner/ayra-cyan-jacket.jpg";
import ayraCyanSide from "@/assets/ayra-banner/ayra-cyan-side.jpg";
import ayraGold from "@/assets/ayra-banner/ayra-gold.jpg";
import ayraHeadset from "@/assets/ayra-banner/ayra-headset.jpg";
import ayraVeil from "@/assets/ayra-banner/ayra-veil.jpg";
import ayraCelebrate from "@/assets/ayra-banner/ayra-celebrate.mp4";
import ayraIdleLoop from "@/assets/ayra-banner/ayra-idle-loop.mp4";
import ayraNamaste from "@/assets/ayra-banner/ayra-namaste.mp4";
import ayraWave from "@/assets/ayra-banner/ayra-wave.mp4";
import sceneAmberFront from "@/assets/ayra-world/scene-amber-front.jpg";
import sceneAmberProfile from "@/assets/ayra-world/scene-amber-profile.jpg";
import sceneAmberSide from "@/assets/ayra-world/scene-amber-side.jpg";
import sceneBob from "@/assets/ayra-world/scene-bob.jpg";
import sceneCrystal from "@/assets/ayra-world/scene-crystal.jpg";
import sceneCyan from "@/assets/ayra-world/scene-cyan.jpg";
import sceneCyanJacket from "@/assets/ayra-world/scene-cyan-jacket.jpg";
import sceneCyanSide from "@/assets/ayra-world/scene-cyan-side.jpg";
import sceneGold from "@/assets/ayra-world/scene-gold.jpg";
import sceneHeadset from "@/assets/ayra-world/scene-headset.jpg";
import sceneVeil from "@/assets/ayra-world/scene-veil.jpg";
import sceneAmberFrontMotion from "@/assets/ayra-world/scene-amber-front.mp4";
import sceneAmberProfileMotion from "@/assets/ayra-world/scene-amber-profile.mp4";
import sceneAmberSideMotion from "@/assets/ayra-world/scene-amber-side.mp4";
import sceneBobMotion from "@/assets/ayra-world/scene-bob.mp4";
import sceneCrystalMotion from "@/assets/ayra-world/scene-crystal.mp4";
import sceneCyanMotion from "@/assets/ayra-world/scene-cyan.mp4";
import sceneCyanJacketMotion from "@/assets/ayra-world/scene-cyan-jacket.mp4";
import sceneCyanSideMotion from "@/assets/ayra-world/scene-cyan-side.mp4";
import sceneGoldMotion from "@/assets/ayra-world/scene-gold.mp4";
import sceneVeilMotion from "@/assets/ayra-world/scene-veil.mp4";
import ayraWorldStage from "@/assets/ayra-world/ayra-world-stage.jpg";

export const AYRA_LOOKS = [
  {
    id: "default",
    name: "Cyan Classic",
    portrait: ayraCyan,
    scene: sceneCyan,
    motion: sceneCyanMotion,
  },
  {
    id: "cyanSide",
    name: "Cyan Profile",
    portrait: ayraCyanSide,
    scene: sceneCyanSide,
    motion: sceneCyanSideMotion,
  },
  {
    id: "cyanJacket",
    name: "Cyan Jacket",
    portrait: ayraCyanJacket,
    scene: sceneCyanJacket,
    motion: sceneCyanJacketMotion,
  },
  {
    id: "amberSide",
    name: "Amber Side",
    portrait: ayraAmberSide,
    scene: sceneAmberSide,
    motion: sceneAmberSideMotion,
  },
  {
    id: "amberFront",
    name: "Amber Armor",
    portrait: ayraAmberFront,
    scene: sceneAmberFront,
    motion: sceneAmberFrontMotion,
  },
  {
    id: "amberProfile",
    name: "Amber Glow",
    portrait: ayraAmberProfile,
    scene: sceneAmberProfile,
    motion: sceneAmberProfileMotion,
  },
  { id: "headset", name: "Headset", portrait: ayraHeadset, scene: sceneHeadset, motion: undefined },
  {
    id: "gold",
    name: "Gold Headpiece",
    portrait: ayraGold,
    scene: sceneGold,
    motion: sceneGoldMotion,
  },
  { id: "bob", name: "Orange Bob", portrait: ayraBob, scene: sceneBob, motion: sceneBobMotion },
  {
    id: "crystal",
    name: "Purple Crystal",
    portrait: ayraCrystal,
    scene: sceneCrystal,
    motion: sceneCrystalMotion,
  },
  {
    id: "veil",
    name: "Bridal Veil",
    portrait: ayraVeil,
    scene: sceneVeil,
    motion: sceneVeilMotion,
  },
  { id: "braids", name: "Braids", portrait: ayraBraids, scene: ayraBraids, motion: undefined },
] as const;

export type AyraLookId = (typeof AYRA_LOOKS)[number]["id"];

export const AYRA_GESTURES = {
  greet: { label: "Namaste", video: ayraNamaste },
  wave: { label: "Wave", video: ayraWave },
  celebrate: { label: "Celebrate", video: ayraCelebrate },
  idle: { label: "Idle", video: ayraIdleLoop },
} as const;

export type AyraGestureId = keyof typeof AYRA_GESTURES;

export { ayraWorldStage };
