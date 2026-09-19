from __future__ import annotations

from collections import defaultdict
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.models import (
    Artifact,
    ArtifactKind,
    BomItem,
    Domain,
    FindingSeverity,
    LifecycleStatus,
    LinkType,
    QualityFinding,
    TraceLink,
    VModelNode,
    Viewpoint,
)


VERIFICATION_STATUSES = {LifecycleStatus.VERIFIED}
FAIL_STATUSES = {LifecycleStatus.FAILED, LifecycleStatus.BLOCKED}
REQUIREMENT_KINDS = {
    ArtifactKind.REQUIREMENT,
    ArtifactKind.STAKEHOLDER_NEED,
    ArtifactKind.CUSTOMER_FEATURE,
}
TEST_KINDS = {ArtifactKind.TEST_SPEC, ArtifactKind.TEST_CASE}


def _pct(part: int, whole: int) -> float:
    return round((part / whole) * 100, 1) if whole else 0.0


def compute_quality(db: Session, project_id: UUID) -> dict[str, Any]:
    artifacts = db.query(Artifact).filter(Artifact.project_id == project_id).all()
    links = db.query(TraceLink).filter(TraceLink.project_id == project_id).all()
    findings = (
        db.query(QualityFinding)
        .filter(QualityFinding.project_id == project_id, QualityFinding.status == "open")
        .all()
    )

    by_id = {a.id: a for a in artifacts}
    outgoing: dict[UUID, list[TraceLink]] = defaultdict(list)
    incoming: dict[UUID, list[TraceLink]] = defaultdict(list)
    for link in links:
        outgoing[link.source_id].append(link)
        incoming[link.target_id].append(link)

    reqs = [a for a in artifacts if a.kind in REQUIREMENT_KINDS and a.id not in {x.parent_id for x in artifacts if x.parent_id}]
    tests = [a for a in artifacts if a.kind in TEST_KINDS]
    verified_reqs = []
    for req in reqs:
        related = incoming[req.id] + outgoing[req.id]
        if any(
            (link.link_type in {LinkType.VERIFIES, LinkType.VALIDATES})
            and by_id.get(link.source_id if link.target_id == req.id else link.target_id)
            and (
                by_id[link.source_id if link.target_id == req.id else link.target_id].kind in TEST_KINDS
                or by_id[link.source_id if link.target_id == req.id else link.target_id].status
                in VERIFICATION_STATUSES
            )
            for link in related
        ) or req.status in VERIFICATION_STATUSES:
            verified_reqs.append(req)

    tests_passed = [t for t in tests if t.status == LifecycleStatus.VERIFIED]
    progress_vals = [a.progress for a in artifacts] or [0]
    avg_progress = sum(progress_vals) / len(progress_vals)

    by_viewpoint: dict[str, dict[str, float]] = {}
    for vp in Viewpoint:
        group = [a for a in artifacts if a.viewpoint == vp]
        if not group:
            continue
        by_viewpoint[vp.value] = {
            "count": len(group),
            "progress": round(sum(a.progress for a in group) / len(group), 1),
            "verified": _pct(sum(1 for a in group if a.status == LifecycleStatus.VERIFIED), len(group)),
        }

    by_domain: dict[str, dict[str, float]] = {}
    for domain in Domain:
        group = [a for a in artifacts if a.domain == domain]
        if not group:
            continue
        by_domain[domain.value] = {
            "count": len(group),
            "progress": round(sum(a.progress for a in group) / len(group), 1),
            "verified": _pct(sum(1 for a in group if a.status == LifecycleStatus.VERIFIED), len(group)),
        }

    coverage = _pct(len(verified_reqs), len(reqs))
    open_gaps = sum(1 for f in findings if f.severity in {FindingSeverity.GAP, FindingSeverity.CRITICAL})
    critical = sum(1 for f in findings if f.severity == FindingSeverity.CRITICAL)
    test_pass_rate = _pct(len(tests_passed), len(tests))
    score = round(
        (coverage * 0.35)
        + (avg_progress * 0.25)
        + (test_pass_rate * 0.25)
        + (max(0, 100 - open_gaps * 4) * 0.15)
    )
    score = max(0, min(100, score))

    return {
        "score": score,
        "coverage": coverage,
        "progress": round(avg_progress, 1),
        "requirements": len(reqs),
        "verified_requirements": len(verified_reqs),
        "tests": len(tests),
        "tests_passed": len(tests_passed),
        "open_gaps": open_gaps,
        "critical": critical,
        "by_viewpoint": by_viewpoint,
        "by_domain": by_domain,
    }


