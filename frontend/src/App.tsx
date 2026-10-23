import { NavLink, Outlet, useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { QualityRing } from "./components/Bits";
import { ConfigProvider, useProjectConfig } from "./ConfigContext";

const links = [
  ["compose", "Compose & wizards"],
  ["", "Overview"],
  ["v-model", "Systems V-model"],
  ["rflp", "RFLP viewpoints"],
  ["diagrams", "Functional diagrams"],
  ["traceability", "Traceability"],
  ["artifacts", "CAD · BOM · KiCad"],
  ["tests", "V&V tests"],
  ["configurations", "Configurations"],
  ["report", "Quality report"],
];

export default function App() {
  return <Outlet />;
}

export function ProjectShell() {
  const { id } = useParams();
  if (!id) return <Outlet />;
  return (
    <ConfigProvider projectId={id}>
      <ProjectShellInner />
    </ConfigProvider>
  );
}

function ProjectShellInner() {
  const { id } = useParams();
  const { activeConfigId, mode, configId, setMode, setConfigId, dictionary, activeConfig } = useProjectConfig();
  const project = useQuery({ queryKey: ["project", id], queryFn: () => api.project(id!), enabled: !!id });
  const quality = useQuery({
    queryKey: ["quality", id, activeConfigId],
    queryFn: () => api.quality(id!, activeConfigId),
    enabled: !!id,
  });
  const configs = dictionary?.configurations || [];

  return (
    <div className="shell">
      <aside className="side">
        <Link to="/" className="brand-mark">
          <span className="mark" />
          <div>
            <div className="eyebrow">Open Quality Guardian</div>
            <h2 className="project-name serif">{project.data?.name || "…"}</h2>
          </div>
        </Link>
        <nav>
          {links.map(([to, label]) => (
            <NavLink key={to} to={to ? `/projects/${id}/${to}` : `/projects/${id}`} end={!to}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div style={{ marginTop: "auto" }} className="card">
          <div className="eyebrow">Integrated quality</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
            <QualityRing value={quality.data?.score || 0} />
            <div className="small muted">
              {mode === "100" ? activeConfig?.name || "100%" : "150% all variants"}
              <br />
              Coverage {quality.data?.coverage ?? "–"}%
              <br />
              {quality.data?.open_gaps ?? 0} open gaps
            </div>
          </div>
        </div>
      </aside>
      <main className="main">
        <div className="config-bar">
          <div>
            <div className="eyebrow">Configuration context</div>
            <strong>{mode === "150" ? "150% product definition" : activeConfig?.name || "Select a SKU"}</strong>
          </div>
          <div className="btn-row">
            <div className="seg">
              <button type="button" className={mode === "150" ? "on" : ""} onClick={() => setMode("150")}>
                150%
              </button>
              <button type="button" className={mode === "100" ? "on" : ""} onClick={() => setMode("100")}>
                100%
              </button>
            </div>
            <select
              value={configId || ""}
              onChange={(e) => {
                setConfigId(e.target.value);
                setMode("100");
              }}
              disabled={!configs.length}
              style={{ minWidth: 200 }}
            >
              {!configs.length && <option value="">No SKUs yet</option>}
              {configs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Link to={`/projects/${id}/configurations`} className="btn ghost">
              Dictionary
            </Link>
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
