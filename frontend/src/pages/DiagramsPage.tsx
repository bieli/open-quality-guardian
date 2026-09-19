import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { FunctionFlow } from "../components/FunctionFlow";
import { FunctionWizard } from "../components/Wizards";
import { Btn, Field, Modal } from "../components/ui";
import type { Diagram } from "../types";

export function DiagramsPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["diagrams", id], queryFn: () => api.diagrams(id!), enabled: !!id });
  const [sel, setSel] = useState(0);
  const [wizard, setWizard] = useState(false);
  const [edit, setEdit] = useState(false);
  const diagram = q.data?.[sel];

  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <div className="eyebrow">Behaviour the program can see</div>
          <h1>Functional diagrams</h1>
          <p className="muted small">Swimlane activity models — add a function, then edit lanes, actions and flows.</p>
        </div>
        <div className="btn-row">
          <Btn kind="ghost" onClick={() => setEdit(true)} disabled={!diagram}>
            Edit diagram
          </Btn>
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
        <div className="card muted">No functional diagrams on this product yet. Create one from the function wizard.</div>
      )}
      {wizard && id && <FunctionWizard projectId={id} onClose={() => setWizard(false)} />}
      {edit && diagram && id && (
        <DiagramEditor
          projectId={id}
          diagram={diagram}
          onClose={() => setEdit(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["diagrams", id] });
            setEdit(false);
          }}
        />
      )}
    </div>
  );
}

function DiagramEditor({
  projectId,
  diagram,
  onClose,
  onSaved,
}: {
  projectId: string;
  diagram: Diagram;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [lanes, setLanes] = useState(diagram.lanes.map((l) => l.title).join(", "));
  const [nodesText, setNodesText] = useState(
    diagram.nodes.map((n) => `${n.id}|${n.lane}|${n.kind}|${n.label}|${n.x}|${n.y}`).join("\n"),
  );
  const [edgesText, setEdgesText] = useState(diagram.edges.map((e) => `${e.from}>${e.to}${e.label ? "|" + e.label : ""}`).join("\n"));
  const mut = useMutation({
    mutationFn: () => {
      const laneList = lanes.split(",").map((s) => s.trim()).filter(Boolean);
      const laneObjs = laneList.map((title, i) => ({
        id: diagram.lanes[i]?.id || title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        title,
        subtitle: diagram.lanes[i]?.subtitle || "",
      }));
      const nodes = nodesText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [nid, lane, kind, label, x, y] = line.split("|");
          return { id: nid, lane, kind: kind || "action", label, x: Number(x || 40), y: Number(y || 80) };
        });
      const edges = edgesText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [flow, label] = line.split("|");
          const [from, to] = flow.split(">");
          return { from, to, label };
        });
      return api.updateDiagram(projectId, diagram.id, {
        identifier: diagram.identifier,
        title: diagram.title,
        description: diagram.description,
        lanes: laneObjs,
        nodes,
        edges,
        notes: diagram.notes,
      });
    },
    onSuccess: onSaved,
  });
  const preview = useMemo(() => diagram, [diagram]);
  return (
    <Modal title={`Edit ${preview.identifier}`} onClose={onClose} onSubmit={() => mut.mutate()} busy={mut.isPending} submitLabel="Save diagram">
      <div className="form-grid">
        <p className="small muted">
          Lanes are comma-separated. Each action is <span className="mono">id|lane|kind|label|x|y</span>. Each flow is{" "}
          <span className="mono">from&gt;to|optional label</span>. Kinds: action, sync, decision, end.
        </p>
        <Field label="Lanes">
          <input value={lanes} onChange={(e) => setLanes(e.target.value)} />
        </Field>
        <Field label="Nodes">
          <textarea rows={8} className="mono" value={nodesText} onChange={(e) => setNodesText(e.target.value)} />
        </Field>
        <Field label="Edges">
          <textarea rows={5} className="mono" value={edgesText} onChange={(e) => setEdgesText(e.target.value)} />
        </Field>
        {mut.error && <p className="error">{(mut.error as Error).message}</p>}
      </div>
    </Modal>
  );
}
