import type { Role } from "@/types/auth";
import type { GrantStatus } from "@/types/grant";
import { STATUS_META } from "@/lib/recognition-options";
import type { ApplicationStatus } from "@/types/recognition";

export const GRANT_TYPE_LABELS: Record<string, string> = {
  national_aid: "国家助学金",
};

export function grantTypeLabel(t: string): string {
  return GRANT_TYPE_LABELS[t] ?? t;
}

export function grantStatusMeta(status: GrantStatus) {
  return STATUS_META[status as ApplicationStatus] ?? { label: status, tone: "neutral" as const };
}

export function canEditGrant(status: GrantStatus): boolean {
  return status === "draft" || status === "rejected";
}

export function canReviewGrant(role: Role | undefined, status: GrantStatus): boolean {
  if (!role) return false;
  switch (status) {
    case "pending_class":
      return role === "classadvisor" || role === "admin";
    case "pending_dept":
      return role === "department" || role === "admin";
    case "pending_college":
      return role === "aidcenter" || role === "admin";
    default:
      return false;
  }
}

export const GRANT_STATUS_OPTIONS = (
  ["draft", "pending_class", "pending_dept", "pending_college", "approved", "rejected"] as GrantStatus[]
).map((value) => ({ value, label: grantStatusMeta(value).label }));

export function grantTodoStatusOptionsForRole(role: Role | undefined) {
  switch (role) {
    case "classadvisor":
      return [{ value: "pending_class" as GrantStatus, label: grantStatusMeta("pending_class").label }];
    case "department":
      return [{ value: "pending_dept" as GrantStatus, label: grantStatusMeta("pending_dept").label }];
    case "aidcenter":
      return [{ value: "pending_college" as GrantStatus, label: grantStatusMeta("pending_college").label }];
    case "admin":
      return (["pending_class", "pending_dept", "pending_college"] as GrantStatus[]).map((v) => ({
        value: v,
        label: grantStatusMeta(v).label,
      }));
    default:
      return [];
  }
}

export function grantRecordsTodoStatusOptionsForRole(role: Role | undefined) {
  switch (role) {
    case "classadvisor":
      return [{ value: "pending_class" as GrantStatus, label: grantStatusMeta("pending_class").label }];
    case "department":
      return (["pending_class", "pending_dept"] as GrantStatus[]).map((v) => ({
        value: v,
        label: grantStatusMeta(v).label,
      }));
    case "aidcenter":
    case "admin":
      return (["pending_class", "pending_dept", "pending_college"] as GrantStatus[]).map((v) => ({
        value: v,
        label: grantStatusMeta(v).label,
      }));
    default:
      return [];
  }
}
