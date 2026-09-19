import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { StatusChip } from "../components/Bits";
import type { Artifact } from "../types";

const VIEWS = [
  ["R", "Requirements"],
  ["F", "Functional"],
  ["L", "Logical"],
  ["P", "Physical"],
] as const;

function Tree({ items, parent }: { items: Artifact[]; parent: string | null }) {
  const rows = items.filter((i) => i.parent_id === parent);
  if (!rows.length && parent === null) {
    return (
      <div className="muted small">Nothing captured in this viewpoint yet.</div>
    );
  }
  return (
    <>
      {rows.map((row) => (
        <div key={row.id} className="tree-item" style={{ marginLeft: parent ? 16 : 0 }}>
          <div className="id">{row.identifier}</div>
          <strong>{row.title}</strong>
          <div className="small muted" style={{ marginTop: 4, display: "flex", gap: 8, alignItems: "center" }}>
            <StatusChip status={row.status} /> {row.owner || "unassigned"} · {row.progress}%
          </div>
          <Tree items={items} parent={row.id} />
        </div>
      ))}
    </>
  );
}

export function RflpPage() {
  const { id } = useParams();
  const [vp, setVp] = useState<"R" | "F" | "L" | "P">("F");
  const arts = useQuery({ queryKey: ["arts", id], queryFn: () => api.artifacts(id!), enabled: !!id });
  const group = useMemo(() => (arts.data || []).filter((a) => a.viewpoint === vp), [arts.data, vp]);
  const physicalSw = group.filter((a) => a.domain === "software");
  const physicalHw = group.filter((a) => a.domain === "hardware" || a.kind === "hw_component");
  const reqStake = group.filter((a) => a.kind === "customer_feature" || a.kind === "stakeholder_need");
  const reqSys = group.filter((a) => a.kind === "requirement");

  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <div className="eyebrow">RFLP-centric model</div>
          <h1>One product, four viewpoints</h1>
          <p className="muted small">
            Same language for product owners and engineers: what is required, how it behaves, how it is allocated, and what is built.
          </p>
        </div>
      </div>
      <div className="rflp-layout">
        <div className="rflp-rail">
          {VIEWS.map(([k, label]) => (
            <button key={k} className={`rflp-btn ${vp === k ? "on" : ""}`} onClick={() => setVp(k)}>
              {k}
              <small>{label}</small>
            </button>
          ))}
        </div>
        <div className="rflp-canvas">
          {vp === "R" && (
            <div className="split">
              <div className="card tree-col">
                <div className="eyebrow">Stakeholder / customer features</div>
                <Tree items={reqStake} parent={null} />
              </div>
              <div className="card tree-col">
                <div className="eyebrow">System · software · hardware requirements</div>
                <Tree items={reqSys} parent={null} />
              </div>
            </div>
          )}
          {vp === "F" && (
            <div className="card">
              <div className="eyebrow">Functional partitions & actions</div>
              <Tree items={group} parent={null} />
            </div>
          )}
          {vp === "L" && (
            <div className="card">
              <div className="eyebrow">Logical architecture — sense, function, actuation</div>
              <Tree items={group} parent={null} />
            </div>
          )}
          {vp === "P" && (
            <div className="split">
              <div className="card">
                <div className="eyebrow">Software architecture</div>
                <Tree items={physicalSw.length ? physicalSw : group.filter((a) => a.kind === "sw_component")} parent={null} />
              </div>
              <div className="card">
                <div className="eyebrow">Hardware architecture</div>
                <Tree items={physicalHw.length ? physicalHw : group.filter((a) => a.kind === "hw_component")} parent={null} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
