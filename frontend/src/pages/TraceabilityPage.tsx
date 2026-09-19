import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "../api";

export function TraceabilityPage() {
  const { id } = useParams();
  const matrix = useQuery({ queryKey: ["matrix", id], queryFn: () => api.matrix(id!), enabled: !!id });
  const links = useQuery({ queryKey: ["links", id], queryFn: () => api.links(id!), enabled: !!id });

  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <div className="eyebrow">Horizontal & vertical thread</div>
          <h1>Traceability</h1>
          <p className="muted small">Yellow cells are the same signal PREEvision uses: a requirement still missing architecture or a function still missing a need.</p>
        </div>
      </div>
      <div className="card" style={{ overflow: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Requirement</th>
              <th>Linked functions / logical blocks</th>
              <th>Thread</th>
            </tr>
          </thead>
          <tbody>
            {(matrix.data?.rows || []).map((row) => (
              <tr key={row.id} className={row.missing ? "missing" : ""}>
                <td>
                  <div className="mono">{row.identifier}</div>
                  {row.title}
                </td>
                <td>
                  {row.linked.length
                    ? row.linked.map((l) => (
                        <div key={l.id} className="mono">
                          {l.identifier} {l.title}
                        </div>
                      ))
                    : "— links missing"}
                </td>
                <td>{row.missing ? `${row.missing} gap` : "connected"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <div className="eyebrow">All links</div>
        <table>
          <thead>
            <tr>
              <th>From</th>
              <th>Type</th>
              <th>To</th>
            </tr>
          </thead>
          <tbody>
            {(links.data || []).map((l) => (
              <tr key={l.id}>
                <td>
                  <span className="mono">{l.source_identifier}</span> {l.source_title}
                </td>
                <td>{l.link_type}</td>
                <td>
                  <span className="mono">{l.target_identifier}</span> {l.target_title}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
