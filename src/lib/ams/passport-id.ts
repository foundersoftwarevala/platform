// Deterministic digital passport identity + verification codes (UI only).
// No backend calls: every code is derived from the role slug so the same
// passport always resolves to the same verification record.

import { ROLES, type RoleDNA, type RoleSlug } from "./roles";

const ISSUE_YEAR = 2026;

export function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function base32(n: number, len: number): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  let v = n;
  for (let i = 0; i < len; i += 1) {
    out = alphabet[v % alphabet.length] + out;
    v = Math.floor(v / alphabet.length) + 7;
  }
  return out;
}

export interface PassportIdentity {
  slug: RoleSlug;
  /** Human readable passport number printed on the cover. */
  number: string;
  /** Short verification code used in the QR payload / URL. */
  code: string;
  serial: string;
  issued: string;
  expires: string;
  authority: string;
  verification: string;
  checksum: string;
}

export function passportIdentity(role: RoleDNA): PassportIdentity {
  const h = hash(`ams:passport:${role.slug}`);
  const serial = String(100000 + (h % 899999));
  const checksum = base32(h >> 3, 4);
  const code = `${role.passportPrefix}-${ISSUE_YEAR}-${checksum}`;
  return {
    slug: role.slug,
    number: `${role.passportPrefix} ${serial.slice(0, 3)} ${serial.slice(3)}`,
    code,
    serial,
    issued: `${ISSUE_YEAR}-0${1 + (h % 9)}-1${h % 9}`,
    expires: `${ISSUE_YEAR + 5}-0${1 + (h % 9)}-1${h % 9}`,
    authority: "AMS Global Registry · Sovereign Recognition Council",
    verification: role.passport.verification,
    checksum,
  };
}

export function passportVerifyPath(role: RoleDNA): string {
  return `/verify/${passportIdentity(role).code}`;
}

export function passportVerifyUrl(role: RoleDNA): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}${passportVerifyPath(role)}`;
}

export function findPassportByCode(code: string): { role: RoleDNA; identity: PassportIdentity } | null {
  const needle = code.trim().toUpperCase();
  for (const role of ROLES) {
    const identity = passportIdentity(role);
    if (identity.code.toUpperCase() === needle || identity.checksum === needle) {
      return { role, identity };
    }
  }
  return null;
}
