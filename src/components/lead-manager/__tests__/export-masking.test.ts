import { describe, expect, it } from "vitest";
import { leadsToCsv, maskEmail, maskPhone } from "@/components/lead-manager/shared";
import type { Lead } from "@/lib/lead-manager/types";

/**
 * What an export is allowed to contain.
 *
 * The Security screen offers each agent an Unmask switch, and the lead table
 * honoured it - but the Export button beside that table handed over the same
 * addresses and phone numbers in plain text, so the switch protected nothing.
 * Anyone who wanted the unmasked list only had to download it.
 */

const lead = {
  name: "Asha Verma",
  email: "asha.verma@example.com",
  phone: "+91 98765 43210",
  company: "Verma Textiles",
} as unknown as Lead;

const row = (csv: string) => csv.split("\n")[1] ?? "";

describe("leadsToCsv — masking", () => {
  it("masks by default, so a caller that forgets the flag leaks nothing", () => {
    const body = row(leadsToCsv([lead]));
    expect(body).not.toContain("asha.verma@example.com");
    expect(body).not.toContain("98765 43210");
  });

  it("masks exactly the way the table does, so the two never disagree", () => {
    const body = row(leadsToCsv([lead], false));
    expect(body).toContain(maskEmail(lead.email, false));
    expect(body).toContain(maskPhone(lead.phone, false));
  });

  it("gives the full details to an agent who is allowed to see them", () => {
    const body = row(leadsToCsv([lead], true));
    expect(body).toContain("asha.verma@example.com");
    expect(body).toContain("+91 98765 43210");
  });

  it("leaves every other column alone whether masked or not", () => {
    for (const unmasked of [true, false]) {
      const body = row(leadsToCsv([lead], unmasked));
      expect(body, String(unmasked)).toContain("Asha Verma");
      expect(body, String(unmasked)).toContain("Verma Textiles");
    }
  });

  it("still writes a header row and one line per lead", () => {
    const csv = leadsToCsv([lead, lead], true);
    expect(csv.split("\n")).toHaveLength(3);
    expect(csv.split("\n")[0]).toContain("email");
  });
});

describe("maskPhone — the formats leads are actually stored in", () => {
  /**
   * Every one of these came through the old regex untouched, because it
   * required six digits in an unbroken run and a formatted number never has
   * them. The mask was, in practice, only ever applied to the few numbers
   * typed without a single space.
   */
  const formatted = [
    "+91 98765 43210",
    "+91-98765-43210",
    "098765 43210",
    "(022) 2345 6789",
    "+1 (555) 010-9999",
    "9876543210",
  ];

  it("hides the dialable middle of every format", () => {
    for (const phone of formatted) {
      const masked = maskPhone(phone, false);
      expect(masked, phone).toContain("•");
      expect(masked, phone).not.toEqual(phone);
    }
  });

  it("keeps the last three digits, so an agent can still tell numbers apart", () => {
    expect(maskPhone("+91 98765 43210", false)).toContain("210");
    expect(maskPhone("9876543210", false)).toContain("210");
  });

  it("keeps a country code only when one was written", () => {
    expect(maskPhone("+91 98765 43210", false).startsWith("+91")).toBe(true);
    expect(maskPhone("9876543210", false).startsWith("98")).toBe(false);
  });

  it("leaves punctuation where it was, so the shape is still readable", () => {
    const masked = maskPhone("+1 (555) 010-9999", false);
    expect(masked.startsWith("+1 (")).toBe(true);
    expect(masked).toContain(") ");
    expect(masked).toContain("-");
  });

  it("hands the number back whole when unmasking is allowed", () => {
    for (const phone of formatted) {
      expect(maskPhone(phone, true), phone).toBe(phone);
    }
  });

  it("never leaves a short number exposed either", () => {
    expect(maskPhone("1234", false)).toBe("••••");
  });
});
