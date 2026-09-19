import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  FunctionWizard,
  LogicalWizard,
  PhysicalWizard,
  RequirementWizard,
  VerificationWizard,
} from "../components/Wizards";
import { Btn } from "../components/ui";

const CARDS = [
  ["R", "Requirements", "Capture customer features and system / software / hardware requirements, then hang them on the left of the V."],
  ["F", "Functional", "Describe product behaviour as functions and swimlane diagrams a program manager can read."],
  ["L", "Logical", "Allocate functions to sense, compute and actuate — still independent of a specific chip or class."],
  ["P", "Physical", "Name the software and hardware that will actually be built, including CAD and electronics later."],
  ["V", "Verification", "Close the V: a test, a station, a verdict, linked back to what it proves."],
] as const;

export function ComposePage() {
  const { id } = useParams();
  const [open, setOpen] = useState<string | null>(null);
  if (!id) return null;
  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <div className="eyebrow">Authoring</div>
          <h1>Compose the product, then prove it</h1>
          <p className="muted small">
            Walk RFLP in order, or jump to the station you need. Every wizard writes into the same V-model the quality
            cockpit reads.
          </p>
        </div>
      </div>
      <div className="three">
        {CARDS.map(([key, title, body]) => (
          <div className="card" key={key}>
            <div className="eyebrow">{key}</div>
            <h2 className="serif" style={{ fontSize: 26, margin: "8px 0" }}>
              {title}
            </h2>
            <p className="small muted">{body}</p>
            <Btn onClick={() => setOpen(key)}>{key === "V" ? "Record verification" : `Add ${title.toLowerCase()}`}</Btn>
          </div>
        ))}
      </div>
      {open === "R" && <RequirementWizard projectId={id} onClose={() => setOpen(null)} />}
      {open === "F" && <FunctionWizard projectId={id} onClose={() => setOpen(null)} />}
      {open === "L" && <LogicalWizard projectId={id} onClose={() => setOpen(null)} />}
      {open === "P" && <PhysicalWizard projectId={id} onClose={() => setOpen(null)} />}
      {open === "V" && <VerificationWizard projectId={id} onClose={() => setOpen(null)} />}
    </div>
  );
}
