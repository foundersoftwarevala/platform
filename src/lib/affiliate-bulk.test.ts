import { describe, expect, it } from "vitest";
import { buildErrorReportCsv, getDataset, parseCsv, validateRows } from "@/lib/affiliate-bulk";

describe("affiliate import parsing", () => {
  it("parses quoted fields, doubled quotes, CRLF and skips blank lines", () => {
    const rows = parseCsv('a,b\r\n"x, y","say ""hi"""\r\n\r\n1,2\n');
    expect(rows).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
      ["1", "2"],
    ]);
  });

  it("counts the real rows and reports real issues", () => {
    const spec = getDataset("affiliates");
    const csv = [
      "first_name,last_name,email,country,tier",
      "Ananya,Mehta,ananya@partner.io,IN,gold",
      "Bo,Singh,not-an-email,IN,gold",
      ",Kim,cy@x.io,KR,diamond",
    ].join("\n");
    const result = validateRows(spec, parseCsv(csv));
    expect(result.parsed).toBe(3);
    expect(result.valid).toBe(1);
    expect(result.errors).toBe(2);
    expect(result.missingColumns).toEqual([]);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ row: 2, field: "email", severity: "error" }),
    );
    expect(result.issues).toContainEqual(expect.objectContaining({ row: 3, field: "first_name" }));
    expect(result.issues).toContainEqual(expect.objectContaining({ row: 3, field: "tier" }));
    expect(buildErrorReportCsv(result).split("\n")[0]).toBe("row,field,severity,message");
  });

  it("flags missing required columns", () => {
    const result = validateRows(getDataset("affiliates"), parseCsv("first_name\nA\n"));
    expect(result.missingColumns).toEqual(["last_name", "email", "country"]);
    expect(result.errors).toBe(1);
  });
});
