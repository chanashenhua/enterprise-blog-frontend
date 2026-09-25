import { describe, expect, it } from "vitest";
import { filterOrganizations, organizationOptions, validOrgSelection, type OrganizationDirectory } from "./organizationScope";

const directory: OrganizationDirectory = {
  departments: [{ id: "d-platform", name: "平台工程" }, { id: "d-pay", name: "支付工程" }],
  teams: [{ id: "t-search", name: "Search Team", departmentId: "d-platform", departmentName: "平台工程" }],
};

describe("organization scope", () => {
  it("keeps department and team IDs separate", () => {
    expect(organizationOptions(directory, "TEAM")).toEqual(directory.teams);
    expect(organizationOptions(directory, "DEPARTMENT")).toEqual(directory.departments);
    expect(organizationOptions(null, "TEAM")).toEqual([]);
    expect(organizationOptions(directory, "COMPANY")).toEqual([]);
  });
  it("searches names, IDs and team parent department case-insensitively", () => {
    for (const query of ["平台", " SEARCH ", "T-SEARCH"]) expect(filterOrganizations(directory.teams, query)).toEqual(directory.teams);
    expect(filterOrganizations(directory.teams, "不存在")).toEqual([]);
  });
  it("requires an existing non-empty selection and rejects stale IDs or the wrong kind", () => {
    expect(validOrgSelection("TEAM", ["t-search"], directory.teams)).toBe(true);
    expect(validOrgSelection("TEAM", [], directory.teams)).toBe(false);
    expect(validOrgSelection("TEAM", ["d-platform"], directory.teams)).toBe(false);
    expect(validOrgSelection("TEAM", ["removed"], directory.teams)).toBe(false);
    expect(validOrgSelection("TEAM", ["t-search", "t-search"], directory.teams)).toBe(false);
  });
  it("allows company scope without a directory and enforces the 50-target limit", () => {
    expect(validOrgSelection("COMPANY", [], [])).toBe(true);
    expect(validOrgSelection("COMPANY", ["t-search"], [])).toBe(false);
    const items = Array.from({ length: 51 }, (_, i) => ({ id: "t-" + i, name: "团队 " + i }));
    expect(validOrgSelection("TEAM", items.slice(0, 50).map(item => item.id), items)).toBe(true);
    expect(validOrgSelection("TEAM", items.map(item => item.id), items)).toBe(false);
  });
});
