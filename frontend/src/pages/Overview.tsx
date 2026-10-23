import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api";
import { QualityRing, StatusChip } from "../components/Bits";
import { FacetBar, QueryState } from "../components/QueryState";
import { Btn } from "../components/ui";
import { useProjectConfig } from "../ConfigContext";

export function Overview() {
  const { id } = useParams();
  const { activeConfigId, mode, activeConfig } = useProjectConfig();
  const quality = useQuery({ queryKey: ["quality", id, activeConfigId], queryFn: () => api.quality(id!, activeConfigId), enabled: !!id });
  const findings = useQuery({ queryKey: ["findings", id, activeConfigId], queryFn: () => api.findings(id!, activeConfigId), enabled: !!id });
  const vmodel = useQuery({ queryKey: ["vmodel", id, activeConfigId], queryFn: () => api.vmodel(id!, activeConfigId), enabled: !!id });
  const arts = useQuery({ queryKey: ["arts", id, activeConfigId], queryFn: () => api.artifacts(id!, undefined, activeConfigId), enabled: !!id });
  const q = quality.data;
  const chart = Object.entries(q?.by_viewpoint || {}).map(([k, v]) => ({ name: k, progress: v.progress, verified: v.verified }));

  const [sev, setSev] = useState("all");
  const [owner, setOwner] = useState("all");
  const [vp, setVp] = useState("all");

  const owners = useMemo(() => {
    const set = new Set((findings.data || []).map((f) => {
      const art = (arts.data || []).find((a) => a.id === f.artifact_id);
      return art?.owner || "unassigned";
    }));
    return [...set].sort();
  }, [findings.data, arts.data]);

  const filteredFindings = useMemo(() => {
    return (findings.data || []).filter((f) => {
      if (sev !== "all" && f.severity !== sev) return false;
      const art = (arts.data || []).find((a) => a.id === f.artifact_id);
      if (owner !== "all" && (art?.owner || "unassigned") !== owner) return false;
      if (vp !== "all" && art?.viewpoint !== vp) return false;
      return true;
    });
  }, [findings.data, arts.data, sev, owner, vp]);

  const checklist = useMemo(() => {
    const list = arts.data || [];
    const has = (pred: (a: (typeof list)[0]) => boolean) => list.some(pred);
    return [
      { key: "R", label: "Requirements captured", done: has((a) => a.viewpoint === "R"), href: "rflp" },
      { key: "F", label: "Functions / behaviour", done: has((a) => a.viewpoint === "F"), href: "diagrams" },
      { key: "L", label: "Logical allocation", done: has((a) => a.viewpoint === "L"), href: "rflp" },
      { key: "P", label: "Physical design / BOM", done: has((a) => a.viewpoint === "P" || a.kind === "bom" || a.kind === "cad"), href: "artifacts" },
      { key: "V", label: "Verification evidence", done: has((a) => a.viewpoint === "T"), href: "tests" },
      { key: "Q", label: "Review quality report", done: (q?.score || 0) > 0, href: "report" },
    ];
  }, [arts.data, q?.score]);

  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <div className="eyebrow">Quality cockpit</div>
          <h1>How healthy is this build?</h1>
          <p className="muted small">
            {mode === "100"
              ? `Scored for ${activeConfig?.name || "the selected SKU"}. Switch to 150% to see every variant at once.`
              : "150% view: every variant, option and common object."}
          </p>
        </div>
        <div className="btn-row">
          <Link to={`/projects/${id}/compose`}>
            <Btn>Compose & verify</Btn>
          </Link>
          <QualityRing value={q?.score || 0} />
        </div>
      </div>

      <QueryState loading={quality.isLoading} error={quality.error}>
        <div className="card">
          <div className="eyebrow">Program checklist</div>
          <div className="checklist">
            {checklist.map((c) => (
              <Link key={c.key} to={`/projects/${id}/${c.href}`} className={`check-item ${c.done ? "done" : ""}`}>
                <span className="check-mark">{c.done ? "✓" : "○"}</span>
                <span>
                  <strong>{c.key}</strong> {c.label}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="metrics">
          {[
            ["Coverage", `${q?.coverage ?? "–"}%`],
            ["Progress", `${q?.progress ?? "–"}%`],
            ["Requirements verified", `${q?.verified_requirements ?? 0}/${q?.requirements ?? 0}`],
            ["Tests passed", `${q?.tests_passed ?? 0}/${q?.tests ?? 0}`],
          ].map(([k, v]) => (
            <div className="card metric" key={k}>
              <span>{k}</span>
              <b>{v}</b>
            </div>
          ))}
        </div>

        <div className="two">
          <div className="card">
            <div className="eyebrow">RFLP progress</div>
            <div style={{ height: 240, marginTop: 8 }}>
              <ResponsiveContainer>
                <BarChart data={chart}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="progress" fill="#9c1d33" radius={6} />
                  <Bar dataKey="verified" fill="#1e6d61" radius={6} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="card">
            <div className="eyebrow">Findings filter (6W-style)</div>
            <FacetBar>
              <label className="facet">
                <span>Severity</span>
                <select value={sev} onChange={(e) => setSev(e.target.value)}>
                  <option value="all">All</option>
                  <option value="critical">Critical</option>
                  <option value="gap">Gap</option>
                  <option value="warning">Warning</option>
                  <option value="info">Info</option>
                </select>
              </label>
              <label className="facet">
                <span>Who (owner)</span>
                <select value={owner} onChange={(e) => setOwner(e.target.value)}>
                  <option value="all">All</option>
                  {owners.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
              <label className="facet">
                <span>What (viewpoint)</span>
                <select value={vp} onChange={(e) => setVp(e.target.value)}>
                  <option value="all">All</option>
                  {["R", "F", "L", "P", "T", "A"].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            </FacetBar>
            <div className="find-list" style={{ marginTop: 10, maxHeight: 280, overflow: "auto" }}>
              {filteredFindings.slice(0, 12).map((f) => (
                <div key={f.id} className={`find ${f.severity}`}>
                  <StatusChip status={f.severity} /> {f.title}
                  <div className="small muted">{f.detail}</div>
                </div>
              ))}
              {!filteredFindings.length && <p className="muted small">No findings match these filters.</p>}
            </div>
            <Link to={`/projects/${id}/report`} className="small" style={{ display: "inline-block", marginTop: 8 }}>
              Open quality report →
            </Link>
          </div>
        </div>

        <div className="card">
          <div className="eyebrow">V-model stations needing attention</div>
          <div className="scroll-table">
            <table>
              <thead>
                <tr>
                  <th>Station</th>
                  <th>Domain</th>
                  <th>Progress</th>
                  <th>Coverage</th>
                  <th>Gaps</th>
                </tr>
              </thead>
              <tbody>
                {(vmodel.data || [])
                  .slice()
                  .sort((a, b) => a.coverage + a.progress - (b.coverage + b.progress))
                  .slice(0, 6)
                  .map((n) => (
                    <tr key={n.key}>
                      <td>{n.name}</td>
                      <td>{n.domain}</td>
                      <td>{n.progress}%</td>
                      <td>{n.coverage}%</td>
                      <td>{n.gaps}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </QueryState>
    </div>
  );
}
