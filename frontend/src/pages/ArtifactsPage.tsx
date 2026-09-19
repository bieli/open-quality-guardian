import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { SchematicView } from "../components/SchematicView";
import { VacuumScene } from "../components/VacuumScene";
import { StatusChip } from "../components/Bits";

export function ArtifactsPage() {
  const { id } = useParams();
  const arts = useQuery({ queryKey: ["arts", id], queryFn: () => api.artifacts(id!), enabled: !!id });
  const bom = useQuery({ queryKey: ["bom", id], queryFn: () => api.bom(id!), enabled: !!id });
  const list = arts.data || [];
  const sch = list.find((a) => a.kind === "kicad_sch");
  const pcb = list.find((a) => a.kind === "kicad_pcb");
  const cad = list.find((a) => a.kind === "cad");
  const spec = list.find((a) => a.kind === "specification" && a.domain === "product");

  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <div className="eyebrow">The product as built</div>
          <h1>CAD, BOM, KiCad & specification</h1>
          <p className="muted small">Quality is not only requirements coverage. Housing fits, schematic-to-BOM consistency and electrical design live on the same thread.</p>
        </div>
      </div>
      <div className="two">
        <div className="card">
          <div className="eyebrow">3D product visualization</div>
          <VacuumScene />
        </div>
        <div className="card">
          <div className="eyebrow">Specification</div>
          <h2 className="serif" style={{ marginTop: 8 }}>{spec?.title || "Product spec"}</h2>
          <p className="small muted">{spec?.description}</p>
          <table>
            <tbody>
              {Object.entries((spec?.extra as Record<string, string | number>) || {}).map(([k, v]) => (
                <tr key={k}>
                  <td className="mono">{k}</td>
                  <td>{String(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {cad && (
            <p className="small" style={{ marginTop: 12 }}>
              CAD {cad.identifier}: {(cad.extra as { format?: string; mass_g?: number; diameter_mm?: number }).format} ·
              mass {(cad.extra as { mass_g?: number }).mass_g} g · ⌀ {(cad.extra as { diameter_mm?: number }).diameter_mm} mm
              <br />
              <StatusChip status={cad.status} />
            </p>
          )}
        </div>
      </div>
      <div className="two">
        <div className="card">
          <div className="eyebrow">KiCad schematic</div>
          <SchematicView artifact={sch} />
        </div>
        <div className="card">
          <div className="eyebrow">KiCad PCB</div>
          <p className="small muted">{pcb?.title}</p>
          <div className="schematic" style={{ minHeight: 220 }}>
            <div>LAYERS {(pcb?.extra as { layers?: string[] })?.layers?.join(" · ")}</div>
            <div>BOARD {(pcb?.extra as { size_mm?: number[] })?.size_mm?.join(" × ")} mm</div>
            <div>DRC errors {(pcb?.extra as { drc_errors?: number })?.drc_errors ?? "–"}</div>
            <svg viewBox="0 0 200 120" width="100%" height="140">
              <rect x="10" y="20" width="180" height="80" fill="none" stroke="#c6f3b0" />
              <circle cx="24" cy="34" r="4" fill="#c6f3b0" />
              <circle cx="176" cy="34" r="4" fill="#c6f3b0" />
              <circle cx="24" cy="86" r="4" fill="#c6f3b0" />
              <circle cx="176" cy="86" r="4" fill="#c6f3b0" />
              <rect x="70" y="42" width="60" height="36" fill="none" stroke="#e8c547" />
            </svg>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="eyebrow">Bill of materials</div>
        <table>
          <thead>
            <tr>
              <th>MPN</th>
              <th>Name</th>
              <th>Qty</th>
              <th>Category</th>
              <th>Supplier</th>
            </tr>
          </thead>
          <tbody>
            {(bom.data || []).map((row) => (
              <tr key={row.id}>
                <td className="mono">{row.part_number}</td>
                <td>{row.name}</td>
                <td>{row.qty} {row.unit}</td>
                <td>{row.category}</td>
                <td>{row.supplier}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
