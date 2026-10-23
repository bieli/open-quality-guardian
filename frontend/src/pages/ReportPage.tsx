import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { QualityRing, StatusChip } from "../components/Bits";
import { useProjectConfig } from "../ConfigContext";

export function ReportPage() {
  const { id } = useParams();
  const { activeConfigId } = useProjectConfig();
  const report = useQuery({ queryKey: ["report", id, activeConfigId], queryFn: () => api.report(id!, activeConfigId), enabled: !!id });
  const r = report.data;
  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <div className="eyebrow">Program report</div>
          <h1>Verification narrative</h1>
        </div>
        <QualityRing value={r?.quality.score || 0} />
      </div>
      <div className="card">
        <p className="small" style={{ fontSize: 16, lineHeight: 1.6 }}>{r?.narrative}</p>
        <p className="muted small">Generated {r?.generated_at && new Date(r.generated_at).toLocaleString()}</p>
      </div>
      <div className="two">
        <div className="card">
          <div className="eyebrow">Missing links</div>
          <table>
            <tbody>
              {(r?.missing_links || []).map((m) => (
                <tr key={m.identifier}>
                  <td className="mono">{m.identifier}</td>
                  <td>{m.title}</td>
                  <td>{m.missing.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <div className="eyebrow">Findings</div>
          <div className="find-list">
            {(r?.findings || []).map((f) => (
              <div key={f.id} className={`find ${f.severity}`}>
                <StatusChip status={f.severity} /> {f.title}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
