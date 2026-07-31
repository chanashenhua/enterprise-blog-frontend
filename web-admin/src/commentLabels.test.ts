import { describe, expect, it } from "vitest";
import { commentStatusLabels, commentSummary } from "@/commentLabels";

describe("评论治理展示", () => {
  it("提供完整状态中文标签", () => {
    expect(commentStatusLabels).toEqual({ ACTIVE: "正常展示", HIDDEN: "已隐藏", DELETED: "用户删除" });
  });

  it("压缩空白并截断过长评论", () => {
    expect(commentSummary("  第一行\n 第二行  ")).toBe("第一行 第二行");
    expect(commentSummary("123456", 4)).toBe("1234…");
  });
});
