import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { SchematicView } from "../components/SchematicView";
import { VacuumScene } from "../components/VacuumScene";
import { StatusChip } from "../components/Bits";
import { ArtifactEditor } from "../components/Wizards";
import { Btn, Field, Modal } from "../components/ui";
import { formatEffectivity, useProjectConfig } from "../ConfigContext";
import type { Artifact, BomItem } from "../types";

type Selection =
  | { kind: "artifact"; item: Artifact }
  | { kind: "bom"; item: BomItem }
  | null;

export function ArtifactsPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { activeConfigId } = useProjectConfig();
  const arts = useQuery({
    queryKey: ["arts", id, activeConfigId],
    queryFn: () => api.artifacts(id!, undefined, activeConfigId),
    enabled: !!id,
  });
  const bom = useQuery({
    queryKey: ["bom", id, activeConfigId],
    queryFn: () => api.bom(id!, activeConfigId),
    enabled: !!id,
  });
  const list = arts.data || [];
  const structure = useMemo(
    () =>
      list.filter((a) =>
        ["hw_component", "sw_component", "cad", "kicad_sch", "kicad_pcb", "electrical", "model_3d", "specification", "bom"].includes(
          a.kind,
        ),
      ),
    [list],
  );
  const [bomOpen, setBomOpen] = useState(false);
  const [designOpen, setDesignOpen] = useState(false);
  const [edit, setEdit] = useState<Artifact | null>(null);
  const [sel, setSel] = useState<Selection>(null);
  const delBom = useMutation({
    mutationFn: (bid: string) => api.deleteBom(id!, bid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bom", id] });
      setSel(null);
    },
  });

  const activeArtifact = sel?.kind === "artifact" ? sel.item : null;
  const fallback = structure.find((a) => a.kind === "model_3d") || structure[0] || null;
  const shown = activeArtifact || (sel ? null : fallback);

  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <div className="eyebrow">The product as built</div>
          <h1>CAD, BOM, KiCad & specification</h1>
          <p className="muted small">
            Structure on the left, inspector on the right — the same split 3DEXPERIENCE uses for a configured product.
            The tree follows the active configuration.
          </p>
        </div>
        <div className="btn-row">
          <Btn kind="ghost" onClick={() => setDesignOpen(true)}>
            Add CAD / KiCad / spec
          </Btn>
          <Btn onClick={() => setBomOpen(true)}>Add BOM line</Btn>
        </div>
      </div>
      <div className="architect">
        <div className="card architect-tree">
          <div className="eyebrow">Configured structure</div>
          <StructureTree items={structure} parent={null} onSelect={(item) => setSel({ kind: "artifact", item })} selectedId={shown?.id} />
          <div className="eyebrow" style={{ marginTop: 18 }}>
            Bill of materials
          </div>
          {(bom.data || []).map((row) => (
            <button
              key={row.id}
              type="button"
              className={`tree-item ${sel?.kind === "bom" && sel.item.id === row.id ? "on" : ""}`}
              onClick={() => setSel({ kind: "bom", item: row })}
            >
              <div className="id">{row.part_number}</div>
              <strong>{row.name}</strong>
              <div className="small muted">
                {row.qty} {row.unit} · {formatEffectivity(row.effectivity)}
              </div>
            </button>
          ))}
        </div>
        <div className="card architect-inspector">
          {sel?.kind === "bom" ? (
            <BomInspector row={sel.item} onRemove={() => delBom.mutate(sel.item.id)} />
          ) : shown ? (
            <ArtifactInspector artifact={shown} all={list} onEdit={setEdit} />
          ) : (
            <p className="muted small">Select a structure node or BOM line.</p>
          )}
        </div>
      </div>
      {bomOpen && id && <BomModal projectId={id} onClose={() => setBomOpen(false)} />}
      {designOpen && id && <DesignModal projectId={id} onClose={() => setDesignOpen(false)} />}
      {edit && id && <ArtifactEditor projectId={id} artifact={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function StructureTree({
  items,
  parent,
  onSelect,
  selectedId,
}: {
  items: Artifact[];
  parent: string | null;
  onSelect: (a: Artifact) => void;
  selectedId?: string;
}) {
  const rows = items.filter((i) => i.parent_id === parent);
  const roots = parent === null ? items.filter((i) => !items.some((p) => p.id === i.parent_id)) : rows;
  const list = parent === null ? roots : rows;
  if (!list.length && parent === null) {
    return <div className="muted small">Nothing in this configuration yet.</div>;
  }
  return (
    <>
      {list.map((row) => (
        <div key={row.id}>
          <button type="button" className={`tree-item ${selectedId === row.id ? "on" : ""}`} onClick={() => onSelect(row)}>
            <div className="id">{row.identifier}</div>
            <strong>{row.title}</strong>
            <div className="small muted" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
              <StatusChip status={row.status} /> {formatEffectivity(row.effectivity)}
            </div>
          </button>
          <div style={{ marginLeft: 14 }}>
            <StructureTree items={items} parent={row.id} onSelect={onSelect} selectedId={selectedId} />
          </div>
        </div>
      ))}
    </>
  );
}

function ArtifactInspector({
  artifact,
  all,
  onEdit,
}: {
  artifact: Artifact;
  all: Artifact[];
  onEdit: (a: Artifact) => void;
}) {
  const sch = artifact.kind === "kicad_sch" ? artifact : all.find((a) => a.kind === "kicad_sch");
  const pcb = artifact.kind === "kicad_pcb" ? artifact : all.find((a) => a.kind === "kicad_pcb");
  const cad = artifact.kind === "cad" ? artifact : all.find((a) => a.kind === "cad");
  const spec = artifact.kind === "specification" ? artifact : null;
  const show3d = artifact.kind === "model_3d" || artifact.kind === "cad";
  return (
    <div className="stack">
      <div className="topbar" style={{ marginBottom: 0 }}>
        <div>
          <div className="eyebrow">{artifact.kind.replaceAll("_", " ")}</div>
          <h2 className="serif" style={{ margin: "6px 0" }}>
            {artifact.title}
          </h2>
          <p className="small muted">{artifact.description || formatEffectivity(artifact.effectivity)}</p>
        </div>
        <Btn kind="ghost" onClick={() => onEdit(artifact)}>
          Edit
        </Btn>
      </div>
      {show3d && <VacuumScene />}
      {spec && (
        <table>
          <tbody>
            {Object.entries((spec.extra as Record<string, string | number>) || {}).map(([k, v]) => (
              <tr key={k}>
                <td className="mono">{k}</td>
                <td>{String(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {cad && artifact.kind === "cad" && (
        <p className="small">
          CAD {cad.identifier}: {(cad.extra as { format?: string }).format} · mass {(cad.extra as { mass_g?: number }).mass_g} g · ⌀{" "}
          {(cad.extra as { diameter_mm?: number }).diameter_mm} mm
        </p>
      )}
      {artifact.kind === "kicad_sch" && sch && <SchematicView artifact={sch} />}
      {artifact.kind === "kicad_pcb" && pcb && (
        <div className="schematic" style={{ minHeight: 220 }}>
          <div>LAYERS {(pcb.extra as { layers?: string[] })?.layers?.join(" · ")}</div>
          <div>BOARD {(pcb.extra as { size_mm?: number[] })?.size_mm?.join(" × ")} mm</div>
          <div>DRC errors {(pcb.extra as { drc_errors?: number })?.drc_errors ?? "–"}</div>
        </div>
      )}
      {artifact.kind === "hw_component" || artifact.kind === "sw_component" ? (
        <p className="small">
          <StatusChip status={artifact.status} /> {artifact.owner || "unassigned"} · {artifact.progress}% ·{" "}
          {formatEffectivity(artifact.effectivity)}
        </p>
      ) : null}
    </div>
  );
}

function BomInspector({ row, onRemove }: { row: BomItem; onRemove: () => void }) {
  return (
    <div>
      <div className="eyebrow">BOM line</div>
      <h2 className="serif" style={{ marginTop: 8 }}>
        {row.name}
      </h2>
      <table>
        <tbody>
          <tr>
            <td>MPN</td>
            <td className="mono">{row.part_number}</td>
          </tr>
          <tr>
            <td>Qty</td>
            <td>
              {row.qty} {row.unit}
            </td>
          </tr>
          <tr>
            <td>Category</td>
            <td>{row.category}</td>
          </tr>
          <tr>
            <td>Supplier</td>
            <td>{row.supplier}</td>
          </tr>
          <tr>
            <td>Effectivity</td>
            <td>{formatEffectivity(row.effectivity)}</td>
          </tr>
        </tbody>
      </table>
      <div style={{ marginTop: 12 }}>
        <Btn kind="ghost" onClick={onRemove}>
          Remove
        </Btn>
      </div>
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
        extra:
          form.kind === "kicad_sch"
            ? { components: [], nets: [] }
            : form.kind === "kicad_pcb"
              ? { layers: ["F.Cu", "B.Cu"], size_mm: [100, 80], drc_errors: 0 }
              : form.kind === "cad"
                ? { format: "STEP" }
                : {},
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
