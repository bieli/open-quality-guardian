import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api";
import { QualityRing, StatusChip } from "../components/Bits";
import { Btn } from "../components/ui";
import { useProjectConfig } from "../ConfigContext";

export function Overview() {
  const { id } = useParams();
  const { activeConfigId, mode, activeConfig } = useProjectConfig();
  const quality = useQuery({ queryKey: ["quality", id, activeConfigId], queryFn: () => api.quality(id!, activeConfigId), enabled: !!id });
  const findings = useQuery({ queryKey: ["findings", id, activeConfigId], queryFn: () => api.findings(id!, activeConfigId), enabled: !!id });
  const vmodel = useQuery({ queryKey: ["vmodel", id, activeConfigId], queryFn: () => api.vmodel(id!, activeConfigId), enabled: !!id });
  const q = quality.data;
  const chart = Object.entries(q?.by_viewpoint || {}).map(([k, v]) => ({ name: k, progress: v.progress, verified: v.verified }));

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
          <div className="eyebrow">Open findings</div>
          <div className="find-list" style={{ marginTop: 10 }}>
            {(findings.data || []).slice(0, 6).map((f) => (
              <div key={f.id} className={`find ${f.severity}`}>
                <StatusChip status={f.severity} /> {f.title}
                <div className="small muted">{f.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="card">
        <div className="eyebrow">V-model stations needing attention</div>
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
  );
}
