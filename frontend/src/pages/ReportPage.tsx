import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { QualityRing, StatusChip } from "../components/Bits";
import { QueryState } from "../components/QueryState";
import { Btn } from "../components/ui";
import { ArtifactEditor, LinkWizard, VerificationWizard } from "../components/Wizards";
import { useProjectConfig } from "../ConfigContext";
import type { Artifact, Finding } from "../types";

type GapAction = {
  finding: Finding;
  action: "verify" | "allocate" | "owner" | "fix-test" | "bom" | "view";
  label: string;
};

function classifyFinding(f: Finding): GapAction {
  const title = (f.title || "").toLowerCase();
  if (f.rule === "verification.failed" || title.includes("verification failed")) {
    return { finding: f, action: "fix-test", label: "Open failed test" };
  }
  if (f.rule === "ownership" || title.includes("no owner")) {
    return { finding: f, action: "owner", label: "Assign owner" };
  }
  if (f.rule === "bom.schematic" || title.includes("schematic")) {
    return { finding: f, action: "bom", label: "Review BOM / schematic" };
  }
  if (title.includes("verification") || title.includes("validation")) {
    return { finding: f, action: "verify", label: "Close gap: add verification" };
  }
  if (title.includes("allocation") || title.includes("implementation") || title.includes("refinement")) {
    return { finding: f, action: "allocate", label: "Close gap: add link" };
  }
  return { finding: f, action: "view", label: "Inspect artifact" };
}

export function ReportPage() {
  const { id } = useParams();
  const { activeConfigId, mode, activeConfig } = useProjectConfig();
  const report = useQuery({
    queryKey: ["report", id, activeConfigId],
    queryFn: () => api.report(id!, activeConfigId),
    enabled: !!id,
  });
  const arts = useQuery({
    queryKey: ["arts", id, activeConfigId],
    queryFn: () => api.artifacts(id!, undefined, activeConfigId),
    enabled: !!id,
  });
  const r = report.data;
  const [verify, setVerify] = useState(false);
  const [link, setLink] = useState(false);
  const [edit, setEdit] = useState<Artifact | null>(null);
  const [verifyPrefill, setVerifyPrefill] = useState<string | undefined>();

  const actions = useMemo(() => (r?.findings || []).slice(0, 8).map(classifyFinding), [r?.findings]);

  const openAction = (a: GapAction) => {
    const art = (arts.data || []).find((x) => x.id === a.finding.artifact_id);
    if (a.action === "verify") {
      setVerifyPrefill(a.finding.artifact_id || undefined);
      setVerify(true);
      return;
    }
    if (a.action === "allocate") {
      setLink(true);
      return;
    }
    if (art) setEdit(art);
  };

  const downloadMd = async () => {
    const text = await api.exportReportMd(id!, activeConfigId);
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${r?.project.slug || "quality"}-report.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <div className="eyebrow">Program report</div>
          <h1>Verification narrative</h1>
          <p className="muted small">
            {mode === "100"
              ? `Scoped to ${activeConfig?.name || "selected SKU"}. Switch to 150% to include every variant.`
              : "150% view across the full product definition."}
          </p>
        </div>
        <div className="btn-row">
          <Btn kind="ghost" onClick={() => downloadMd()} disabled={!r}>
            Export Markdown
          </Btn>
          <QualityRing value={r?.quality.score || 0} />
        </div>
      </div>

      <QueryState loading={report.isLoading} error={report.error}>
        <div className="card">
          <div className="eyebrow">How to read this report</div>
          <ol className="howto">
            <li>
              <strong>Score</strong> blends requirement coverage, progress, test pass rate and open gaps.
            </li>
            <li>
              <strong>Missing links</strong> are RFLP gaps — a requirement without allocation or verification.
            </li>
            <li>
              <strong>Findings</strong> are actionable rules. Use <em>Close this gap</em> to open the right wizard — you do
              not need to guess statuses.
            </li>
          </ol>
        </div>

        <div className="card">
          <p className="small" style={{ fontSize: 16, lineHeight: 1.6 }}>
            {r?.narrative}
          </p>
          <p className="muted small">Generated {r?.generated_at && new Date(r.generated_at).toLocaleString()}</p>
        </div>

        <div className="card">
          <div className="eyebrow">Next actions</div>
          <p className="small muted">Start here — each button opens a guided fix for that finding.</p>
          <div className="find-list" style={{ marginTop: 10 }}>
            {actions.map((a) => (
              <div key={a.finding.id} className={`find ${a.finding.severity}`}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                  <div>
                    <StatusChip status={a.finding.severity} /> {a.finding.title}
                    <div className="small muted">{a.finding.detail}</div>
                  </div>
                  <Btn kind="ghost" onClick={() => openAction(a)}>
                    {a.label}
                  </Btn>
                </div>
              </div>
            ))}
            {!actions.length && <p className="muted small">No open findings for this configuration. Nice work.</p>}
          </div>
        </div>

        <div className="two">
          <div className="card">
            <div className="eyebrow">Missing links</div>
            {!r?.missing_links?.length ? (
              <p className="muted small">No missing RFLP links in this configuration.</p>
            ) : (
              <table>
                <tbody>
                  {(r?.missing_links || []).map((m) => (
                    <tr key={m.identifier}>
                      <td className="mono">{m.identifier}</td>
                      <td>{m.title}</td>
                      <td>{m.missing.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="card">
            <div className="eyebrow">All findings</div>
            <div className="find-list">
              {(r?.findings || []).map((f) => (
                <div key={f.id} className={`find ${f.severity}`}>
                  <StatusChip status={f.severity} /> {f.title}
                </div>
              ))}
              {!r?.findings?.length && <p className="muted small">No findings.</p>}
            </div>
          </div>
        </div>
      </QueryState>

      {verify && id && (
        <VerificationWizard
          projectId={id}
          verifiesId={verifyPrefill}
          onClose={() => {
            setVerify(false);
            setVerifyPrefill(undefined);
          }}
        />
      )}
      {link && id && <LinkWizard projectId={id} onClose={() => setLink(false)} />}
      {edit && id && <ArtifactEditor projectId={id} artifact={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}
