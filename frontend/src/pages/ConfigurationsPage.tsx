import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { formatEffectivity, useProjectConfig } from "../ConfigContext";
import { QualityRing } from "../components/Bits";
import { Btn, Field } from "../components/ui";
import type { Artifact, BomItem, ConfigCompare, ProductConfiguration, Variant } from "../types";

export function ConfigurationsPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const cfg = useProjectConfig();
  const dict = useQuery({ queryKey: ["dictionary", id], queryFn: () => api.dictionary(id!), enabled: !!id });
  const arts = useQuery({ queryKey: ["arts", id, "150"], queryFn: () => api.artifacts(id!), enabled: !!id });
  const bom = useQuery({ queryKey: ["bom", id, "150"], queryFn: () => api.bom(id!), enabled: !!id });
  const variants = dict.data?.variants || [];
  const configs = dict.data?.configurations || [];
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const compare = useQuery({
    queryKey: ["compare", id, left, right],
    queryFn: () => api.compareConfigurations(id!, left, right),
    enabled: !!id && !!left && !!right && left !== right,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["dictionary", id] });
    qc.invalidateQueries({ queryKey: ["arts", id] });
    qc.invalidateQueries({ queryKey: ["bom", id] });
    qc.invalidateQueries({ queryKey: ["quality", id] });
  };

  useEffect(() => {
    if (!left && configs[0]) setLeft(configs[0].id);
    if (!right && (configs[1]?.id || configs[0]?.id)) setRight(configs[1]?.id || configs[0]?.id);
  }, [configs, left, right]);

  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <div className="eyebrow">Configuration dictionary</div>
          <h1>One filter for the whole thread</h1>
          <p className="muted small">
            Variants and named SKUs resolve the 150% definition down to a 100% product. Requirements, BOM lines and
            tests that carry effectivity disappear together — quality is scored for the configuration you are looking at.
          </p>
        </div>
        <div className="small muted">
          Active: {cfg.mode === "150" ? "150% (all variants)" : cfg.activeConfig?.name || "pick a SKU"}
        </div>
      </div>

      <div className="two">
        <DictionaryCard projectId={id!} variants={variants} onChange={refresh} />
        <NamedConfigsCard projectId={id!} variants={variants} configs={configs} onChange={refresh} />
      </div>

      <EffectivityTable projectId={id!} variants={variants} artifacts={arts.data || []} bom={bom.data || []} onChange={refresh} />

      <div className="card">
        <div className="eyebrow">Compare configured structures</div>
        <div className="btn-row" style={{ margin: "12px 0" }}>
          <select value={left} onChange={(e) => setLeft(e.target.value)} style={{ maxWidth: 280 }}>
            {configs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <span className="muted">vs</span>
          <select value={right} onChange={(e) => setRight(e.target.value)} style={{ maxWidth: 280 }}>
            {configs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {compare.data && <CompareView data={compare.data} />}
      </div>
    </div>
  );
}

function DictionaryCard({
  projectId,
  variants,
  onChange,
}: {
  projectId: string;
  variants: Variant[];
  onChange: () => void;
}) {
  const [form, setForm] = useState({ key: "", name: "", values: "home, pro" });
  const add = useMutation({
    mutationFn: () =>
      api.createVariant(projectId, {
        key: form.key,
        name: form.name,
        values: form.values
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
          .map((v, i) => ({ key: v.toLowerCase().replace(/\s+/g, "-"), name: v, sort_order: i })),
      }),
    onSuccess: () => {
      setForm({ key: "", name: "", values: "" });
      onChange();
    },
  });
  const addValue = useMutation({
    mutationFn: ({ vid, name }: { vid: string; name: string }) =>
      api.createVariantValue(projectId, vid, { key: name.toLowerCase().replace(/\s+/g, "-"), name }),
    onSuccess: onChange,
  });
  const remove = useMutation({
    mutationFn: (vid: string) => api.deleteVariant(projectId, vid),
    onSuccess: onChange,
  });
  return (
    <div className="card">
      <div className="eyebrow">Variability dictionary</div>
      <h2 className="serif" style={{ marginTop: 8, fontSize: 24 }}>
        Variants
      </h2>
      {variants.map((v) => (
        <div key={v.id} className="tree-item" style={{ cursor: "default" }}>
          <div className="id">{v.key}</div>
          <strong>{v.name}</strong>
          <div className="chip-row" style={{ marginTop: 8 }}>
            {v.values.map((val) => (
              <span key={val.id} className="chip">
                {val.name}
              </span>
            ))}
          </div>
          <div className="btn-row" style={{ marginTop: 8 }}>
            <Btn
              kind="ghost"
              onClick={() => {
                const name = window.prompt(`Add a value to ${v.name}`);
                if (name) addValue.mutate({ vid: v.id, name });
              }}
            >
              Add value
            </Btn>
            <Btn kind="ghost" onClick={() => remove.mutate(v.id)}>
              Remove
            </Btn>
          </div>
        </div>
      ))}
      <form
        className="form-grid"
        style={{ marginTop: 16 }}
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
      >
        <Field label="New variant key">
          <input className="mono" required value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="sku" />
        </Field>
        <Field label="Name">
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="SKU" />
        </Field>
        <Field label="Values (comma-separated)">
          <input value={form.values} onChange={(e) => setForm({ ...form, values: e.target.value })} />
        </Field>
        <Btn type="submit" disabled={add.isPending}>
          Add variant
        </Btn>
      </form>
    </div>
  );
}

