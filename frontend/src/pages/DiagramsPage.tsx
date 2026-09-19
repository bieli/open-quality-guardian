import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { FunctionFlow } from "../components/FunctionFlow";

export function DiagramsPage() {
  const { id } = useParams();
  const q = useQuery({ queryKey: ["diagrams", id], queryFn: () => api.diagrams(id!), enabled: !!id });
  const [sel, setSel] = useState(0);
  const diagram = q.data?.[sel];

  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <div className="eyebrow">Behaviour the program can see</div>
          <h1>Functional diagrams</h1>
          <p className="muted small">Swimlane activity models — the same shape for every product feature, readable without SysML literacy.</p>
        </div>
      </div>
      <div className="lane-legend">
        {(q.data || []).map((d, i) => (
          <button key={d.id} className={`chip ${i === sel ? "ok" : ""}`} onClick={() => setSel(i)}>
            {d.identifier} {d.title}
          </button>
        ))}
      </div>
      {diagram ? (
        <>
          <FunctionFlow diagram={diagram} />
          {!!diagram.notes.length && (
            <div className="card small">
              Linked context: {diagram.notes.map((n) => `${n.label} ${n.ref || ""}`).join(" · ")}
            </div>
          )}
        </>
      ) : (
        <div className="card muted">No functional diagrams on this product yet.</div>
      )}
    </div>
  );
}
