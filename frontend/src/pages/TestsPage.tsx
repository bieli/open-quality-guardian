import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { StatusChip } from "../components/Bits";

export function TestsPage() {
  const { id } = useParams();
  const tests = useQuery({ queryKey: ["tests", id], queryFn: () => api.tests(id!), enabled: !!id });
  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <div className="eyebrow">Verification & validation</div>
          <h1>Test specifications</h1>
          <p className="muted small">Each V-station on the right of the model is only as strong as the evidence hanging from it.</p>
        </div>
      </div>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Subjects / notes</th>
              <th>Responsible</th>
              <th>Verdict</th>
            </tr>
          </thead>
          <tbody>
            {(tests.data || []).map((t) => (
              <tr key={t.id} className={t.status === "failed" ? "missing" : t.status === "verified" ? "ok-cell" : ""}>
                <td className="mono">{t.identifier}</td>
                <td>
                  {t.title}
                  <div className="small muted">{t.kind.replaceAll("_", " ")} · {t.v_node_key}</div>
                </td>
                <td className="small">
                  {Array.isArray(t.extra?.subjects) ? (t.extra.subjects as string[]).join(", ") : t.description}
                </td>
                <td>{t.owner || "Set responsible"}</td>
                <td>
                  <StatusChip status={t.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
