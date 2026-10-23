import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { StatusChip } from "../components/Bits";
import { ArtifactEditor, VerificationWizard } from "../components/Wizards";
import { Btn } from "../components/ui";
import type { Artifact } from "../types";
import { formatEffectivity, useProjectConfig } from "../ConfigContext";

export function TestsPage() {
  const { id } = useParams();
  const { activeConfigId } = useProjectConfig();
  const qc = useQueryClient();
  const tests = useQuery({ queryKey: ["tests", id, activeConfigId], queryFn: () => api.tests(id!, activeConfigId), enabled: !!id });
  const [wizard, setWizard] = useState(false);
  const [edit, setEdit] = useState<Artifact | null>(null);
  const verdict = useMutation({
    mutationFn: ({ aid, status }: { aid: string; status: string }) =>
      api.updateArtifact(id!, aid, { status, progress: status === "verified" ? 100 : status === "failed" ? 30 : 50 }),
    onSuccess: () => qc.invalidateQueries(),
  });

  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <div className="eyebrow">Verification & validation</div>
          <h1>Test specifications</h1>
          <p className="muted small">Each V-station on the right of the model is only as strong as the evidence hanging from it.</p>
        </div>
        <Btn onClick={() => setWizard(true)}>New test / verdict</Btn>
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
                <td className="mono" onClick={() => setEdit(t)} style={{ cursor: "pointer" }}>
                  {t.identifier}
                </td>
                <td onClick={() => setEdit(t)} style={{ cursor: "pointer" }}>
                  {t.title}
                  <div className="small muted">
                    {t.kind.replaceAll("_", " ")} · {t.v_node_key}
                    {t.effectivity && Object.keys(t.effectivity).length ? ` · ${formatEffectivity(t.effectivity)}` : ""}
                  </div>
                </td>
                <td className="small">
                  {Array.isArray(t.extra?.subjects) ? (t.extra.subjects as string[]).join(", ") : t.description}
                </td>
                <td>{t.owner || "Set responsible"}</td>
                <td>
                  <select
                    value={t.status}
                    onChange={(e) => verdict.mutate({ aid: t.id, status: e.target.value })}
                    style={{ minWidth: 140 }}
                  >
                    {["draft", "in_progress", "verified", "failed", "blocked"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <div style={{ marginTop: 6 }}>
                    <StatusChip status={t.status} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {wizard && id && <VerificationWizard projectId={id} onClose={() => setWizard(false)} />}
      {edit && id && <ArtifactEditor projectId={id} artifact={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}
