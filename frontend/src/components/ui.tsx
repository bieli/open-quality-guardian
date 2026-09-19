import { type FormEvent, type ReactNode } from "react";

export function Btn({
  children,
  onClick,
  kind = "primary",
  type = "button",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  kind?: "primary" | "ghost" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button type={type} className={`btn ${kind}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Modal({
  title,
  step,
  steps,
  children,
  onClose,
  onSubmit,
  submitLabel = "Save",
  busy,
}: {
  title: string;
  step?: number;
  steps?: string[];
  children: ReactNode;
  onClose: () => void;
  onSubmit?: (e: FormEvent) => void;
  submitLabel?: string;
  busy?: boolean;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit?.(e);
        }}
      >
        <div className="modal-head">
          <div>
            <div className="eyebrow">Authoring</div>
            <h2 className="serif">{title}</h2>
          </div>
          <button type="button" className="btn ghost" onClick={onClose}>
            Close
          </button>
        </div>
        {steps && step !== undefined && (
          <ol className="wizard-steps">
            {steps.map((label, i) => (
              <li key={label} className={i === step ? "on" : i < step ? "done" : ""}>
                {i + 1}. {label}
              </li>
            ))}
          </ol>
        )}
        <div className="modal-body">{children}</div>
        <div className="modal-actions">
          <Btn kind="ghost" onClick={onClose}>
            Cancel
          </Btn>
          {onSubmit && (
            <Btn type="submit" disabled={busy}>
              {busy ? "Saving…" : submitLabel}
            </Btn>
          )}
        </div>
      </form>
    </div>
  );
}

export const V_NODES = [
  ["stakeholder_req", "Stakeholder Requirements"],
  ["validation", "Validation"],
  ["system_req", "System Requirements"],
  ["system_verification", "System Verification"],
  ["system_architecture", "System Architecture"],
  ["system_integration", "System Integration"],
  ["sw_req", "Software Requirements"],
  ["sw_verification", "Software Verification"],
  ["sw_architecture", "Software Architecture"],
  ["sw_comp_verif", "Software Component Verification"],
  ["sw_detailed_design", "Software Detailed Design"],
  ["sw_unit_verif", "Software Unit Verification"],
  ["hw_req", "Hardware Requirements"],
  ["hw_verification", "Hardware Verification"],
  ["hw_architecture", "Hardware Architecture"],
  ["hw_comp_verif", "Hardware Component Verification"],
  ["hw_detailed_design", "Hardware Detailed Design"],
  ["hw_unit_verif", "Hardware Unit Verification"],
];

export const STATUSES = ["draft", "in_review", "approved", "in_progress", "implemented", "verified", "failed", "blocked"];
export const LINK_TYPES = ["refines", "allocates", "implements", "verifies", "validates", "derives", "traces", "satisfies"];
export const DOMAINS = ["system", "software", "hardware", "mechanical", "electrical", "product"];
