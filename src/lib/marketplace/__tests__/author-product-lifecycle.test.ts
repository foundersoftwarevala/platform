import { describe, expect, it } from "vitest";
import { getAuthorProductActions } from "../author-product-lifecycle";

describe("author product lifecycle UI actions", () => {
  it("lets drafts be edited and submitted", () => {
    expect(getAuthorProductActions("draft")).toEqual({
      canEdit: true,
      canSubmit: true,
      canWithdraw: false,
      canReturnToDraft: false,
      readOnly: false,
    });
  });

  it("lets submitted products be withdrawn, but not edited", () => {
    expect(getAuthorProductActions("submitted")).toEqual({
      canEdit: false,
      canSubmit: false,
      canWithdraw: true,
      canReturnToDraft: false,
      readOnly: false,
    });
  });

  it("lets change-requested products be edited and resubmitted", () => {
    expect(getAuthorProductActions("changes_requested")).toEqual({
      canEdit: true,
      canSubmit: true,
      canWithdraw: false,
      canReturnToDraft: false,
      readOnly: false,
    });
  });

  it("requires rejected products to return to draft before resubmission", () => {
    expect(getAuthorProductActions("rejected")).toEqual({
      canEdit: true,
      canSubmit: false,
      canWithdraw: false,
      canReturnToDraft: true,
      readOnly: false,
    });
  });

  it.each(["approved", "published", "under_review", "archived", "unknown"])(
    "keeps %s products read-only",
    (status) => {
      expect(getAuthorProductActions(status)).toEqual({
        canEdit: false,
        canSubmit: false,
        canWithdraw: false,
        canReturnToDraft: false,
        readOnly: true,
      });
    },
  );
});
