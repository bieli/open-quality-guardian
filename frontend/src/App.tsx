import { NavLink, Outlet, useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { QualityRing } from "./components/Bits";

const links = [
  ["compose", "Compose & wizards"],
  ["", "Overview"],
  ["v-model", "Systems V-model"],
  ["rflp", "RFLP viewpoints"],
  ["diagrams", "Functional diagrams"],
  ["traceability", "Traceability"],
  ["artifacts", "CAD · BOM · KiCad"],
  ["tests", "V&V tests"],
  ["report", "Quality report"],
];

export default function App() {
  return <Outlet />;
}

export function ProjectShell() {
  const { id } = useParams();
  const project = useQuery({ queryKey: ["project", id], queryFn: () => api.project(id!), enabled: !!id });
  const quality = useQuery({ queryKey: ["quality", id], queryFn: () => api.quality(id!), enabled: !!id });

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
              Coverage {quality.data?.coverage ?? "–"}%
              <br />
              {quality.data?.open_gaps ?? 0} open gaps
            </div>
          </div>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
