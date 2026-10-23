import { useQuery } from "@tanstack/react-query";
import { api } from "../api";

export function ImpactPanel({ projectId, artifactId }: { projectId: string; artifactId: string }) {
  const q = useQuery({
    queryKey: ["impact", projectId, artifactId],
    queryFn: () => api.impact(projectId, artifactId),
    enabled: !!projectId && !!artifactId,
  });
  const d = q.data;
  if (q.isLoading) return <p className="small muted">Loading impact…</p>;
  if (!d) return null;
  return (
    <div className="impact-panel">
      <div className="eyebrow">Impact preview</div>
      <p className="small muted">
        Changing this item may affect {d.counts.upstream || 0} upstream, {d.counts.downstream || 0} downstream,{" "}
        {d.counts.tests || 0} tests, {d.counts.bom || 0} BOM lines.
      </p>
      <div className="three" style={{ marginTop: 8 }}>
        <ImpactCol title="Upstream" rows={d.upstream} />
        <ImpactCol title="Downstream" rows={d.downstream} />
        <ImpactCol title="Tests" rows={d.tests} />
      </div>
      {!!d.bom.length && (
        <div className="small" style={{ marginTop: 8 }}>
          <strong>BOM</strong>
          {d.bom.map((b) => (
            <div key={b.id} className="mono">
              {b.part_number} {b.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ImpactCol({
  title,
  rows,
}: {
  title: string;
  rows: { id: string; identifier: string; title: string; link_type?: string }[];
}) {
  return (
    <div>
      <div className="eyebrow">{title}</div>
      {!rows.length && <div className="small muted">—</div>}
      {rows.slice(0, 8).map((r) => (
        <div key={r.id} className="small">
          <span className="mono">{r.identifier}</span> {r.title}
          {r.link_type ? <span className="muted"> · {r.link_type}</span> : null}
        </div>
      ))}
    </div>
  );
}
