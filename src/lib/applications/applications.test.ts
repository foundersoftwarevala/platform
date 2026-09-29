import { beforeAll, describe, expect, it } from "vitest";

import { checkDocument, documentFields, MAX_DOCUMENT_BYTES, sniffDocumentType } from "./documents";
import { checkApplication } from "./validate";

/**
 * The rules an application is held to, tested without a server: what the form
 * may contain and what a document may be.
 */

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => new Uint8Array([...text].map((c) => c.charCodeAt(0)));

describe("checkApplication", () => {
  const affiliate = {
    fullName: "Asha Rao",
    email: "asha@example.com",
    phone: "+91 90000 12345",
    country: "India",
    idType: "PAN",
    audienceSize: "12000",
    monthlyTraffic: "40k",
    trafficDetails: "India, 18-34",
    promotionMethod: "Reviews",
  };

  it("keeps every field the form has, and only those", () => {
    const checked = checkApplication("affiliate", { ...affiliate, website: "https://asha.example.com", injected: "x" });
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    expect(checked.values.website).toBe("https://asha.example.com");
    expect(checked.values.idType).toBe("PAN");
    expect(checked.values.promotionMethod).toBe("Reviews");
    expect("injected" in checked.values).toBe(false);
  });

  it("names every missing required field", () => {
    const checked = checkApplication("affiliate", { fullName: "Asha Rao" });
    expect(checked.ok).toBe(false);
    if (checked.ok) return;
    expect(checked.error).toMatch(/^Missing required fields: /);
    expect(checked.fields).toEqual(expect.arrayContaining(["email", "phone", "country", "idType", "audienceSize"]));
  });

  it("refuses values of the wrong kind", () => {
    const checked = checkApplication("affiliate", { ...affiliate, email: "not-an-email", website: "javascript:alert(1)" });
    expect(checked.ok).toBe(false);
    if (checked.ok) return;
    expect(checked.fields).toEqual(expect.arrayContaining(["email", "website"]));
  });

  it("refuses a choice that is not one of the options", () => {
    const checked = checkApplication("affiliate", { ...affiliate, idType: "Library card" });
    expect(checked.ok).toBe(false);
  });

  it("never keeps a document field as text", () => {
    const checked = checkApplication("affiliate", { ...affiliate, idDocument: "passport.pdf" });
    expect(checked.ok).toBe(true);
    if (checked.ok) expect("idDocument" in checked.values).toBe(false);
  });

  it("refuses a role that does not exist", () => {
    expect(checkApplication("astronaut", {}).ok).toBe(false);
  });
});

describe("documents", () => {
  it("knows a file by its content, not its name", () => {
    expect(sniffDocumentType(ascii("%PDF-1.7 ..."))).toBe("application/pdf");
    expect(sniffDocumentType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffDocumentType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a))).toBe("image/png");
    expect(sniffDocumentType(ascii("RIFF\u0000\u0000\u0000\u0000WEBPVP8 "))).toBe("image/webp");
  });

  it("refuses anything else, whatever it claims to be", () => {
    expect(sniffDocumentType(ascii("<html><script>"))).toBeNull();
    expect(sniffDocumentType(ascii("MZ\u0090\u0000"))).toBeNull(); // a Windows executable
    expect(sniffDocumentType(ascii("PK\u0003\u0004"))).toBeNull(); // a zip
    expect(sniffDocumentType(new Uint8Array())).toBeNull();
  });

  it("holds files to five megabytes and four formats", () => {
    expect(checkDocument({ size: 0, type: "application/pdf" })).not.toBeNull();
    expect(checkDocument({ size: MAX_DOCUMENT_BYTES + 1, type: "application/pdf" })).not.toBeNull();
    expect(checkDocument({ size: 1000, type: "application/x-msdownload" })).not.toBeNull();
    expect(checkDocument({ size: 1000, type: "image/png" })).toBeNull();
  });

  it("lists the document fields each form really has", () => {
    expect(documentFields("vendor").map((f) => f.name)).toEqual(
      expect.arrayContaining(["idDocument", "registrationDoc", "gstDoc"]),
    );
    expect(documentFields("employee").map((f) => f.name)).toContain("resume");
    expect(documentFields("nobody")).toEqual([]);
  });
});

describe("what is not collected", () => {
  it("keeps no bank details or identity number, whatever is sent", () => {
    const checked = checkApplication("reseller", {
      fullName: "Asha Rao", email: "asha@example.com", phone: "+91 90000 12345", country: "India",
      companyName: "Rao Traders", businessType: "Retailer", salesExperience: "4", targetMarket: "SMB",
      expectedMonthlySales: "10", marketingChannels: "Field sales", idType: "PAN",
      accountHolder: "Asha Rao", accountNumber: "123456789012", ifsc: "HDFC0001234", bankName: "HDFC", upi: "a@ok", idNumber: "ABCDE1234F",
    });
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    for (const key of ["accountHolder", "accountNumber", "ifsc", "bankName", "upi", "idNumber"]) {
      expect(key in checked.values).toBe(false);
    }
  });
});
