import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { FunctionWizard } from "../components/Wizards";
import { Btn } from "../components/ui";
import type { Diagram } from "../types";
import { WorkflowStudio } from "../workflow/WorkflowStudio";
import { useProjectConfig } from "../ConfigContext";

export function DiagramsPage() {
  const { id } = useParams();
  const { activeConfigId } = useProjectConfig();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["diagrams", id, activeConfigId], queryFn: () => api.diagrams(id!, activeConfigId), enabled: !!id });
  const [sel, setSel] = useState(0);
  const [wizard, setWizard] = useState(false);
  const diagram = q.data?.[sel];

  const save = useMutation({
    mutationFn: (payload: Pick<Diagram, "lanes" | "nodes" | "edges">) =>
      api.updateDiagram(id!, diagram!.id, {
        identifier: diagram!.identifier,
        title: diagram!.title,
        description: diagram!.description,
        lanes: payload.lanes,
        nodes: payload.nodes,
        edges: payload.edges,
        notes: diagram!.notes,
      }),
    onSuccess: (saved) => {
      qc.setQueryData<Diagram[]>(["diagrams", id], (rows) =>
        (rows || []).map((row) => (row.id === saved.id ? saved : row)),
      );
      qc.invalidateQueries({ queryKey: ["diagrams", id] });
    },
  });

  return (
    <div className="stack workflow-page">
      <div className="topbar">
        <div>
          <div className="eyebrow">Behaviour the program can see</div>
          <h1>Functional diagrams</h1>
          <p className="muted small">
            Drag steps onto swimlanes to design the workflow. Built on React Flow — connect the dots, then save.
          </p>
        </div>
        <div className="btn-row">
          <Btn onClick={() => setWizard(true)}>New function diagram</Btn>
        </div>
      </div>
      <div className="lane-legend">
        {(q.data || []).map((d, i) => (
          <button key={d.id} className={`chip ${i === sel ? "ok" : ""}`} onClick={() => setSel(i)}>
            {d.identifier} {d.title}
          </button>
        ))}
      </div>
      {q.isLoading ? (
        <div className="card muted">Loading diagrams…</div>
      ) : diagram ? (
        <>
          {!!diagram.notes.length && (
            <div className="card small">
              Linked context: {diagram.notes.map((n) => `${n.label} ${n.ref || ""}`).join(" · ")}
            </div>
          )}
          <WorkflowStudio
            key={diagram.id}
            diagram={diagram}
            saving={save.isPending}
            onSave={(next) => save.mutateAsync(next)}
          />
        </>
      ) : (
        <div className="card muted">
          No functional diagrams on this product yet. Create one from the function wizard, then drag steps onto the
          swimlanes.
        </div>
      )}
      {wizard && id && <FunctionWizard projectId={id} onClose={() => setWizard(false)} />}
    </div>
  );
}
