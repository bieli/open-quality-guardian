import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { Artifact } from "../types";
import { Btn, DOMAINS, Field, LINK_TYPES, Modal, STATUSES, V_NODES } from "./ui";
import { useProjectConfig } from "../ConfigContext";

function useRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

function optionLabel(a: Artifact) {
  return `${a.identifier} — ${a.title}`;
}

export function ProjectWizard({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: "",
    product_type: "Cyber-physical product",
    description: "",
    owner: "",
    first_feature: "",
    first_requirement: "",
    first_function: "",
  });
  const mut = useMutation({
    mutationFn: () => api.wizardProject(form),
    onSuccess: (p) => onCreated(p.id),
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Modal
      title="New complex product"
      step={step}
      steps={["Product", "First thread", "Create"]}
      onClose={onClose}
      submitLabel={step < 2 ? "Continue" : "Create project"}
      busy={mut.isPending}
      onSubmit={() => {
        if (step < 2) setStep(step + 1);
        else mut.mutate();
      }}
    >
      {step === 0 && (
        <div className="form-grid">
          <Field label="Product name">
            <input required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="AuroraVac, Line C charger…" />
          </Field>
          <Field label="Product type">
            <input value={form.product_type} onChange={(e) => set("product_type", e.target.value)} />
          </Field>
          <Field label="Owner / program manager">
            <input value={form.owner} onChange={(e) => set("owner", e.target.value)} />
          </Field>
          <Field label="What is this product, in one paragraph?">
            <textarea rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
        </div>
      )}
      {step === 1 && (
        <div className="form-grid">
          <p className="small muted">Optional, but this seeds the V-model with a first R → F thread you can verify later.</p>
          <Field label="First customer feature">
            <input value={form.first_feature} onChange={(e) => set("first_feature", e.target.value)} placeholder="Avoid collisions with people and furniture" />
          </Field>
          <Field label="First system requirement">
            <input value={form.first_requirement} onChange={(e) => set("first_requirement", e.target.value)} placeholder="Detect obstacles and stop or replan before contact" />
          </Field>
          <Field label="First function">
            <input value={form.first_function} onChange={(e) => set("first_function", e.target.value)} placeholder="Collision avoidance" />
          </Field>
        </div>
      )}
      {step === 2 && (
        <div className="small">
          <p>
            A full multi-V model will be created for <strong>{form.name || "this product"}</strong>. You can then add RFLP
            elements and record verification against each V-station.
          </p>
          {mut.error && <p className="error">{(mut.error as Error).message}</p>}
        </div>
      )}
    </Modal>
  );
}

