import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { StatusChip } from "../components/Bits";
import { ArtifactEditor, VerificationWizard } from "../components/Wizards";
import { FacetBar, QueryState } from "../components/QueryState";
import { Btn } from "../components/ui";
import type { Artifact } from "../types";
import { formatEffectivity, useProjectConfig } from "../ConfigContext";

const PAGE = 50;

export function TestsPage() {
  const { id } = useParams();
  const { activeConfigId } = useProjectConfig();
  const qc = useQueryClient();
  const tests = useQuery({ queryKey: ["tests", id, activeConfigId], queryFn: () => api.tests(id!, activeConfigId), enabled: !!id });
  const [wizard, setWizard] = useState(false);
  const [edit, setEdit] = useState<Artifact | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const verdict = useMutation({
    mutationFn: ({ aid, status }: { aid: string; status: string }) =>
      api.updateArtifact(id!, aid, { status, progress: status === "verified" ? 100 : status === "failed" ? 30 : 50 }),
    onSuccess: () => qc.invalidateQueries(),
  });
  const bulk = useMutation({
    mutationFn: (status: string) =>
      api.bulkStatus(id!, {
        artifact_ids: selected,
        status,
        progress: status === "verified" ? 100 : status === "failed" ? 30 : 50,
      }),
    onSuccess: () => {
      setSelected([]);
      qc.invalidateQueries();
    },
  });

  const filtered = useMemo(() => {
    let list = tests.data || [];
    const term = q.trim().toLowerCase();
    if (term) {
      list = list.filter(
        (t) => t.identifier.toLowerCase().includes(term) || t.title.toLowerCase().includes(term) || (t.owner || "").toLowerCase().includes(term),
      );
    }
    if (status !== "all") list = list.filter((t) => t.status === status);
    return list;
  }, [tests.data, q, status]);

  const pageRows = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));

  const toggle = (aid: string) => {
    setSelected((s) => (s.includes(aid) ? s.filter((x) => x !== aid) : [...s, aid]));
  };

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

      <FacetBar>
        <label className="facet grow">
          <span>Search</span>
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder="Filter tests…"
          />
        </label>
        <label className="facet">
          <span>Status</span>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">All</option>
            {["draft", "in_progress", "verified", "failed", "blocked"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        {!!selected.length && (
          <div className="btn-row" style={{ alignSelf: "end" }}>
            <Btn kind="ghost" onClick={() => bulk.mutate("verified")}>
              Bulk verify ({selected.length})
            </Btn>
            <Btn kind="ghost" onClick={() => bulk.mutate("failed")}>
              Bulk fail
            </Btn>
          </div>
        )}
      </FacetBar>

      <QueryState loading={tests.isLoading} error={tests.error} empty={!filtered.length} emptyMessage="No tests match this filter.">
        <div className="card scroll-table">
          <table>
            <thead>
              <tr>
                <th></th>
                <th>ID</th>
                <th>Name</th>
                <th>Subjects / notes</th>
                <th>Responsible</th>
                <th>Verdict</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((t) => (
                <tr key={t.id} className={t.status === "failed" ? "missing" : t.status === "verified" ? "ok-cell" : ""}>
                  <td>
                    <input type="checkbox" checked={selected.includes(t.id)} onChange={() => toggle(t.id)} />
                  </td>
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
          <div className="btn-row" style={{ marginTop: 12 }}>
            <Btn kind="ghost" disabled={page <= 0} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Btn>
            <span className="small muted">
              Page {page + 1} / {pages} · {filtered.length} tests
            </span>
            <Btn kind="ghost" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Btn>
          </div>
        </div>
      </QueryState>
      {wizard && id && <VerificationWizard projectId={id} onClose={() => setWizard(false)} />}
      {edit && id && <ArtifactEditor projectId={id} artifact={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}
