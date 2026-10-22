import { startAssistSignalingServer } from "../src/lib/assist-manager/signaling.server";

startAssistSignalingServer().catch((error: unknown) => {
  console.error("[assist-signaling] service failed to start", error);
  process.exitCode = 1;
});
