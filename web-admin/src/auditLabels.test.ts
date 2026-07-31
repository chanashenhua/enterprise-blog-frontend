import { describe, expect, it } from "vitest";
import { auditActionLabel } from "./auditLabels";

describe("auditActionLabel", () => {
  it("uses a readable label for known actions", () => {
    expect(auditActionLabel("REVIEW_APPROVE")).toBe("审核通过");
    expect(auditActionLabel("TAG_DEACTIVATE")).toBe("停用标签");
  });

  it("keeps unknown actions visible", () => {
    expect(auditActionLabel("CUSTOM_ACTION")).toBe("CUSTOM_ACTION");
  });
});
