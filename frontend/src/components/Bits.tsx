import type { CSSProperties } from "react";

export function StatusChip({ status }: { status: string }) {
  return <span className={`chip ${status}`}>{status.replaceAll("_", " ")}</span>;
}

export function QualityRing({ value, color }: { value: number; color?: string }) {
  return (
    <div className="ring" style={{ "--p": value, "--ring-color": color || undefined } as CSSProperties}>
      <strong>{Math.round(value)}</strong>
    </div>
  );
}
