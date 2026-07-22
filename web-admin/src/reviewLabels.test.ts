import { describe, expect, it } from "vitest";
import { reviewStatusLabel } from "./reviewLabels";

describe("reviewStatusLabel", () => {
  it("renders pending status in Chinese", () => { expect(reviewStatusLabel("PENDING")).toBe("待审核"); });
});
