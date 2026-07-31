import { describe, expect, it } from "vitest";
import { engagementRate } from "./statsFormat";

describe("engagementRate", () => {
  it("calculates engagement against views", () => {
    expect(engagementRate(2, 1, 10)).toBe("30%");
  });

  it("handles articles without views", () => {
    expect(engagementRate(1, 1, 0)).toBe("0%");
  });
});
