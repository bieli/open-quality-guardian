import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { QualityRing, StatusChip } from "../components/Bits";
import { ProjectWizard } from "../components/Wizards";
import { Btn } from "../components/ui";

export function Home() {
  const q = useQuery({ queryKey: ["projects"], queryFn: api.projects });
  const [wizard, setWizard] = useState(false);
  const nav = useNavigate();
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
        <div className="btn-row" style={{ marginTop: 18 }}>
          <Btn onClick={() => setWizard(true)}>Start a new product</Btn>
        </div>
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
        <button className="card" type="button" onClick={() => setWizard(true)} style={{ textAlign: "left" }}>
          <div className="eyebrow">Create</div>
          <h2>New complex product</h2>
          <p>Wizard: name the product, optionally seed the first feature → requirement → function, get a V-model.</p>
        </button>
      </div>
      {wizard && (
        <ProjectWizard
          onClose={() => setWizard(false)}
          onCreated={(id) => {
            setWizard(false);
            nav(`/projects/${id}/compose`);
          }}
        />
      )}
    </div>
  );
}
