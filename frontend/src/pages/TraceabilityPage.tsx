import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { LinkWizard } from "../components/Wizards";
import { Btn } from "../components/ui";

export function TraceabilityPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const matrix = useQuery({ queryKey: ["matrix", id], queryFn: () => api.matrix(id!), enabled: !!id });
  const links = useQuery({ queryKey: ["links", id], queryFn: () => api.links(id!), enabled: !!id });
  const [wizard, setWizard] = useState(false);
  const del = useMutation({
    mutationFn: (lid: string) => api.deleteLink(id!, lid),
    onSuccess: () => qc.invalidateQueries(),
  });

  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <div className="eyebrow">Horizontal & vertical thread</div>
          <h1>Traceability</h1>
          <p className="muted small">Yellow cells are missing architecture. Add or remove links as the design changes.</p>
        </div>
        <Btn onClick={() => setWizard(true)}>Add link</Btn>
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
              <th></th>
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
                <td>
                  <Btn kind="ghost" onClick={() => del.mutate(l.id)}>
                    Remove
                  </Btn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {wizard && id && <LinkWizard projectId={id} onClose={() => setWizard(false)} />}
    </div>
  );
}
