export type OrganizationOption = { id: string; name: string; departmentId?: string; departmentName?: string };
export type OrganizationDirectory = { departments: OrganizationOption[]; teams: OrganizationOption[] };
export const MAX_ORG_TARGETS = 50;

export function organizationOptions(directory: OrganizationDirectory | null, type: string): OrganizationOption[] {
  return type === "DEPARTMENT" ? directory?.departments ?? [] : type === "TEAM" ? directory?.teams ?? [] : [];
}

export function filterOrganizations(options: OrganizationOption[], query: string): OrganizationOption[] {
  const text = query.trim().toLocaleLowerCase();
  return options.filter(item => [item.id, item.name, item.departmentName ?? ""].join(" ").toLocaleLowerCase().includes(text));
}

export function validOrgSelection(type: string, ids: string[], options: OrganizationOption[]): boolean {
  if (type === "COMPANY") return ids.length === 0;
  if (type !== "DEPARTMENT" && type !== "TEAM") return false;
  return ids.length > 0 && ids.length <= MAX_ORG_TARGETS && new Set(ids).size === ids.length
    && ids.every(id => options.some(item => item.id === id));
}
