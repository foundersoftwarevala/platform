import { createMiddleware } from "@tanstack/react-start";

export const ACCESS_STORAGE = "ayra-access-token";
export const ACCESS_HEADER = "x-ayra-access";

export function getAccessToken() {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(ACCESS_STORAGE);
}
export function setAccessToken(t: string | null) {
  if (t) sessionStorage.setItem(ACCESS_STORAGE, t);
  else sessionStorage.removeItem(ACCESS_STORAGE);
}

/** Sends the signed role token with every server call; the server verifies it. */
export const attachAccessToken = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const t = getAccessToken();
  return next({ headers: t ? { [ACCESS_HEADER]: t } : {} });
});

export function accessHeaders(): Record<string, string> {
  const t = getAccessToken();
  return t ? { [ACCESS_HEADER]: t } : {};
}
