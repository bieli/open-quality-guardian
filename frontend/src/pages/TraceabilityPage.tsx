import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { LinkWizard } from "../components/Wizards";
import { FacetBar, QueryState } from "../components/QueryState";
import { Btn } from "../components/ui";
import { MultiSearchableSelect, SearchableSelect } from "../components/SearchableSelect";
import { useProjectConfig } from "../ConfigContext";

const PAGE = 40;

export function TraceabilityPage() {
  const { id } = useParams();
  const { activeConfigId } = useProjectConfig();
  const qc = useQueryClient();
  const matrix = useQuery({ queryKey: ["matrix", id, activeConfigId], queryFn: () => api.matrix(id!, activeConfigId), enabled: !!id });
  const links = useQuery({ queryKey: ["links", id, activeConfigId], queryFn: () => api.links(id!, activeConfigId), enabled: !!id });
  const arts = useQuery({ queryKey: ["arts", id, activeConfigId], queryFn: () => api.artifacts(id!, undefined, activeConfigId), enabled: !!id });
  const [wizard, setWizard] = useState(false);
  const [bulk, setBulk] = useState(false);
  const [q, setQ] = useState("");
  const [onlyGaps, setOnlyGaps] = useState(false);
  const [page, setPage] = useState(0);
  const del = useMutation({
    mutationFn: (lid: string) => api.deleteLink(id!, lid),
    onSuccess: () => qc.invalidateQueries(),
  });

  const rows = useMemo(() => {
    let list = matrix.data?.rows || [];
    const term = q.trim().toLowerCase();
    if (term) list = list.filter((r) => r.identifier.toLowerCase().includes(term) || r.title.toLowerCase().includes(term));
    if (onlyGaps) list = list.filter((r) => r.missing);
    return list;
  }, [matrix.data, q, onlyGaps]);

  const pageRows = rows.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));

  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <div className="eyebrow">Horizontal & vertical thread</div>
          <h1>Traceability</h1>
          <p className="muted small">Yellow cells are missing architecture. Filter and page when the matrix grows large.</p>
        </div>
        <div className="btn-row">
          <Btn kind="ghost" onClick={() => setBulk(true)}>
            Bulk link
          </Btn>
          <Btn onClick={() => setWizard(true)}>Add link</Btn>
        </div>
      </div>

      <FacetBar>
        <label className="facet grow">
          <span>Search</span>
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Filter requirements…" />
        </label>
        <label className="field-check" style={{ alignSelf: "end", marginBottom: 6 }}>
          <input type="checkbox" checked={onlyGaps} onChange={(e) => { setOnlyGaps(e.target.checked); setPage(0); }} />
          Gaps only
        </label>
      </FacetBar>

      <QueryState loading={matrix.isLoading} error={matrix.error} empty={!rows.length} emptyMessage="No requirements match this filter.">
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
              {pageRows.map((row) => (
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
          <div className="btn-row" style={{ marginTop: 12 }}>
            <Btn kind="ghost" disabled={page <= 0} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Btn>
            <span className="small muted">
              Page {page + 1} / {pages} · {rows.length} rows
            </span>
            <Btn kind="ghost" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Btn>
          </div>
        </div>
      </QueryState>

      <div className="card scroll-table">
        <div className="eyebrow">All links ({(links.data || []).length})</div>
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
            {(links.data || []).slice(0, 100).map((l) => (
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
      {bulk && id && (
        <BulkLinkModal
          projectId={id}
          artifacts={arts.data || []}
          onClose={() => setBulk(false)}
          onDone={() => qc.invalidateQueries()}
        />
      )}
    </div>
  );
}

function BulkLinkModal({
  projectId,
  artifacts,
  onClose,
  onDone,
}: {
  projectId: string;
  artifacts: { id: string; identifier: string; title: string; kind: string; viewpoint: string; owner: string; status: string; domain: string; project_id: string; parent_id: string | null; description: string; v_node_key: string; progress: number; extra: Record<string, unknown> }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [sources, setSources] = useState<string[]>([]);
  const [target, setTarget] = useState("");
  const [linkType, setLinkType] = useState("allocates");
  const mut = useMutation({
    mutationFn: () => api.bulkLinks(projectId, { source_ids: sources, target_id: target, link_type: linkType }),
    onSuccess: () => {
      onDone();
      onClose();
    },
  });
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          mut.mutate();
        }}
      >
        <div className="modal-head">
          <div>
            <div className="eyebrow">Scale</div>
            <h2 className="serif">Bulk link</h2>
          </div>
          <button type="button" className="btn ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body form-grid">
          <label className="field">
            <span>Sources</span>
            <MultiSearchableSelect options={artifacts as never} value={sources} onChange={setSources} />
          </label>
          <label className="field">
            <span>Link type</span>
            <select value={linkType} onChange={(e) => setLinkType(e.target.value)}>
              {["refines", "allocates", "implements", "verifies", "validates", "derives", "traces", "satisfies"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Target</span>
            <SearchableSelect options={artifacts as never} value={target} onChange={setTarget} allowEmpty={false} emptyLabel="— choose —" />
          </label>
          {mut.error && <p className="error">{(mut.error as Error).message}</p>}
        </div>
        <div className="modal-actions">
          <Btn kind="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn type="submit" disabled={mut.isPending || !sources.length || !target}>
            {mut.isPending ? "Linking…" : `Link ${sources.length}`}
          </Btn>
        </div>
      </form>
    </div>
  );
}
