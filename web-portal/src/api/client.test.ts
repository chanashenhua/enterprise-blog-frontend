import { describe, expect, it } from "vitest";
import { buildMockUserHeaders } from "./client";

describe("buildMockUserHeaders", () => {
  it("builds dev mock identity headers", () => {
    expect(buildMockUserHeaders("u-author")).toEqual({
      "X-Mock-User": "u-author",
      "X-Mock-Roles": "AUTHOR,READER",
      "X-Mock-Departments": "d-platform",
      "X-Mock-Teams": "t-search",
    });
  });
});
