import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { SchematicView } from "../components/SchematicView";
import { VacuumScene } from "../components/VacuumScene";
import { StatusChip } from "../components/Bits";
import { ArtifactEditor } from "../components/Wizards";
import { Btn, Field, Modal } from "../components/ui";
import type { Artifact } from "../types";

export function ArtifactsPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const arts = useQuery({ queryKey: ["arts", id], queryFn: () => api.artifacts(id!), enabled: !!id });
  const bom = useQuery({ queryKey: ["bom", id], queryFn: () => api.bom(id!), enabled: !!id });
  const list = arts.data || [];
  const sch = list.find((a) => a.kind === "kicad_sch");
  const pcb = list.find((a) => a.kind === "kicad_pcb");
  const cad = list.find((a) => a.kind === "cad");
  const spec = list.find((a) => a.kind === "specification" && a.domain === "product");
  const [bomOpen, setBomOpen] = useState(false);
  const [designOpen, setDesignOpen] = useState(false);
  const [edit, setEdit] = useState<Artifact | null>(null);
  const delBom = useMutation({
    mutationFn: (bid: string) => api.deleteBom(id!, bid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bom", id] }),
  });

  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <div className="eyebrow">The product as built</div>
          <h1>CAD, BOM, KiCad & specification</h1>
          <p className="muted small">Quality is not only requirements coverage. Housing fits, schematic-to-BOM consistency and electrical design live on the same thread.</p>
        </div>
        <div className="btn-row">
          <Btn kind="ghost" onClick={() => setDesignOpen(true)}>
            Add CAD / KiCad / spec
          </Btn>
          <Btn onClick={() => setBomOpen(true)}>Add BOM line</Btn>
        </div>
      </div>
      <div className="two">
        <div className="card">
          <div className="eyebrow">3D product visualization</div>
          <VacuumScene />
        </div>
        <div className="card" onClick={() => spec && setEdit(spec)} style={{ cursor: spec ? "pointer" : "default" }}>
          <div className="eyebrow">Specification</div>
          <h2 className="serif" style={{ marginTop: 8 }}>{spec?.title || "Product spec"}</h2>
          <p className="small muted">{spec?.description || "Add a specification to capture runtime, noise, coverage and safety limits."}</p>
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
          <p className="small muted">{pcb?.title || "No PCB captured yet."}</p>
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
              <th></th>
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
                <td>
                  <Btn kind="ghost" onClick={() => delBom.mutate(row.id)}>
                    Remove
                  </Btn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {bomOpen && id && <BomModal projectId={id} onClose={() => setBomOpen(false)} />}
      {designOpen && id && <DesignModal projectId={id} onClose={() => setDesignOpen(false)} />}
      {edit && id && <ArtifactEditor projectId={id} artifact={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function BomModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ part_number: "", name: "", qty: 1, unit: "ea", category: "electrical", supplier: "" });
  const mut = useMutation({
    mutationFn: () => api.createBom(projectId, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bom", projectId] });
      onClose();
    },
  });
  return (
    <Modal title="BOM line" onClose={onClose} onSubmit={() => mut.mutate()} busy={mut.isPending} submitLabel="Add part">
      <div className="form-grid">
        <Field label="MPN">
          <input required className="mono" value={form.part_number} onChange={(e) => setForm({ ...form, part_number: e.target.value })} />
        </Field>
        <Field label="Name">
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Qty">
          <input type="number" min={0} step={1} value={form.qty} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} />
        </Field>
        <Field label="Category">
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option>electrical</option>
            <option>mechanical</option>
            <option>software</option>
            <option>consumable</option>
          </select>
        </Field>
        <Field label="Supplier">
          <input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
        </Field>
        {mut.error && <p className="error">{(mut.error as Error).message}</p>}
      </div>
    </Modal>
  );
}

function DesignModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    identifier: "",
    title: "",
    kind: "specification",
    domain: "product",
    v_node_key: "system_req",
    description: "",
  });
  const mut = useMutation({
    mutationFn: () =>
      api.createArtifact(projectId, {
        ...form,
        viewpoint: "A",
        status: "draft",
        progress: 20,
        extra: form.kind === "kicad_sch" ? { components: [], nets: [] } : form.kind === "kicad_pcb" ? { layers: ["F.Cu", "B.Cu"], size_mm: [100, 80], drc_errors: 0 } : form.kind === "cad" ? { format: "STEP" } : {},
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["arts", projectId] });
      onClose();
    },
  });
  return (
    <Modal title="Design artifact" onClose={onClose} onSubmit={() => mut.mutate()} busy={mut.isPending} submitLabel="Add artifact">
      <div className="form-grid">
        <Field label="Kind">
          <select
            value={form.kind}
            onChange={(e) => {
              const kind = e.target.value;
              setForm({
                ...form,
                kind,
                domain: kind === "specification" ? "product" : kind === "cad" ? "mechanical" : "electrical",
                v_node_key: kind === "specification" ? "system_req" : "hw_detailed_design",
              });
            }}
          >
            <option value="specification">Product specification</option>
            <option value="cad">CAD assembly</option>
            <option value="kicad_sch">KiCad schematic</option>
            <option value="kicad_pcb">KiCad PCB</option>
            <option value="electrical">Electrical design</option>
          </select>
        </Field>
        <Field label="ID">
          <input required className="mono" value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} />
        </Field>
        <Field label="Title">
          <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <Field label="Description">
          <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        {mut.error && <p className="error">{(mut.error as Error).message}</p>}
      </div>
    </Modal>
  );
}