export function RequirementWizard({ projectId, onClose, parentId, refinesFrom, vNodeKey }: { projectId: string; onClose: () => void; parentId?: string; refinesFrom?: string; vNodeKey?: string }) {
  const refresh = useRefresh();
  const arts = useQuery({ queryKey: ["arts", projectId], queryFn: () => api.artifacts(projectId) });
  const features = (arts.data || []).filter((a) => a.kind === "customer_feature" || a.kind === "stakeholder_need" || a.kind === "requirement");
  const [form, setForm] = useState({
    identifier: "",
    title: "",
    description: "",
    kind: "requirement",
    domain: "system",
    owner: "",
    v_node_key: vNodeKey || "system_req",
    parent_id: parentId || "",
    refines_from_id: refinesFrom || "",
    status: "draft",
  });
  const mut = useMutation({
    mutationFn: () =>
      api.wizardRequirement(projectId, {
        ...form,
        parent_id: form.parent_id || null,
        refines_from_id: form.refines_from_id || null,
      }),
    onSuccess: () => {
      refresh();
      onClose();
    },
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Modal title="Requirement wizard" onClose={onClose} onSubmit={() => mut.mutate()} busy={mut.isPending} submitLabel="Add requirement">
      <div className="form-grid">
        <Field label="ID">
          <input required className="mono" value={form.identifier} onChange={(e) => set("identifier", e.target.value)} placeholder="1.2.3 or CF-5" />
        </Field>
        <Field label="Title">
          <input required value={form.title} onChange={(e) => set("title", e.target.value)} />
        </Field>
        <Field label="Kind">
          <select value={form.kind} onChange={(e) => set("kind", e.target.value)}>
            <option value="customer_feature">Customer feature</option>
            <option value="stakeholder_need">Stakeholder need</option>
            <option value="requirement">Requirement</option>
          </select>
        </Field>
        <Field label="Domain">
          <select value={form.domain} onChange={(e) => set("domain", e.target.value)}>
            {DOMAINS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </Field>
        <Field label="V-model station">
          <select value={form.v_node_key} onChange={(e) => set("v_node_key", e.target.value)}>
            {V_NODES.map(([k, n]) => (
              <option key={k} value={k}>
                {n}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Owner">
          <input value={form.owner} onChange={(e) => set("owner", e.target.value)} />
        </Field>
        <Field label="Parent (optional)">
          <select value={form.parent_id} onChange={(e) => set("parent_id", e.target.value)}>
            <option value="">— none —</option>
            {features.map((a) => (
              <option key={a.id} value={a.id}>
                {optionLabel(a)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Refines / derives from">
          <select value={form.refines_from_id} onChange={(e) => set("refines_from_id", e.target.value)}>
            <option value="">— none yet —</option>
            {features.map((a) => (
              <option key={a.id} value={a.id}>
                {optionLabel(a)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Description / acceptance intent">
          <textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        {mut.error && <p className="error">{(mut.error as Error).message}</p>}
      </div>
    </Modal>
  );
}

export function FunctionWizard({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const refresh = useRefresh();
  const arts = useQuery({ queryKey: ["arts", projectId], queryFn: () => api.artifacts(projectId) });
  const reqs = (arts.data || []).filter((a) => a.viewpoint === "R");
  const [form, setForm] = useState({
    identifier: "",
    title: "",
    description: "",
    owner: "",
    lanes: "Sense, Decide, Act",
    with_diagram: true,
    allocate_from_ids: [] as string[],
  });
  const mut = useMutation({
    mutationFn: () =>
      api.wizardFunction(projectId, {
        ...form,
        lanes: form.lanes.split(",").map((s) => s.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      refresh();
      onClose();
    },
  });
  return (
    <Modal title="Function wizard" onClose={onClose} onSubmit={() => mut.mutate()} busy={mut.isPending} submitLabel="Add function">
      <div className="form-grid">
        <Field label="ID">
          <input required className="mono" value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} placeholder="F-NAV" />
        </Field>
        <Field label="Function name">
          <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <Field label="Owner">
          <input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
        </Field>
        <Field label="Allocate from requirements (Ctrl/Cmd+click for many)">
          <select
            multiple
            size={6}
            value={form.allocate_from_ids}
            onChange={(e) => setForm({ ...form, allocate_from_ids: [...e.target.selectedOptions].map((o) => o.value) })}
          >
            {reqs.map((a) => (
              <option key={a.id} value={a.id}>
                {optionLabel(a)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Swimlanes (comma separated)">
          <input value={form.lanes} onChange={(e) => setForm({ ...form, lanes: e.target.value })} />
        </Field>
        <label className="field-check">
          <input type="checkbox" checked={form.with_diagram} onChange={(e) => setForm({ ...form, with_diagram: e.target.checked })} />
          Create a functional diagram for this feature
        </label>
        <Field label="Behaviour in plain language">
          <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        {mut.error && <p className="error">{(mut.error as Error).message}</p>}
      </div>
    </Modal>
  );
}

export function LogicalWizard({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const refresh = useRefresh();
  const arts = useQuery({ queryKey: ["arts", projectId], queryFn: () => api.artifacts(projectId) });
  const fns = (arts.data || []).filter((a) => a.viewpoint === "F");
  const [form, setForm] = useState({
    identifier: "",
    title: "",
    description: "",
    owner: "",
    allocate_from_ids: [] as string[],
  });
  const mut = useMutation({
    mutationFn: () => api.wizardLogical(projectId, form),
    onSuccess: () => {
      refresh();
      onClose();
    },
  });
  return (
    <Modal title="Logical architecture wizard" onClose={onClose} onSubmit={() => mut.mutate()} busy={mut.isPending} submitLabel="Add logical block">
      <div className="form-grid">
        <Field label="ID">
          <input required className="mono" value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} placeholder="L-SENSE-1" />
        </Field>
        <Field label="Logical block (sense / function / actuation)">
          <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <Field label="Owner">
          <input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
        </Field>
        <Field label="Allocated from functions">
          <select
            multiple
            size={6}
            value={form.allocate_from_ids}
            onChange={(e) => setForm({ ...form, allocate_from_ids: [...e.target.selectedOptions].map((o) => o.value) })}
          >
            {fns.map((a) => (
              <option key={a.id} value={a.id}>
                {optionLabel(a)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Description">
          <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        {mut.error && <p className="error">{(mut.error as Error).message}</p>}
      </div>
    </Modal>
  );
}

export function PhysicalWizard({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const refresh = useRefresh();
  const arts = useQuery({ queryKey: ["arts", projectId], queryFn: () => api.artifacts(projectId) });
  const logical = (arts.data || []).filter((a) => a.viewpoint === "L");
  const [form, setForm] = useState({
    identifier: "",
    title: "",
    description: "",
    owner: "",
    kind: "sw_component",
    domain: "software",
    v_node_key: "sw_architecture",
    implement_from_ids: [] as string[],
  });
  const mut = useMutation({
    mutationFn: () => api.wizardPhysical(projectId, form),
    onSuccess: () => {
      refresh();
      onClose();
    },
  });
  return (
    <Modal title="Physical architecture wizard" onClose={onClose} onSubmit={() => mut.mutate()} busy={mut.isPending} submitLabel="Add component">
      <div className="form-grid">
        <Field label="ID">
          <input required className="mono" value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} placeholder="SWC-6 or HW-SENS-2" />
        </Field>
        <Field label="Component name">
          <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <Field label="Kind">
          <select
            value={form.kind}
            onChange={(e) => {
              const kind = e.target.value;
              const domain = kind === "hw_component" ? "hardware" : "software";
              setForm({
                ...form,
                kind,
                domain,
                v_node_key: domain === "software" ? "sw_architecture" : "hw_architecture",
              });
            }}
          >
            <option value="sw_component">Software component</option>
            <option value="hw_component">Hardware component</option>
          </select>
        </Field>
        <Field label="V-model station">
          <select value={form.v_node_key} onChange={(e) => setForm({ ...form, v_node_key: e.target.value })}>
            {V_NODES.filter(([k]) => k.startsWith("sw_") || k.startsWith("hw_")).map(([k, n]) => (
              <option key={k} value={k}>
                {n}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Implements logical blocks">
          <select
            multiple
            size={6}
            value={form.implement_from_ids}
            onChange={(e) => setForm({ ...form, implement_from_ids: [...e.target.selectedOptions].map((o) => o.value) })}
          >
            {logical.map((a) => (
              <option key={a.id} value={a.id}>
                {optionLabel(a)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Owner">
          <input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
        </Field>
        <Field label="Description">
          <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        {mut.error && <p className="error">{(mut.error as Error).message}</p>}
      </div>
    </Modal>
  );
}

export function VerificationWizard({
  projectId,
  onClose,
  vNodeKey,
}: {
  projectId: string;
  onClose: () => void;
  vNodeKey?: string;
}) {
  const refresh = useRefresh();
  const arts = useQuery({ queryKey: ["arts", projectId], queryFn: () => api.artifacts(projectId) });
  const targets = (arts.data || []).filter((a) => a.viewpoint !== "T");
  const [form, setForm] = useState({
    identifier: "",
    title: "",
    description: "",
    owner: "",
    kind: "test_case",
    v_node_key: vNodeKey || "system_verification",
    verifies_id: "",
    validates_id: "",
    verdict: "draft",
    subjects: "",
  });
  const mut = useMutation({
    mutationFn: () =>
      api.wizardVerification(projectId, {
        ...form,
        verifies_id: form.verifies_id || null,
        validates_id: form.validates_id || null,
        subjects: form.subjects.split(",").map((s) => s.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      refresh();
      onClose();
    },
  });
  return (
    <Modal title="Verification & validation wizard" onClose={onClose} onSubmit={() => mut.mutate()} busy={mut.isPending} submitLabel="Record evidence">
      <div className="form-grid">
        <p className="small muted">Attach a test to a V-model station and to the requirement or feature it proves.</p>
        <Field label="Test ID">
          <input required className="mono" value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} placeholder="SYS-V-12" />
        </Field>
        <Field label="Name">
          <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <Field label="V-model station (right side of the V)">
          <select value={form.v_node_key} onChange={(e) => setForm({ ...form, v_node_key: e.target.value })}>
            {V_NODES.map(([k, n]) => (
              <option key={k} value={k}>
                {n}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Verifies (requirement / design)">
          <select value={form.verifies_id} onChange={(e) => setForm({ ...form, verifies_id: e.target.value })}>
            <option value="">— choose —</option>
            {targets.map((a) => (
              <option key={a.id} value={a.id}>
                {optionLabel(a)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Validates (customer feature / need)">
          <select value={form.validates_id} onChange={(e) => setForm({ ...form, validates_id: e.target.value })}>
            <option value="">— optional —</option>
            {targets.filter((a) => a.kind === "customer_feature" || a.kind === "stakeholder_need").map((a) => (
              <option key={a.id} value={a.id}>
                {optionLabel(a)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Verdict">
          <select value={form.verdict} onChange={(e) => setForm({ ...form, verdict: e.target.value })}>
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Responsible">
          <input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
        </Field>
        <Field label="Subjects to verify (comma separated)">
          <input value={form.subjects} onChange={(e) => setForm({ ...form, subjects: e.target.value })} />
        </Field>
        <Field label="Notes / preconditions">
          <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        {mut.error && <p className="error">{(mut.error as Error).message}</p>}
      </div>
    </Modal>
  );
}

export function ArtifactEditor({
  projectId,
  artifact,
  onClose,
}: {
  projectId: string;
  artifact: Artifact;
  onClose: () => void;
}) {
  const refresh = useRefresh();
  const arts = useQuery({ queryKey: ["arts", projectId, "150"], queryFn: () => api.artifacts(projectId) });
  const { dictionary } = useProjectConfig();
  const [form, setForm] = useState({ ...artifact, parent_id: artifact.parent_id || "" });
  const [eff, setEff] = useState<Record<string, string[]>>(artifact.effectivity || {});
  const save = useMutation({
    mutationFn: () =>
      api.updateArtifact(projectId, artifact.id, {
        identifier: form.identifier,
        title: form.title,
        description: form.description,
        viewpoint: form.viewpoint,
        domain: form.domain,
        kind: form.kind,
        status: form.status,
        owner: form.owner,
        v_node_key: form.v_node_key,
        progress: Number(form.progress),
        parent_id: form.parent_id || null,
        effectivity: Object.fromEntries(Object.entries(eff).filter(([, v]) => v.length)),
      }),
    onSuccess: () => {
      refresh();
      onClose();
    },
  });
  const remove = useMutation({
    mutationFn: () => api.deleteArtifact(projectId, artifact.id),
    onSuccess: () => {
      refresh();
      onClose();
    },
  });
  return (
    <Modal
      title={`Edit ${artifact.identifier}`}
      onClose={onClose}
      onSubmit={() => save.mutate()}
      busy={save.isPending}
      submitLabel="Save changes"
    >
      <div className="form-grid">
        <Field label="ID">
          <input className="mono" value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} />
        </Field>
        <Field label="Title">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <Field label="Status">
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Progress %">
          <input type="number" min={0} max={100} value={form.progress} onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })} />
        </Field>
        <Field label="Owner">
          <input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
        </Field>
        <Field label="V-model station">
          <select value={form.v_node_key} onChange={(e) => setForm({ ...form, v_node_key: e.target.value })}>
            <option value="">— none —</option>
            {V_NODES.map(([k, n]) => (
              <option key={k} value={k}>
                {n}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Parent">
          <select value={form.parent_id || ""} onChange={(e) => setForm({ ...form, parent_id: e.target.value })}>
            <option value="">— none —</option>
            {(arts.data || [])
              .filter((a) => a.id !== artifact.id)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {optionLabel(a)}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Description">
          <textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        {(dictionary?.variants || []).length > 0 && (
          <div>
            <div className="eyebrow">Effectivity</div>
            <p className="small muted">Leave unchecked for common (always included).</p>
            {(dictionary?.variants || []).map((v) => (
              <div key={v.id} className="eff-checks" style={{ marginTop: 8 }}>
                <strong className="small">{v.name}</strong>
                {v.values.map((val) => {
                  const selected = eff[v.key] || [];
                  const on = selected.includes(val.key);
                  return (
                    <label key={val.id} className="field-check">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() =>
                          setEff({
                            ...eff,
                            [v.key]: on ? selected.filter((k) => k !== val.key) : [...selected, val.key],
                          })
                        }
                      />
                      {val.name}
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
        )}
        {save.error && <p className="error">{(save.error as Error).message}</p>}
        <div>
          <Btn kind="danger" onClick={() => remove.mutate()}>
            Delete this element
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

export function LinkWizard({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const refresh = useRefresh();
  const arts = useQuery({ queryKey: ["arts", projectId], queryFn: () => api.artifacts(projectId) });
  const [form, setForm] = useState({ source_id: "", target_id: "", link_type: "allocates" });
  const mut = useMutation({
    mutationFn: () => api.createLink(projectId, form),
    onSuccess: () => {
      refresh();
      onClose();
    },
  });
  return (
    <Modal title="Add traceability link" onClose={onClose} onSubmit={() => mut.mutate()} busy={mut.isPending} submitLabel="Link">
      <div className="form-grid">
        <Field label="From">
          <select required value={form.source_id} onChange={(e) => setForm({ ...form, source_id: e.target.value })}>
            <option value="">—</option>
            {(arts.data || []).map((a) => (
              <option key={a.id} value={a.id}>
                {optionLabel(a)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Type">
          <select value={form.link_type} onChange={(e) => setForm({ ...form, link_type: e.target.value })}>
            {LINK_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="To">
          <select required value={form.target_id} onChange={(e) => setForm({ ...form, target_id: e.target.value })}>
            <option value="">—</option>
            {(arts.data || []).map((a) => (
              <option key={a.id} value={a.id}>
                {optionLabel(a)}
              </option>
            ))}
          </select>
        </Field>
        {mut.error && <p className="error">{(mut.error as Error).message}</p>}
      </div>
    </Modal>
  );
}
