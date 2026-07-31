import { describe, expect, it } from "vitest";
import { notificationTypeLabel, unreadRate } from "./notificationLabels";

describe("notification governance labels", () => {
  it("translates known notification types", () => {
    expect(notificationTypeLabel("COMMENT_REPLY")).toBe("评论回复");
    expect(notificationTypeLabel("CUSTOM")).toBe("CUSTOM");
  });

  it("calculates the unread rate", () => {
    expect(unreadRate(2, 5)).toBe("40%");
    expect(unreadRate(0, 0)).toBe("0%");
  });
});
