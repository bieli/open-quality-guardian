import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { useProjectConfig } from "../ConfigContext";

export function GlobalSearch({ projectId }: { projectId: string }) {
  const nav = useNavigate();
  const { activeConfigId } = useProjectConfig();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const debounced = useDebounced(q, 200);
  const results = useQuery({
    queryKey: ["search", projectId, debounced, activeConfigId],
    queryFn: () => api.search(projectId, debounced, activeConfigId),
    enabled: !!projectId && debounced.trim().length >= 2,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
        document.getElementById("global-search-input")?.focus();
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const goArtifact = (viewpoint: string) => {
    const map: Record<string, string> = {
      R: "rflp",
      F: "diagrams",
      L: "rflp",
      P: "artifacts",
      T: "tests",
      A: "artifacts",
    };
    nav(`/projects/${projectId}/${map[viewpoint] || "rflp"}`);
    setOpen(false);
    setQ("");
  };

  return (
    <div className={`global-search ${open || q ? "open" : ""}`}>
      <input
        id="global-search-input"
        placeholder="Search thread… (Ctrl/⌘ K)"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && debounced.trim().length >= 2 && (
        <div className="global-search-panel">
          {results.isFetching && <div className="small muted">Searching…</div>}
          {results.error && <div className="error small">{(results.error as Error).message}</div>}
          {(results.data?.artifacts || []).map((a) => (
            <button key={a.id} type="button" className="ss-option" onClick={() => goArtifact(a.viewpoint)}>
              <span className="mono">{a.identifier}</span>
              <span>{a.title}</span>
              <span className="small muted">{a.kind} · {a.viewpoint}</span>
            </button>
          ))}
          {(results.data?.bom || []).map((b) => (
            <button key={b.id} type="button" className="ss-option" onClick={() => nav(`/projects/${projectId}/artifacts`)}>
              <span className="mono">{b.part_number}</span>
              <span>{b.name}</span>
              <span className="small muted">BOM</span>
            </button>
          ))}
          {(results.data?.findings || []).map((f) => (
            <button key={f.id} type="button" className="ss-option" onClick={() => nav(`/projects/${projectId}/report`)}>
              <span className={`chip ${f.severity}`}>{f.severity}</span>
              <span>{f.title}</span>
            </button>
          ))}
          {results.data &&
            !results.data.artifacts.length &&
            !results.data.bom.length &&
            !results.data.findings.length && <div className="small muted">No matches</div>}
        </div>
      )}
    </div>
  );
}

function useDebounced(value: string, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
