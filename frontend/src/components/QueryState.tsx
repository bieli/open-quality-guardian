import type { ReactNode } from "react";

export function QueryState({
  loading,
  error,
  empty,
  emptyMessage = "Nothing here yet.",
  children,
}: {
  loading?: boolean;
  error?: Error | null | unknown;
  empty?: boolean;
  emptyMessage?: string;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div className="card query-state">
        <div className="eyebrow">Loading</div>
        <p className="muted small">Fetching the latest quality thread…</p>
      </div>
    );
  }
  if (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return (
      <div className="card query-state error-card">
        <div className="eyebrow">Could not load</div>
        <p className="error">{msg}</p>
        <p className="small muted">Try switching 150% / 100% or refresh the page.</p>
      </div>
    );
  }
  if (empty) {
    return (
      <div className="card query-state">
        <div className="eyebrow">Empty</div>
        <p className="muted small">{emptyMessage}</p>
      </div>
    );
  }
  return <>{children}</>;
}

export function FacetBar({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="facet-bar">{children}</div>;
}
