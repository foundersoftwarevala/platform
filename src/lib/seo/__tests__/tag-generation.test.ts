import { describe, expect, it } from "vitest";
import { buildTagPrompt, parseTagResponse } from "@/lib/seo/tag-generation.server";

/**
 * Reading a provider's reply, and telling it what it may say.
 *
 * No provider is configured on this platform - api_services holds 188 services
 * and none approved, and no credential is in the environment - so the service
 * returns NOT_CONFIGURED today. These two pieces are pure, so they can be held
 * to their contract now rather than the first time a key appears.
 */

const facts = {
  id: "00000000-0000-0000-0000-000000000000",
  slot_url: "/marketplace/school-erp/india",
  category: "School ERP",
  country: "India",
  region: "South Asia",
  business_type: "School",
  software_type: "ERP",
  primary_keyword: "school erp software India",
  product_name: "Vidya ERP",
};

describe("buildTagPrompt", () => {
  it("states the slot's fixed identity, which the model may not change", () => {
    const prompt = buildTagPrompt(facts, ["India", "Kenya", "Germany"]);
    expect(prompt).toContain("category: School ERP");
    expect(prompt).toContain("country: India");
    expect(prompt).toContain("region: South Asia");
    expect(prompt).toContain("product currently in the slot: Vidya ERP");
  });

  it("names the other countries, so the model does not stray into their slots", () => {
    const prompt = buildTagPrompt(facts, ["India", "Kenya", "Germany"]);
    expect(prompt).toContain("Kenya");
    expect(prompt).toContain("Germany");
  });

  it("rules out the claims the gate would reject anyway", () => {
    const prompt = buildTagPrompt(facts, ["India"]);
    expect(prompt).toMatch(/superlatives/i);
    expect(prompt).toMatch(/ratings/i);
    expect(prompt).toMatch(/prices/i);
    expect(prompt).toMatch(/percentages/i);
  });

  it("leaves out a fact the slot does not have, rather than writing an empty line", () => {
    const bare = { ...facts, region: null, product_name: null, business_type: null };
    const prompt = buildTagPrompt(bare, ["India"]);
    expect(prompt).not.toContain("region:");
    expect(prompt).not.toContain("product currently in the slot:");
  });
});

describe("parseTagResponse", () => {
  const bundle = {
    primary: "school erp software India",
    secondary: ["school management software India"],
    longTail: [],
    semantic: [],
    geo: [],
    entities: [],
    questions: [],
    titleCandidates: [],
    metaDescriptionCandidates: [],
  };

  it("reads plain JSON", () => {
    expect(parseTagResponse(JSON.stringify(bundle))?.primary).toBe("school erp software India");
  });

  it("reads JSON inside a code fence, because models keep sending them", () => {
    const fenced = "Here you go:\n```json\n" + JSON.stringify(bundle) + "\n```\nHope that helps.";
    expect(parseTagResponse(fenced)?.secondary).toEqual(["school management software India"]);
  });

  it("reads JSON wrapped in prose", () => {
    expect(parseTagResponse("Sure. " + JSON.stringify(bundle) + " Let me know.")?.primary).toBe(
      "school erp software India",
    );
  });

  it("drops non-string entries rather than passing them on", () => {
    const messy = JSON.stringify({ ...bundle, secondary: ["ok", 42, null, { a: 1 }] });
    expect(parseTagResponse(messy)?.secondary).toEqual(["ok"]);
  });

  it("treats a missing list as empty, not as a failure", () => {
    const partial = JSON.stringify({ primary: "school erp software India" });
    const parsed = parseTagResponse(partial);
    expect(parsed?.primary).toBe("school erp software India");
    expect(parsed?.longTail).toEqual([]);
  });

  it("refuses a reply with no primary keyword", () => {
    expect(parseTagResponse(JSON.stringify({ ...bundle, primary: "" }))).toBeNull();
    expect(parseTagResponse(JSON.stringify({ secondary: ["x"] }))).toBeNull();
  });

  it("refuses prose, malformed JSON and nothing at all", () => {
    expect(parseTagResponse("I cannot help with that.")).toBeNull();
    expect(parseTagResponse("{ primary: unquoted }")).toBeNull();
    expect(parseTagResponse("")).toBeNull();
  });
});
