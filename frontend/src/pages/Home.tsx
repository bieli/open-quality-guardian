import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api";
import { QualityRing, StatusChip } from "../components/Bits";

export function Home() {
  const q = useQuery({ queryKey: ["projects"], queryFn: api.projects });
  return (
    <div className="app-home">
      <div className="brand-mark">
        <span className="mark" />
        <div>
          <div className="eyebrow">Open source · systems quality</div>
          <strong>Open Quality Guardian</strong>
        </div>
      </div>
      <section className="hero" style={{ marginTop: 36 }}>
        <div className="eyebrow">Plan · validate · verify</div>
        <h1>Quality of a complex product, kept as one thread.</h1>
        <p>
          Track requirements, functions, logical and physical design, CAD, BOMs, KiCad and tests
          on a multi-V model that program managers can actually read — without losing the details
          engineers cannot afford to forget.
        </p>
      </section>
      <div className="grid-cards">
        {(q.data || []).map((p) => (
          <Link key={p.id} to={`/projects/${p.id}`} className="card">
            <div className="eyebrow">{p.product_type}</div>
            <h2>{p.name}</h2>
            <p>{p.description}</p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <StatusChip status={p.quality && p.quality.open_gaps ? "gap" : "verified"} />
              <QualityRing value={p.quality?.score || 0} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
