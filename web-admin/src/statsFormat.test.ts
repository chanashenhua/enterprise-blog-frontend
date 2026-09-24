import { describe, expect, it } from "vitest";
import { engagementRate, interactionTotal, percentage } from "./statsFormat";

describe("engagementRate", () => {
  it("calculates engagement against views", () => {
    expect(engagementRate(2, 1, 10)).toBe("30%");
  });

  it("handles articles without views", () => {
    expect(engagementRate(1, 1, 0)).toBe("0%");
  });
});

describe("percentage", () => {
  it("calculates rounded coverage and caps it at 100", () => {
    expect(percentage(7, 9)).toBe(78);
    expect(percentage(12, 9)).toBe(100);
  });

  it("handles an empty baseline", () => {
    expect(percentage(3, 0)).toBe(0);
  });
});

describe("interactionTotal", () => {
  it("adds views, likes and favorites", () => {
    expect(interactionTotal(10, 3, 2)).toBe(15);
  });
});