def v_model_enriched(db: Session, project_id: UUID) -> list[dict[str, Any]]:
    nodes = db.query(VModelNode).filter(VModelNode.project_id == project_id).order_by(VModelNode.row).all()
    artifacts = db.query(Artifact).filter(Artifact.project_id == project_id).all()
    findings = (
        db.query(QualityFinding)
        .filter(QualityFinding.project_id == project_id, QualityFinding.status == "open")
        .all()
    )
    artifact_ids_by_node: dict[str, set[UUID]] = defaultdict(set)
    grouped: dict[str, list[Artifact]] = defaultdict(list)
    for art in artifacts:
        if art.v_node_key:
            grouped[art.v_node_key].append(art)
            artifact_ids_by_node[art.v_node_key].add(art.id)

    finding_by_artifact = defaultdict(int)
    for finding in findings:
        if finding.artifact_id:
            finding_by_artifact[finding.artifact_id] += 1

    result = []
    for node in nodes:
        group = grouped.get(node.key, [])
        gaps = sum(finding_by_artifact[a.id] for a in group)
        verified = sum(1 for a in group if a.status == LifecycleStatus.VERIFIED)
        progress = round(sum(a.progress for a in group) / len(group), 1) if group else 0
        coverage = _pct(verified, len(group)) if group else 0
        if any(a.status == LifecycleStatus.FAILED for a in group) or gaps >= 3:
            status = "failed"
        elif coverage >= 80 and progress >= 80:
            status = "verified"
        elif progress >= 40:
            status = "in_progress"
        else:
            status = "draft"
        result.append(
            {
                "id": node.id,
                "key": node.key,
                "name": node.name,
                "domain": node.domain.value,
                "side": node.side.value,
                "row": node.row,
                "counterpart_key": node.counterpart_key,
                "description": node.description,
                "artifact_count": len(group),
                "coverage": coverage,
                "progress": progress,
                "verified": verified,
                "gaps": gaps,
                "status": status,
            }
        )
    return result


def missing_links(db: Session, project_id: UUID) -> list[dict[str, Any]]:
    artifacts = db.query(Artifact).filter(Artifact.project_id == project_id).all()
    links = db.query(TraceLink).filter(TraceLink.project_id == project_id).all()
    linked = set()
    for link in links:
        linked.add(link.source_id)
        linked.add(link.target_id)

    children_of = {a.parent_id for a in artifacts if a.parent_id}
    rows = []
    for art in artifacts:
        if art.id in children_of:
            continue
        outgoing = [link for link in links if link.source_id == art.id]
        related = [link for link in links if link.source_id == art.id or link.target_id == art.id]
        has_down = bool(outgoing)
        has_verify = any(link.link_type in {LinkType.VERIFIES, LinkType.VALIDATES} for link in related)
        missing = []
        if art.kind in {ArtifactKind.STAKEHOLDER_NEED, ArtifactKind.CUSTOMER_FEATURE}:
            if not has_down:
                missing.append("requirement refinement")
            if not has_verify:
                missing.append("validation")
        elif art.kind == ArtifactKind.REQUIREMENT:
            if not has_down:
                missing.append("architecture allocation")
            if not has_verify:
                missing.append("verification")
        elif art.kind in {ArtifactKind.FUNCTION, ArtifactKind.LOGICAL_BLOCK} and not has_down:
            missing.append("implementation")
        if missing:
            rows.append(
                {
                    "id": str(art.id),
                    "identifier": art.identifier,
                    "title": art.title,
                    "viewpoint": art.viewpoint.value,
                    "missing": missing,
                }
            )
    return rows


def rebuild_findings(db: Session, project_id: UUID) -> None:
    db.query(QualityFinding).filter(QualityFinding.project_id == project_id).delete()
    artifacts = db.query(Artifact).filter(Artifact.project_id == project_id).all()
    links = db.query(TraceLink).filter(TraceLink.project_id == project_id).all()
    missing = missing_links(db, project_id)
    by_id = {a.identifier: a for a in artifacts}

    for row in missing:
        art = next((a for a in artifacts if str(a.id) == row["id"]), None)
        if not art:
            continue
        db.add(
            QualityFinding(
                project_id=project_id,
                artifact_id=art.id,
                rule="traceability.coverage",
                severity=FindingSeverity.GAP,
                title=f"{art.identifier} is missing {', '.join(row['missing'])}",
                detail="Every requirement and function in a complex product should be allocated and verified.",
            )
        )

    for art in artifacts:
        if art.kind in REQUIREMENT_KINDS and not art.owner:
            db.add(
                QualityFinding(
                    project_id=project_id,
                    artifact_id=art.id,
                    rule="ownership",
                    severity=FindingSeverity.WARNING,
                    title=f"{art.identifier} has no owner",
                    detail="Program managers cannot track accountability without a named owner.",
                )
            )
        if art.status == LifecycleStatus.FAILED:
            db.add(
                QualityFinding(
                    project_id=project_id,
                    artifact_id=art.id,
                    rule="verification.failed",
                    severity=FindingSeverity.CRITICAL,
                    title=f"{art.identifier} verification failed",
                    detail=art.description or "A verification activity returned a fail verdict.",
                )
            )

    sch_parts = set()
    bom_refs = set()
    for art in artifacts:
        if art.kind == ArtifactKind.KICAD_SCH:
            for comp in art.extra.get("components", []):
                sch_parts.add(comp.get("value") or comp.get("reference"))
    for item in db.query(BomItem).filter(BomItem.project_id == project_id).all():
        bom_refs.add(item.part_number)
        bom_refs.add(item.name)

    # Cross-check is also done via BOM table in API; keep a representative finding if schematic has unmatched parts.
    if sch_parts and bom_refs:
        unmatched = [p for p in sch_parts if p and p not in bom_refs]
        if unmatched:
            sch = next(a for a in artifacts if a.kind == ArtifactKind.KICAD_SCH)
            db.add(
                QualityFinding(
                    project_id=project_id,
                    artifact_id=sch.id,
                    rule="bom.schematic",
                    severity=FindingSeverity.WARNING,
                    title="Schematic components not found on the BOM",
                    detail="Unmatched: " + ", ".join(unmatched[:8]),
                )
            )

    db.flush()
    _ = (links, by_id)
