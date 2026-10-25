export function maskLeadEmail(email: string): string {
  const separator = email.lastIndexOf("@");
  if (separator < 1) return "***";
  const local = email.slice(0, separator);
  return `${local.slice(0, 1)}${"*".repeat(Math.max(3, local.length - 1))}${email.slice(separator)}`;
}

export function maskLeadPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length > 5) {
    return `${digits.slice(0, 2)}${"*".repeat(digits.length - 5)}${digits.slice(-3)}`;
  }
  return "*".repeat(Math.max(digits.length, 1));
}
