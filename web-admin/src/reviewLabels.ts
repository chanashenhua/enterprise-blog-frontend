const labels: Record<string, string> = { PENDING: "待审核", APPROVING: "审核处理中", APPROVED: "已通过", REJECTING: "驳回处理中", REJECTED: "已驳回" };
export const reviewStatusLabel = (status: string) => labels[status] ?? status;
