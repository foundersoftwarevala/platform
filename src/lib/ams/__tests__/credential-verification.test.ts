import { describe, expect, it } from "vitest";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { ROLES } from "@/lib/ams/roles";
import {
  findPassportByCode,
  passportIdentity,
  passportVerifyPath,
} from "@/lib/ams/passport-id";
import {
  certificateIdentity,
  certificateVerifyPath,
  findCertificateByCode,
} from "@/lib/ams/certificate-id";

const ORIGIN = "https://ams.example.com";

/**
 * Renders a QR for `payload` exactly the way the credential QR components do,
 * then decodes the resulting bitmap so the assertion covers the real encoded
 * data rather than the input string.
 */
function decodeQr(payload: string): string | null {
  const qr = QRCode.create(payload, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const scale = 4;
  const quiet = 4 * scale;
  const dim = size * scale + quiet * 2;
  const data = new Uint8ClampedArray(dim * dim * 4).fill(255);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!qr.modules.get(x, y)) continue;
      for (let dy = 0; dy < scale; dy += 1) {
        for (let dx = 0; dx < scale; dx += 1) {
          const px = quiet + x * scale + dx;
          const py = quiet + y * scale + dy;
          const i = (py * dim + px) * 4;
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
          data[i + 3] = 255;
        }
      }
    }
  }
  return jsQR(data, dim, dim)?.data ?? null;
}

describe("digital passport credential", () => {
  it("generates a deterministic identity for every role", () => {
    for (const role of ROLES) {
      const a = passportIdentity(role);
      const b = passportIdentity(role);
      expect(a).toEqual(b);
      expect(a.code.startsWith(`${role.passportPrefix}-`)).toBe(true);
      expect(a.number).toContain(role.passportPrefix);
      expect(a.serial).toMatch(/^\d{6}$/);
    }
  });

  it("issues unique verification codes across roles", () => {
    const codes = ROLES.map((r) => passportIdentity(r).code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("encodes the correct /verify URL inside the QR", () => {
    for (const role of ROLES) {
      const identity = passportIdentity(role);
      const path = passportVerifyPath(role);
      expect(path).toBe(`/verify/${identity.code}`);

      const decoded = decodeQr(`${ORIGIN}${path}`);
      expect(decoded).toBe(`${ORIGIN}/verify/${identity.code}`);
      expect(decoded?.split("/verify/")[1]).toBe(identity.code);
    }
  });

  it("resolves the scanned code back to the same passport identity", () => {
    for (const role of ROLES) {
      const identity = passportIdentity(role);
      const scanned = decodeQr(`${ORIGIN}${passportVerifyPath(role)}`)!;
      const code = scanned.split("/verify/")[1]!;

      const match = findPassportByCode(code);
      expect(match).not.toBeNull();
      expect(match!.role.slug).toBe(role.slug);
      expect(match!.identity).toEqual(identity);

      // case-insensitive and by printed passport number too
      expect(findPassportByCode(code.toLowerCase())!.role.slug).toBe(role.slug);
    }
  });

  it("rejects unknown or tampered codes", () => {
    expect(findPassportByCode("SV-DEV-2026-XXXX")).toBeNull();
    expect(findPassportByCode("")).toBeNull();
    expect(findPassportByCode("not-a-code")).toBeNull();
  });
});

describe("certificate credential", () => {
  it("generates a deterministic identity for every role", () => {
    for (const role of ROLES) {
      const a = certificateIdentity(role);
      expect(certificateIdentity(role)).toEqual(a);
      expect(a.number.startsWith("CT-")).toBe(true);
      expect(a.code.startsWith("CT-")).toBe(true);
      expect(a.code).toContain("2026");
    }
  });

  it("issues unique certificate codes and numbers across roles", () => {
    const codes = ROLES.map((r) => certificateIdentity(r).code);
    const numbers = ROLES.map((r) => certificateIdentity(r).number);
    expect(new Set(codes).size).toBe(codes.length);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it("encodes the correct /verify URL inside the QR and resolves it", () => {
    for (const role of ROLES) {
      const identity = certificateIdentity(role);
      expect(certificateVerifyPath(role)).toBe(`/verify/${identity.code}`);

      const decoded = decodeQr(`${ORIGIN}${certificateVerifyPath(role)}`)!;
      const code = decoded.split("/verify/")[1]!;
      expect(code).toBe(identity.code);

      const match = findCertificateByCode(code);
      expect(match).not.toBeNull();
      expect(match!.role.slug).toBe(role.slug);
      expect(match!.identity.number).toBe(identity.number);
    }
  });

  it("also resolves by the printed certificate number", () => {
    for (const role of ROLES) {
      const identity = certificateIdentity(role);
      expect(findCertificateByCode(identity.number)!.role.slug).toBe(role.slug);
    }
  });
});

describe("verify page resolution (route logic)", () => {
  // Mirrors src/routes/verify.$code.tsx: passport first, then certificate.
  function resolve(code: string) {
    const passport = findPassportByCode(code);
    if (passport) return { kind: "passport" as const, ...passport };
    const cert = findCertificateByCode(code);
    if (cert) return { kind: "certificate" as const, ...cert };
    return null;
  }

  it("routes passport codes to the passport view and certificate codes to the certificate view", () => {
    for (const role of ROLES) {
      const passportCode = passportIdentity(role).code;
      const certCode = certificateIdentity(role).code;

      const p = resolve(passportCode)!;
      expect(p.kind).toBe("passport");
      expect(p.role.slug).toBe(role.slug);

      const c = resolve(certCode)!;
      expect(c.kind).toBe("certificate");
      expect(c.role.slug).toBe(role.slug);
    }
  });

  it("never cross-resolves a certificate code as a passport", () => {
    for (const role of ROLES) {
      expect(findPassportByCode(certificateIdentity(role).code)).toBeNull();
      expect(findCertificateByCode(passportIdentity(role).code)).toBeNull();
    }
  });

  it("shows verification failure for unregistered codes", () => {
    expect(resolve("CT-DEV-2026-0000")).toBeNull();
    expect(resolve("random")).toBeNull();
  });
});
