import type { ReactNode } from "react";
import { Building2, Users } from "lucide-react";

export function StudentIdentity({
  name,
  studentNo,
  deptName,
  className,
  extra,
}: {
  name?: string;
  studentNo?: string;
  deptName?: string;
  className?: string;
  extra?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2.5">
      <div
        className="flex shrink-0 items-center justify-center text-base font-semibold"
        style={{
          width: 44,
          height: 44,
          borderRadius: "var(--radius-md)",
          backgroundColor: "var(--color-primary-light)",
          color: "var(--color-primary)",
        }}
      >
        {(name || "学").charAt(0)}
      </div>
      <h2 className="text-lg font-semibold text-ink">{name || "—"}</h2>
      {studentNo ? <span className="text-sm text-ink-mute">{studentNo}</span> : null}
      {deptName ? (
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs"
          style={{
            backgroundColor: "var(--color-primary-subtle)",
            color: "var(--color-primary)",
          }}
        >
          <Building2 size={12} />
          {deptName}
        </span>
      ) : null}
      {className ? (
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs"
          style={{
            backgroundColor: "var(--color-bg-page)",
            color: "var(--color-text-secondary)",
            border: "1px solid var(--color-border)",
          }}
        >
          <Users size={12} />
          {className}
        </span>
      ) : null}
      {extra}
    </div>
  );
}
