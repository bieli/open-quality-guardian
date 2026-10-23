import { useEffect, useMemo, useRef, useState } from "react";
import type { Artifact } from "../types";

function labelOf(a: Artifact) {
  return `${a.identifier} — ${a.title}`;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Search by ID or title…",
  allowEmpty = true,
  emptyLabel = "— none —",
  disabled,
}: {
  options: Artifact[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.id === value);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return options.slice(0, 80);
    return options
      .filter(
        (o) =>
          o.identifier.toLowerCase().includes(term) ||
          o.title.toLowerCase().includes(term) ||
          (o.owner || "").toLowerCase().includes(term) ||
          o.kind.toLowerCase().includes(term),
      )
      .slice(0, 80);
  }, [options, q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className={`ss ${open ? "open" : ""}`} ref={root}>
      <button
        type="button"
        className="ss-trigger"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={selected ? "" : "muted"}>{selected ? labelOf(selected) : emptyLabel}</span>
        <span className="ss-caret">▾</span>
      </button>
      {open && (
        <div className="ss-panel">
          <input
            autoFocus
            className="ss-search"
            placeholder={placeholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "Enter" && filtered[0]) {
                onChange(filtered[0].id);
                setOpen(false);
                setQ("");
              }
            }}
          />
          <div className="ss-list">
            {allowEmpty && (
              <button
                type="button"
                className={`ss-option ${!value ? "on" : ""}`}
                onClick={() => {
                  onChange("");
                  setOpen(false);
                  setQ("");
                }}
              >
                {emptyLabel}
              </button>
            )}
            {filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                className={`ss-option ${o.id === value ? "on" : ""}`}
                onClick={() => {
                  onChange(o.id);
                  setOpen(false);
                  setQ("");
                }}
              >
                <span className="mono">{o.identifier}</span>
                <span>{o.title}</span>
                <span className="small muted">{o.kind.replaceAll("_", " ")} · {o.viewpoint}</span>
              </button>
            ))}
            {!filtered.length && <div className="ss-empty muted small">No matches</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export function MultiSearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Search and add…",
}: {
  options: Artifact[];
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const selected = options.filter((o) => value.includes(o.id));
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const pool = options.filter((o) => !value.includes(o.id));
    if (!term) return pool.slice(0, 40);
    return pool
      .filter((o) => o.identifier.toLowerCase().includes(term) || o.title.toLowerCase().includes(term))
      .slice(0, 40);
  }, [options, q, value]);

  return (
    <div className="ss-multi">
      <div className="chip-row">
        {selected.map((o) => (
          <button
            key={o.id}
            type="button"
            className="chip"
            onClick={() => onChange(value.filter((id) => id !== o.id))}
            title="Remove"
          >
            {o.identifier} ×
          </button>
        ))}
        {!selected.length && <span className="small muted">None selected</span>}
      </div>
      <input
        className="ss-search"
        placeholder={placeholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && filtered[0]) {
            e.preventDefault();
            onChange([...value, filtered[0].id]);
            setQ("");
          }
        }}
      />
      {q.trim() && (
        <div className="ss-list ss-list-inline">
          {filtered.map((o) => (
            <button
              key={o.id}
              type="button"
              className="ss-option"
              onClick={() => {
                onChange([...value, o.id]);
                setQ("");
              }}
            >
              <span className="mono">{o.identifier}</span>
              <span>{o.title}</span>
            </button>
          ))}
          {!filtered.length && <div className="ss-empty muted small">No matches</div>}
        </div>
      )}
    </div>
  );
}
