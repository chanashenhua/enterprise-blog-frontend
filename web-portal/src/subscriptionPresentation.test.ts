import { describe, expect, it } from "vitest";
import type { ContentSubscription } from "@/api/client";
import { subscriptionKey, subscriptionName } from "@/subscriptionPresentation";

const subscription: ContentSubscription = {
  id: "s-1",
  userId: "u-reader",
  targetType: "TAG",
  targetId: "java",
  createdAt: "2026-08-01T12:00:00+08:00",
};

describe("订阅展示", () => {
  it("使用类型和目标生成稳定键", () => {
    expect(subscriptionKey("TAG", "java")).toBe("TAG:java");
  });

  it("优先显示目录名称并为已下线目标保留标识", () => {
    expect(subscriptionName(subscription, [{ id: "java", name: "Java", active: true }], [])).toBe("Java");
    expect(subscriptionName({ ...subscription, targetId: "legacy" }, [], [])).toBe("legacy");
  });
});
