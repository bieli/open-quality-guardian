from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Artifact, ArtifactKind, BomItem, Project, QualityFinding, TraceLink, Viewpoint
from app.schemas import (
    ArtifactOut,
    BomItemOut,
    DiagramOut,
    FindingOut,
    ProjectCreate,
    ProjectOut,
    QualitySummary,
    ReportOut,
    TraceLinkOut,
    VModelNodeOut,
)
from app.seed import _slugify
from app.services.quality import compute_quality, missing_links, rebuild_findings, v_model_enriched

router = APIRouter()


def _project(db: Session, project_id: UUID) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return project


@router.get("/projects")
def list_projects(db: Session = Depends(get_db)):
    rows = db.query(Project).order_by(Project.created_at).all()
    out = []
    for row in rows:
        rebuild_findings(db, row.id)
        out.append(
            {
                **ProjectOut.model_validate(row).model_dump(mode="json"),
                "quality": compute_quality(db, row.id),
            }
        )
    db.commit()
    return out


@router.post("/projects", response_model=ProjectOut)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db)):
    slug = payload.slug or _slugify(payload.name)
    project = Project(name=payload.name, product_type=payload.product_type, description=payload.description, slug=slug)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/projects/{project_id}", response_model=ProjectOut)
def get_project(project_id: UUID, db: Session = Depends(get_db)):
    return _project(db, project_id)


@router.get("/projects/{project_id}/artifacts", response_model=list[ArtifactOut])
def list_artifacts(project_id: UUID, viewpoint: str | None = None, db: Session = Depends(get_db)):
    _project(db, project_id)
    q = db.query(Artifact).filter(Artifact.project_id == project_id)
    if viewpoint:
        q = q.filter(Artifact.viewpoint == viewpoint)
    return q.order_by(Artifact.identifier).all()


@router.get("/projects/{project_id}/artifacts/{artifact_id}", response_model=ArtifactOut)
def get_artifact(project_id: UUID, artifact_id: UUID, db: Session = Depends(get_db)):
    row = db.get(Artifact, artifact_id)
    if not row or row.project_id != project_id:
        raise HTTPException(404, "Artifact not found")
    return row


@router.get("/projects/{project_id}/v-model", response_model=list[VModelNodeOut])
def get_v_model(project_id: UUID, db: Session = Depends(get_db)):
    _project(db, project_id)
    return v_model_enriched(db, project_id)


@router.get("/projects/{project_id}/quality", response_model=QualitySummary)
def get_quality(project_id: UUID, db: Session = Depends(get_db)):
    _project(db, project_id)
    rebuild_findings(db, project_id)
    db.commit()
    return compute_quality(db, project_id)


@router.get("/projects/{project_id}/findings", response_model=list[FindingOut])
def get_findings(project_id: UUID, db: Session = Depends(get_db)):
    _project(db, project_id)
    rebuild_findings(db, project_id)
    db.commit()
    _project(db, project_id)
    return (
        db.query(QualityFinding)
        .filter(QualityFinding.project_id == project_id)
        .order_by(QualityFinding.severity.desc())
        .all()
    )


@router.get("/projects/{project_id}/traceability", response_model=list[TraceLinkOut])
def get_traceability(project_id: UUID, db: Session = Depends(get_db)):
    _project(db, project_id)
    links = db.query(TraceLink).filter(TraceLink.project_id == project_id).all()
    arts = {a.id: a for a in db.query(Artifact).filter(Artifact.project_id == project_id).all()}
    out = []
    for link in links:
        src, dst = arts.get(link.source_id), arts.get(link.target_id)
        out.append(
            TraceLinkOut(
                id=link.id,
                source_id=link.source_id,
                target_id=link.target_id,
                link_type=link.link_type.value,
                source_identifier=src.identifier if src else "",
                source_title=src.title if src else "",
                target_identifier=dst.identifier if dst else "",
                target_title=dst.title if dst else "",
            )
        )
    return out


