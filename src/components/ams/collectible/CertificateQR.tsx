import { CredentialQR } from "./CredentialQR";
import { certificateIdentity, certificateVerifyPath, certificateVerifyUrl } from "@/lib/ams/certificate-id";
import type { RoleDNA } from "@/lib/ams/roles";

/** Scannable QR verification block for a role certificate. */
export function CertificateQR({ role, size = 132 }: { role: RoleDNA; size?: number }) {
  const identity = certificateIdentity(role);
  return (
    <CredentialQR
      accent={role.accent}
      code={identity.code}
      numberLabel="Certificate No."
      number={identity.number}
      path={certificateVerifyPath(role)}
      url={certificateVerifyUrl(role)}
      filename={`${role.slug}-certificate-qr.png`}
      size={size}
    />
  );
}
