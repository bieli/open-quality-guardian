import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { StatusChip } from "../components/Bits";
import type { Artifact, VNode } from "../types";
import { ArtifactEditor, RequirementWizard, VerificationWizard } from "../components/Wizards";
import { Btn } from "../components/ui";

function NodeCard({ n, on, set }: { n?: VNode; on: string; set: (k: string) => void }) {
  if (!n) return null;
  const cls = ["vnode", n.status, n.side === "integration" && n.domain === "system" ? "integration" : "", on === n.key ? "active" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <button className={cls} onClick={() => set(n.key)} type="button">
      <div className="eyebrow">{n.side}</div>
      <strong>{n.name}</strong>
      <div className="meta">
        <span>{n.progress}% progress</span>
        <span>{n.coverage}% verified</span>
        <span>{n.gaps} gaps</span>
      </div>
    </button>
  );
}

export function VModelPage() {
  const { id } = useParams();
  const q = useQuery({ queryKey: ["vmodel", id], queryFn: () => api.vmodel(id!), enabled: !!id });
  const arts = useQuery({ queryKey: ["arts", id], queryFn: () => api.artifacts(id!), enabled: !!id });
  const [key, setKey] = useState("system_architecture");
  const [verify, setVerify] = useState(false);
  const [addReq, setAddReq] = useState(false);
  const [edit, setEdit] = useState<Artifact | null>(null);
  const byKey = useMemo(() => Object.fromEntries((q.data || []).map((n) => [n.key, n])), [q.data]);
  const selected = byKey[key];
  const related = (arts.data || []).filter((a) => a.v_node_key === key);
  const verifySide = selected?.side === "verify";

  const row = (left: string, right: string) => (
    <div className="v-row">
      <NodeCard n={byKey[left]} on={key} set={setKey} />
      <div className="v-gutter">⟷</div>
      <NodeCard n={byKey[right]} on={key} set={setKey} />
    </div>
  );

  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <div className="eyebrow">Systems engineering</div>
          <h1>Multi-V model</h1>
          <p className="muted small">Design on the left, verification on the right. Select a station, then add work or record a verdict.</p>
        </div>
      </div>
      <div className="vmodel">
        <section className="v-band">
          <h3>Systems engineering</h3>
          {row("stakeholder_req", "validation")}
          {row("system_req", "system_verification")}
          <div className="v-row center">
            <NodeCard n={byKey.system_architecture} on={key} set={setKey} />
            <NodeCard n={byKey.system_integration} on={key} set={setKey} />
          </div>
        </section>
        <div className="split">
          <section className="v-band">
            <h3>Software engineering</h3>
            {row("sw_req", "sw_verification")}
            {row("sw_architecture", "sw_comp_verif")}
            {row("sw_detailed_design", "sw_unit_verif")}
          </section>
          <section className="v-band">
            <h3>Hardware engineering</h3>
            {row("hw_req", "hw_verification")}
            {row("hw_architecture", "hw_comp_verif")}
            {row("hw_detailed_design", "hw_unit_verif")}
          </section>
        </div>
      </div>
      {selected && (
        <div className="card">
          <div className="topbar" style={{ marginBottom: 8 }}>
            <div>
              <div className="eyebrow">{selected.domain} · {selected.key}</div>
              <h2 className="serif" style={{ margin: "8px 0" }}>{selected.name}</h2>
              <p className="muted small">{selected.description}</p>
            </div>
            <div className="btn-row">
              {verifySide ? (
                <Btn onClick={() => setVerify(true)}>Record verification</Btn>
              ) : (
                <Btn onClick={() => setAddReq(true)}>Add to this station</Btn>
              )}
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Kind</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {related.map((a) => (
                <tr key={a.id} onClick={() => setEdit(a)} style={{ cursor: "pointer" }}>
                  <td className="mono">{a.identifier}</td>
                  <td>{a.title}</td>
                  <td>{a.kind}</td>
                  <td>{a.owner || "—"}</td>
                  <td>
                    <StatusChip status={a.status} />
                  </td>
                  <td>{a.progress}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {verify && id && <VerificationWizard projectId={id} vNodeKey={key} onClose={() => setVerify(false)} />}
      {addReq && id && <RequirementWizard projectId={id} vNodeKey={key} onClose={() => setAddReq(false)} />}
      {edit && id && <ArtifactEditor projectId={id} artifact={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}