@router.get("/projects/{project_id}/trace-matrix")
def trace_matrix(project_id: UUID, db: Session = Depends(get_db)):
    _project(db, project_id)
    arts = db.query(Artifact).filter(Artifact.project_id == project_id).all()
    links = db.query(TraceLink).filter(TraceLink.project_id == project_id).all()
    reqs = [a for a in arts if a.kind.value in {"requirement", "customer_feature", "stakeholder_need"}]
    funcs = [a for a in arts if a.kind.value in {"function", "action", "logical_block"}]
    link_set = {(str(l.source_id), str(l.target_id)) for l in links} | {(str(l.target_id), str(l.source_id)) for l in links}
    rows = []
    for req in reqs:
        linked = []
        missing = 0
        for fn in funcs:
            hit = (str(req.id), str(fn.id)) in link_set
            if hit:
                linked.append({"id": str(fn.id), "identifier": fn.identifier, "title": fn.title})
        # count expected: at least one function
        if not linked:
            missing = 1
        rows.append(
            {
                "id": str(req.id),
                "identifier": req.identifier,
                "title": req.title,
                "viewpoint": req.viewpoint.value,
                "status": req.status.value,
                "linked": linked,
                "missing": missing,
            }
        )
    return {"rows": rows, "functions": [{"id": str(f.id), "identifier": f.identifier, "title": f.title} for f in funcs]}


@router.get("/projects/{project_id}/diagrams", response_model=list[DiagramOut])
def list_diagrams(project_id: UUID, db: Session = Depends(get_db)):
    _project(db, project_id)
    rows = (
        db.query(Artifact)
        .filter(Artifact.project_id == project_id, Artifact.kind == ArtifactKind.FUNCTION)
        .order_by(Artifact.identifier)
        .all()
    )
    diagrams = []
    for row in rows:
        extra = row.extra or {}
        if not extra.get("nodes"):
            continue
        diagrams.append(
            DiagramOut(
                id=row.id,
                identifier=row.identifier,
                title=row.title,
                description=row.description,
                lanes=extra.get("lanes", []),
                nodes=extra.get("nodes", []),
                edges=extra.get("edges", []),
                notes=extra.get("notes", []),
            )
        )
    return diagrams


@router.get("/projects/{project_id}/diagrams/{artifact_id}", response_model=DiagramOut)
def get_diagram(project_id: UUID, artifact_id: UUID, db: Session = Depends(get_db)):
    row = db.get(Artifact, artifact_id)
    if not row or row.project_id != project_id:
        raise HTTPException(404, "Diagram not found")
    extra = row.extra or {}
    return DiagramOut(
        id=row.id,
        identifier=row.identifier,
        title=row.title,
        description=row.description,
        lanes=extra.get("lanes", []),
        nodes=extra.get("nodes", []),
        edges=extra.get("edges", []),
        notes=extra.get("notes", []),
    )


@router.get("/projects/{project_id}/bom", response_model=list[BomItemOut])
def get_bom(project_id: UUID, db: Session = Depends(get_db)):
    _project(db, project_id)
    return db.query(BomItem).filter(BomItem.project_id == project_id).order_by(BomItem.category, BomItem.part_number).all()


@router.get("/projects/{project_id}/tests", response_model=list[ArtifactOut])
def get_tests(project_id: UUID, db: Session = Depends(get_db)):
    _project(db, project_id)
    return (
        db.query(Artifact)
        .filter(Artifact.project_id == project_id, Artifact.viewpoint == Viewpoint.T)
        .order_by(Artifact.identifier)
        .all()
    )


@router.get("/projects/{project_id}/report", response_model=ReportOut)
def get_report(project_id: UUID, db: Session = Depends(get_db)):
    project = _project(db, project_id)
    quality = compute_quality(db, project_id)
    findings = (
        db.query(QualityFinding)
        .filter(QualityFinding.project_id == project_id, QualityFinding.status == "open")
        .all()
    )
    vnodes = v_model_enriched(db, project_id)
    missing = missing_links(db, project_id)
    weakest = sorted(vnodes, key=lambda n: n["coverage"] + n["progress"])[:3]
    narrative = (
        f"{project.name} currently scores {quality['score']}/100 on integrated quality. "
        f"Requirement verification coverage is {quality['coverage']}% "
        f"({quality['verified_requirements']}/{quality['requirements']}). "
        f"There are {quality['open_gaps']} open gaps and {quality['critical']} critical findings. "
    )
    if weakest:
        narrative += "Weakest V-model stations: " + ", ".join(n["name"] for n in weakest) + "."
    return ReportOut(
        project=project,
        generated_at=datetime.now(timezone.utc).isoformat(),
        quality=quality,
        v_model=vnodes,
        findings=findings,
        missing_links=missing,
        narrative=narrative,
    )
