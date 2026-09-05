// Deterministic certificate identity + verification codes (UI only).
// Same role always resolves to the same certificate record, so the QR on a
// certificate card and the /verify/<code> page never drift apart.

import { ROLES, type RoleDNA, type RoleSlug } from "./roles";
import { base32, hash } from "./passport-id";

const ISSUE_YEAR = 2026;

export interface CertificateIdentity {
  slug: RoleSlug;
  /** Human readable certificate number printed on the artwork. */
  number: string;
  /** Short verification code used in the QR payload / URL. */
  code: string;
  serial: string;
  issued: string;
  registry: string;
  authority: string;
  /** Highest certificate title for the role. */
  title: string;
  seal: string;
  checksum: string;
}

function suffix(role: RoleDNA): string {
  const parts = role.passportPrefix.split("-");
  return parts[parts.length - 1] ?? role.slug.slice(0, 3).toUpperCase();
}

export function certificateIdentity(role: RoleDNA): CertificateIdentity {
  const h = hash(`ams:certificate:${role.slug}`);
  const serial = String(200000 + (h % 799999));
  const checksum = base32(h >> 5, 4);
  const sfx = suffix(role);
  const titles = role.certificates ?? [];
  return {
    slug: role.slug,
    number: `CT-${sfx}-${serial}`,
    code: `CT-${sfx}-${ISSUE_YEAR}-${checksum}`,
    serial,
    issued: `${ISSUE_YEAR}-0${1 + (h % 9)}-2${h % 8}`,
    registry: `AMS/CERT/${sfx}/${serial.slice(0, 3)}`,
    authority: "AMS Global Registry · Board of Recognition",
    title: titles[titles.length - 1]?.label ?? `${role.name} Certificate`,
    seal: role.passport?.stamp ?? `${role.name} Seal`,
    checksum,
  };
}

export function certificateVerifyPath(role: RoleDNA): string {
  return `/verify/${certificateIdentity(role).code}`;
}

export function certificateVerifyUrl(role: RoleDNA): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}${certificateVerifyPath(role)}`;
}

export function findCertificateByCode(
  code: string,
): { role: RoleDNA; identity: CertificateIdentity } | null {
  const needle = code.trim().toUpperCase();
  for (const role of ROLES) {
    const identity = certificateIdentity(role);
    if (identity.code.toUpperCase() === needle || identity.number.toUpperCase() === needle) {
      return { role, identity };
    }
  }
  return null;
}