function NamedConfigsCard({
  projectId,
  variants,
  configs,
  onChange,
}: {
  projectId: string;
  variants: Variant[];
  configs: ProductConfiguration[];
  onChange: () => void;
}) {
  const blankSel = Object.fromEntries(variants.map((v) => [v.key, v.values[0]?.key || ""]));
  const [form, setForm] = useState({ key: "", name: "", selection: blankSel });
  useEffect(() => {
    setForm((f) => ({ ...f, selection: { ...blankSel, ...f.selection } }));
  }, [variants.length]);
  const add = useMutation({
    mutationFn: () => api.createConfiguration(projectId, form),
    onSuccess: () => {
      setForm({ key: "", name: "", selection: blankSel });
      onChange();
    },
  });
  const patch = useMutation({
    mutationFn: ({ cid, selection }: { cid: string; selection: Record<string, string> }) =>
      api.updateConfiguration(projectId, cid, { selection }),
    onSuccess: onChange,
  });
  const remove = useMutation({
    mutationFn: (cid: string) => api.deleteConfiguration(projectId, cid),
    onSuccess: onChange,
  });
  return (
    <div className="card">
      <div className="eyebrow">100% product configurations</div>
      <h2 className="serif" style={{ marginTop: 8, fontSize: 24 }}>
        Named SKUs
      </h2>
      {configs.map((c) => (
        <div key={c.id} className="tree-item" style={{ cursor: "default" }}>
          <div className="id">{c.key}</div>
          <strong>{c.name}</strong>
          <p className="small muted">{c.description}</p>
          <div className="form-grid" style={{ marginTop: 8 }}>
            {variants.map((v) => (
              <Field key={v.id} label={v.name}>
                <select
                  value={c.selection[v.key] || ""}
                  onChange={(e) =>
                    patch.mutate({ cid: c.id, selection: { ...c.selection, [v.key]: e.target.value } })
                  }
                >
                  {v.values.map((val) => (
                    <option key={val.id} value={val.key}>
                      {val.name}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
          <div style={{ marginTop: 8 }}>
            <Btn kind="ghost" onClick={() => remove.mutate(c.id)}>
              Remove SKU
            </Btn>
          </div>
        </div>
      ))}
      <form
        className="form-grid"
        style={{ marginTop: 16 }}
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
      >
        <Field label="SKU key">
          <input className="mono" required value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="pro-lidar-eu" />
        </Field>
        <Field label="Name">
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Pro LiDAR EU" />
        </Field>
        {variants.map((v) => (
          <Field key={v.id} label={v.name}>
            <select
              value={form.selection[v.key] || ""}
              onChange={(e) => setForm({ ...form, selection: { ...form.selection, [v.key]: e.target.value } })}
            >
              {v.values.map((val) => (
                <option key={val.id} value={val.key}>
                  {val.name}
                </option>
              ))}
            </select>
          </Field>
        ))}
        <Btn type="submit" disabled={add.isPending}>
          Add configuration
        </Btn>
      </form>
    </div>
  );
}

function EffectivityTable({
  projectId,
  variants,
  artifacts,
  bom,
  onChange,
}: {
  projectId: string;
  variants: Variant[];
  artifacts: Artifact[];
  bom: BomItem[];
  onChange: () => void;
}) {
  const saveArt = useMutation({
    mutationFn: ({ aid, effectivity }: { aid: string; effectivity: Record<string, string[]> }) =>
      api.updateArtifact(projectId, aid, { effectivity }),
    onSuccess: onChange,
  });
  const saveBom = useMutation({
    mutationFn: ({ bid, effectivity }: { bid: string; effectivity: Record<string, string[]> }) =>
      api.updateBom(projectId, bid, { effectivity }),
    onSuccess: onChange,
  });
  const interesting = artifacts.filter(
    (a) =>
      ["requirement", "customer_feature", "hw_component", "test_case", "test_spec"].includes(a.kind) ||
      (a.effectivity && Object.keys(a.effectivity).length),
  );
  return (
    <div className="card" style={{ overflow: "auto" }}>
      <div className="eyebrow">Effectivity on the thread</div>
      <p className="small muted">Empty means common — the object stays in every 100% resolve.</p>
      <table>
        <thead>
          <tr>
            <th>Object</th>
            {variants.map((v) => (
              <th key={v.id}>{v.name}</th>
            ))}
            <th>Resolved</th>
          </tr>
        </thead>
        <tbody>
          {interesting.slice(0, 40).map((a) => (
            <tr key={a.id}>
              <td>
                <div className="mono">{a.identifier}</div>
                <div className="small">{a.title}</div>
              </td>
              {variants.map((v) => (
                <td key={v.id}>
                  <EffectivityChecks
                    variant={v}
                    selected={a.effectivity?.[v.key] || []}
                    onChange={(keys) => {
                      const next = { ...(a.effectivity || {}) };
                      if (keys.length) next[v.key] = keys;
                      else delete next[v.key];
                      saveArt.mutate({ aid: a.id, effectivity: next });
                    }}
                  />
                </td>
              ))}
              <td className="small muted">{formatEffectivity(a.effectivity)}</td>
            </tr>
          ))}
          {bom.map((row) => (
            <tr key={row.id}>
              <td>
                <div className="mono">{row.part_number}</div>
                <div className="small">BOM · {row.name}</div>
              </td>
              {variants.map((v) => (
                <td key={v.id}>
                  <EffectivityChecks
                    variant={v}
                    selected={row.effectivity?.[v.key] || []}
                    onChange={(keys) => {
                      const next = { ...(row.effectivity || {}) };
                      if (keys.length) next[v.key] = keys;
                      else delete next[v.key];
                      saveBom.mutate({ bid: row.id, effectivity: next });
                    }}
                  />
                </td>
              ))}
              <td className="small muted">{formatEffectivity(row.effectivity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EffectivityChecks({
  variant,
  selected,
  onChange,
}: {
  variant: Variant;
  selected: string[];
  onChange: (keys: string[]) => void;
}) {
  return (
    <div className="eff-checks">
      {variant.values.map((val) => {
        const on = selected.includes(val.key);
        return (
          <label key={val.id} className="field-check">
            <input
              type="checkbox"
              checked={on}
              onChange={() => onChange(on ? selected.filter((k) => k !== val.key) : [...selected, val.key])}
            />
            {val.name}
          </label>
        );
      })}
    </div>
  );
}

function CompareView({ data }: { data: ConfigCompare }) {
  return (
    <div className="stack">
      <div className="split">
        <div className="card" style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <QualityRing value={data.quality_left.score} />
          <div>
            <div className="eyebrow">{data.left.name}</div>
            <div className="small muted">
              Coverage {data.quality_left.coverage}% · {data.quality_left.open_gaps} gaps
            </div>
          </div>
        </div>
        <div className="card" style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <QualityRing value={data.quality_right.score} />
          <div>
            <div className="eyebrow">{data.right.name}</div>
            <div className="small muted">
              Coverage {data.quality_right.coverage}% · {data.quality_right.open_gaps} gaps · delta {data.quality_delta.score > 0 ? "+" : ""}
              {data.quality_delta.score}
            </div>
          </div>
        </div>
      </div>
      <div className="three">
        <DiffCard title="Requirements" left={data.left.name} right={data.right.name} onlyLeft={data.requirements.only_left} onlyRight={data.requirements.only_right} shared={data.requirements.shared} label={(r) => `${r.identifier} ${r.title}`} />
        <DiffCard title="Tests" left={data.left.name} right={data.right.name} onlyLeft={data.tests.only_left} onlyRight={data.tests.only_right} shared={data.tests.shared} label={(r) => `${r.identifier} ${r.title}`} />
        <DiffCard title="BOM" left={data.left.name} right={data.right.name} onlyLeft={data.bom.only_left} onlyRight={data.bom.only_right} shared={data.bom.shared} label={(r) => `${r.part_number} ${r.name}`} />
      </div>
    </div>
  );
}

function DiffCard<T extends { name: string }>({
  title,
  left,
  right,
  onlyLeft,
  onlyRight,
  shared,
  label,
}: {
  title: string;
  left: string;
  right: string;
  onlyLeft: T[];
  onlyRight: T[];
  shared: number;
  label: (row: T) => string;
}) {
  return (
    <div className="card">
      <div className="eyebrow">{title}</div>
      <p className="small muted">{shared} shared</p>
      <div className="small">
        <strong>Only in {left}</strong>
        {onlyLeft.map((r, i) => (
          <div key={i}>{label(r)}</div>
        ))}
        {!onlyLeft.length && <div className="muted">—</div>}
        <strong style={{ display: "block", marginTop: 10 }}>Only in {right}</strong>
        {onlyRight.map((r, i) => (
          <div key={i}>{label(r)}</div>
        ))}
        {!onlyRight.length && <div className="muted">—</div>}
      </div>
    </div>
  );
}
