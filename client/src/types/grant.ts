// Shared grant status values. Use these instead of bare "draft"/"submitted"
// string literals so a typo is a compile error rather than a silently broken
// lock check.

export const GRANT_STATUS = {
  DRAFT: "draft",
  SUBMITTED: "submitted",
} as const;
export const GRANT_APPROVAL_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  DENIED: "denied",
} as const;

export type GrantStatus = (typeof GRANT_STATUS)[keyof typeof GRANT_STATUS];
export type GrantApprovalStatus =
  (typeof GRANT_APPROVAL_STATUS)[keyof typeof GRANT_APPROVAL_STATUS];
