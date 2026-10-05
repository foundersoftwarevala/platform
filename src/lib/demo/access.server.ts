import type { DemoAccessDetails } from "./access";

export function getDemoAccessDetails(): DemoAccessDetails | undefined {
  const value = process.env.DEMO_ACCESS_DETAILS;
  if (!value) return undefined;
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object") throw new Error("Invalid demo access configuration");
  if (
    !("username" in parsed) ||
    typeof parsed.username !== "string" ||
    !parsed.username.trim() ||
    !("password" in parsed) ||
    typeof parsed.password !== "string" ||
    !parsed.password.trim() ||
    !("licenseKey" in parsed) ||
    typeof parsed.licenseKey !== "string" ||
    !parsed.licenseKey.trim() ||
    !("backupKey" in parsed) ||
    typeof parsed.backupKey !== "string" ||
    !parsed.backupKey.trim()
  ) {
    throw new Error("Invalid demo access configuration");
  }
  return {
    username: parsed.username,
    password: parsed.password,
    licenseKey: parsed.licenseKey,
    backupKey: parsed.backupKey,
  };
}
