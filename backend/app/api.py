from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session, selectinload

from app.crud import (
    add_link,
    apply_artifact_fields,
    delete_artifact,
    get_artifact,
    make_artifact,
    parse_enum,
    serialize_link,
    unique_slug,
)
from app.database import get_db
from app.models import (
    Artifact,
    ArtifactKind,
    BomItem,
    ConfigRule,
    Domain,
    LifecycleStatus,
    LinkType,
    ProductConfiguration,
    Project,
    TraceLink,
    Variant,
    VariantValue,
    Viewpoint,
)
from app.schemas import (
    ArtifactCreate,
    ArtifactOut,
    ArtifactUpdate,
    BomItemCreate,
    BomItemOut,
    BomItemUpdate,
    BulkLinkIn,
    BulkStatusIn,
    ConfigDictionaryOut,
    ConfigRuleCreate,
    ConfigRuleOut,
    DiagramOut,
    DiagramWrite,
    FindingOut,
    ProductConfigurationCreate,
    ProductConfigurationOut,
    ProductConfigurationUpdate,
    ProjectCreate,
    ProjectOut,
    ProjectUpdate,
    QualitySummary,
    ReportOut,
    RequirementImportIn,
    TraceLinkCreate,
    TraceLinkOut,
    VariantCreate,
    VariantOut,
    VariantUpdate,
    VariantValueCreate,
    VariantValueOut,
    VariantValueUpdate,
    VModelNodeOut,
)
from app.seed import _slugify, seed_v_model
from app.services.config import (
    get_configuration,
    matched_artifact_ids,
    resolve_artifacts,
    resolve_bom,
)
from app.services.quality import compute_quality, findings_for_view, missing_links, rebuild_findings, v_model_enriched
from app.wizards import router as wizard_router

router = APIRouter()
router.include_router(wizard_router)


def _project(db: Session, project_id: UUID) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return project


def _ctx(db: Session, project_id: UUID, config_id: UUID | None):
    cfg = get_configuration(db, project_id, config_id)
    selection = dict(cfg.selection or {}) if cfg else None
    return selection, cfg


def _quality(db: Session, project_id: UUID, config_id: UUID | None = None) -> dict:
    selection, cfg = _ctx(db, project_id, config_id)
    if selection is None:
        rebuild_findings(db, project_id)
    return compute_quality(
        db,
        project_id,
        selection=selection,
        config_id=cfg.id if cfg else None,
        config_name=cfg.name if cfg else "",
    )


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
    slug = unique_slug(db, payload.slug or _slugify(payload.name))
    project = Project(name=payload.name.strip(), product_type=payload.product_type, description=payload.description, slug=slug)
    db.add(project)
    db.flush()
    if payload.with_v_model:
        seed_v_model(db, project)
    db.commit()
    db.refresh(project)
    return project


@router.patch("/projects/{project_id}", response_model=ProjectOut)
def update_project(project_id: UUID, payload: ProjectUpdate, db: Session = Depends(get_db)):
    project = _project(db, project_id)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(project, key, value)
    db.commit()
    db.refresh(project)
    return project


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: UUID, db: Session = Depends(get_db)):
    project = _project(db, project_id)
    db.delete(project)
    db.commit()
    return None


@router.get("/projects/{project_id}", response_model=ProjectOut)
def get_project(project_id: UUID, db: Session = Depends(get_db)):
    return _project(db, project_id)


@router.get("/projects/{project_id}/artifacts", response_model=list[ArtifactOut])
def list_artifacts(
    project_id: UUID,
    viewpoint: str | None = None,
    kind: str | None = None,
    q: str | None = None,
    config_id: UUID | None = None,
    limit: int | None = None,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    _project(db, project_id)
    selection, _ = _ctx(db, project_id, config_id)
    query = db.query(Artifact).filter(Artifact.project_id == project_id)
    if viewpoint:
        query = query.filter(Artifact.viewpoint == viewpoint)
    if kind:
        kinds = [k.strip() for k in kind.split(",") if k.strip()]
        if len(kinds) == 1:
            query = query.filter(Artifact.kind == kinds[0])
        elif kinds:
            query = query.filter(Artifact.kind.in_(kinds))
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            (Artifact.identifier.ilike(like))
            | (Artifact.title.ilike(like))
            | (Artifact.description.ilike(like))
            | (Artifact.owner.ilike(like))
        )
    rows = query.order_by(Artifact.identifier).all()
    rows = resolve_artifacts(rows, selection, keep_ancestors=True)
    if offset:
        rows = rows[offset:]
    if limit is not None:
        rows = rows[: max(0, limit)]
    return rows


@router.post("/projects/{project_id}/artifacts", response_model=ArtifactOut)
def create_artifact(project_id: UUID, payload: ArtifactCreate, db: Session = Depends(get_db)):
    _project(db, project_id)
    row = make_artifact(
        db,
        project_id,
        identifier=payload.identifier,
        title=payload.title,
        description=payload.description,
        viewpoint=parse_enum(Viewpoint, payload.viewpoint, "viewpoint"),
        kind=parse_enum(ArtifactKind, payload.kind, "kind"),
        domain=parse_enum(Domain, payload.domain, "domain"),
        status=parse_enum(LifecycleStatus, payload.status, "status"),
        owner=payload.owner,
        v_node_key=payload.v_node_key,
        progress=payload.progress,
        parent_id=payload.parent_id,
        extra=payload.extra,
        effectivity=payload.effectivity,
    )
    db.commit()
    db.refresh(row)
    return row


@router.patch("/projects/{project_id}/artifacts/{artifact_id}", response_model=ArtifactOut)
def update_artifact(project_id: UUID, artifact_id: UUID, payload: ArtifactUpdate, db: Session = Depends(get_db)):
    row = get_artifact(db, project_id, artifact_id)
    apply_artifact_fields(row, payload.model_dump(exclude_unset=True))
    db.commit()
    db.refresh(row)
    return row


@router.delete("/projects/{project_id}/artifacts/{artifact_id}", status_code=204)
def remove_artifact(project_id: UUID, artifact_id: UUID, db: Session = Depends(get_db)):
    delete_artifact(db, project_id, artifact_id)
    db.commit()
    return None


@router.get("/projects/{project_id}/v-model", response_model=list[VModelNodeOut])
def get_v_model(project_id: UUID, config_id: UUID | None = None, db: Session = Depends(get_db)):
    _project(db, project_id)
    selection, _ = _ctx(db, project_id, config_id)
    return v_model_enriched(db, project_id, selection)


@router.get("/projects/{project_id}/quality", response_model=QualitySummary)
def get_quality(project_id: UUID, config_id: UUID | None = None, db: Session = Depends(get_db)):
    _project(db, project_id)
    summary = _quality(db, project_id, config_id)
    db.commit()
    return summary


@router.get("/projects/{project_id}/findings", response_model=list[FindingOut])
def get_findings(project_id: UUID, config_id: UUID | None = None, db: Session = Depends(get_db)):
    _project(db, project_id)
    selection, _ = _ctx(db, project_id, config_id)
    rows = findings_for_view(db, project_id, selection)
    if selection is None:
        db.commit()
    return rows


@router.get("/projects/{project_id}/traceability", response_model=list[TraceLinkOut])
def get_traceability(project_id: UUID, config_id: UUID | None = None, db: Session = Depends(get_db)):
    _project(db, project_id)
    selection, _ = _ctx(db, project_id, config_id)
    arts = {a.id: a for a in db.query(Artifact).filter(Artifact.project_id == project_id).all()}
    keep = matched_artifact_ids(arts.values(), selection)
    links = db.query(TraceLink).filter(TraceLink.project_id == project_id).all()
    out = []
    for link in links:
        if selection is not None and (link.source_id not in keep or link.target_id not in keep):
            continue
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


@router.post("/projects/{project_id}/traceability", response_model=TraceLinkOut)
def create_link(project_id: UUID, payload: TraceLinkCreate, db: Session = Depends(get_db)):
    _project(db, project_id)
    get_artifact(db, project_id, payload.source_id)
    get_artifact(db, project_id, payload.target_id)
    row = add_link(
        db,
        project_id,
        payload.source_id,
        payload.target_id,
        parse_enum(LinkType, payload.link_type, "link_type"),
    )
    db.commit()
    db.refresh(row)
    return serialize_link(db, row)


@router.delete("/projects/{project_id}/traceability/{link_id}", status_code=204)
def delete_link(project_id: UUID, link_id: UUID, db: Session = Depends(get_db)):
    _project(db, project_id)
    row = db.get(TraceLink, link_id)
    if not row or row.project_id != project_id:
        raise HTTPException(404, "Link not found")
    db.delete(row)
    db.commit()
    return None


@router.get("/projects/{project_id}/trace-matrix")
def trace_matrix(project_id: UUID, config_id: UUID | None = None, db: Session = Depends(get_db)):
    _project(db, project_id)
    selection, _ = _ctx(db, project_id, config_id)
    all_arts = db.query(Artifact).filter(Artifact.project_id == project_id).all()
    keep = matched_artifact_ids(all_arts, selection)
    arts = [a for a in all_arts if a.id in keep]
    links = [
        l
        for l in db.query(TraceLink).filter(TraceLink.project_id == project_id).all()
        if l.source_id in keep and l.target_id in keep
    ]
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
def list_diagrams(project_id: UUID, config_id: UUID | None = None, db: Session = Depends(get_db)):
    _project(db, project_id)
    selection, _ = _ctx(db, project_id, config_id)
    rows = (
        db.query(Artifact)
        .filter(Artifact.project_id == project_id, Artifact.kind == ArtifactKind.FUNCTION)
        .order_by(Artifact.identifier)
        .all()
    )
    rows = resolve_artifacts(rows, selection, keep_ancestors=False)
    diagrams = []
    for row in rows:
        extra = row.extra or {}
        if not extra.get("lanes") and not extra.get("nodes"):
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


@router.post("/projects/{project_id}/diagrams", response_model=DiagramOut)
def create_diagram(project_id: UUID, payload: DiagramWrite, db: Session = Depends(get_db)):
    _project(db, project_id)
    extra = {
        "lanes": payload.lanes,
        "nodes": payload.nodes,
        "edges": payload.edges,
        "notes": payload.notes,
    }
    row = make_artifact(
        db,
        project_id,
        identifier=payload.identifier,
        title=payload.title,
        description=payload.description,
        viewpoint=Viewpoint.F,
        kind=ArtifactKind.FUNCTION,
        v_node_key="system_architecture",
        extra=extra,
        status=LifecycleStatus.IN_PROGRESS,
        progress=20,
    )
    for src in payload.allocate_from_ids:
        add_link(db, project_id, src, row.id, LinkType.ALLOCATES)
    db.commit()
    db.refresh(row)
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


@router.put("/projects/{project_id}/diagrams/{artifact_id}", response_model=DiagramOut)
def update_diagram(project_id: UUID, artifact_id: UUID, payload: DiagramWrite, db: Session = Depends(get_db)):
    row = get_artifact(db, project_id, artifact_id)
    row.identifier = payload.identifier
    row.title = payload.title
    row.description = payload.description
    extra = dict(row.extra or {})
    extra.update(
        {
            "lanes": payload.lanes,
            "nodes": payload.nodes,
            "edges": payload.edges,
            "notes": payload.notes,
        }
    )
    row.extra = extra
    db.commit()
    db.refresh(row)
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
def get_bom(project_id: UUID, config_id: UUID | None = None, db: Session = Depends(get_db)):
    _project(db, project_id)
    selection, _ = _ctx(db, project_id, config_id)
    rows = db.query(BomItem).filter(BomItem.project_id == project_id).order_by(BomItem.category, BomItem.part_number).all()
    return resolve_bom(rows, selection)


@router.post("/projects/{project_id}/bom", response_model=BomItemOut)
def create_bom(project_id: UUID, payload: BomItemCreate, db: Session = Depends(get_db)):
    _project(db, project_id)
    row = BomItem(project_id=project_id, **payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/projects/{project_id}/bom/{item_id}", response_model=BomItemOut)
def update_bom(project_id: UUID, item_id: UUID, payload: BomItemUpdate, db: Session = Depends(get_db)):
    _project(db, project_id)
    row = db.get(BomItem, item_id)
    if not row or row.project_id != project_id:
        raise HTTPException(404, "BOM item not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/projects/{project_id}/bom/{item_id}", status_code=204)
def delete_bom(project_id: UUID, item_id: UUID, db: Session = Depends(get_db)):
    _project(db, project_id)
    row = db.get(BomItem, item_id)
    if not row or row.project_id != project_id:
        raise HTTPException(404, "BOM item not found")
    db.delete(row)
    db.commit()
    return None


@router.get("/projects/{project_id}/tests", response_model=list[ArtifactOut])
def get_tests(project_id: UUID, config_id: UUID | None = None, db: Session = Depends(get_db)):
    _project(db, project_id)
    selection, _ = _ctx(db, project_id, config_id)
    rows = (
        db.query(Artifact)
        .filter(Artifact.project_id == project_id, Artifact.viewpoint == Viewpoint.T)
        .order_by(Artifact.identifier)
        .all()
    )
    return resolve_artifacts(rows, selection, keep_ancestors=True)


@router.get("/projects/{project_id}/report", response_model=ReportOut)
def get_report(project_id: UUID, config_id: UUID | None = None, db: Session = Depends(get_db)):
    project = _project(db, project_id)
    selection, cfg = _ctx(db, project_id, config_id)
    quality = _quality(db, project_id, config_id)
    findings = findings_for_view(db, project_id, selection)
    if selection is None:
        db.commit()
    vnodes = v_model_enriched(db, project_id, selection)
    missing = missing_links(db, project_id, selection)
    weakest = sorted(vnodes, key=lambda n: n["coverage"] + n["progress"])[:3]
    scope = f" for {cfg.name}" if cfg else " across the 150% product definition"
    narrative = (
        f"{project.name} currently scores {quality['score']}/100 on integrated quality{scope}. "
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


def _variant_or_404(db: Session, project_id: UUID, variant_id: UUID) -> Variant:
    row = db.get(Variant, variant_id)
    if not row or row.project_id != project_id:
        raise HTTPException(404, "Variant not found")
    return row


@router.get("/projects/{project_id}/config-dictionary", response_model=ConfigDictionaryOut)
def get_dictionary(project_id: UUID, db: Session = Depends(get_db)):
    _project(db, project_id)
    variants = (
        db.query(Variant)
        .options(selectinload(Variant.values))
        .filter(Variant.project_id == project_id)
        .order_by(Variant.sort_order, Variant.key)
        .all()
    )
    configs = (
        db.query(ProductConfiguration)
        .filter(ProductConfiguration.project_id == project_id)
        .order_by(ProductConfiguration.name)
        .all()
    )
    rules = db.query(ConfigRule).filter(ConfigRule.project_id == project_id).order_by(ConfigRule.name).all()
    return ConfigDictionaryOut(variants=variants, configurations=configs, rules=rules)


@router.get("/projects/{project_id}/variants", response_model=list[VariantOut])
def list_variants(project_id: UUID, db: Session = Depends(get_db)):
    _project(db, project_id)
    return db.query(Variant).options(selectinload(Variant.values)).filter(Variant.project_id == project_id).order_by(Variant.sort_order, Variant.key).all()


@router.post("/projects/{project_id}/variants", response_model=VariantOut)
def create_variant(project_id: UUID, payload: VariantCreate, db: Session = Depends(get_db)):
    _project(db, project_id)
    row = Variant(
        project_id=project_id,
        key=payload.key.strip(),
        name=payload.name.strip(),
        description=payload.description,
        sort_order=payload.sort_order,
    )
    db.add(row)
    db.flush()
    for i, value in enumerate(payload.values):
        db.add(
            VariantValue(
                variant_id=row.id,
                key=value.key.strip(),
                name=value.name.strip(),
                sort_order=value.sort_order if value.sort_order else i,
            )
        )
    db.commit()
    db.refresh(row)
    return row


@router.patch("/projects/{project_id}/variants/{variant_id}", response_model=VariantOut)
def update_variant(project_id: UUID, variant_id: UUID, payload: VariantUpdate, db: Session = Depends(get_db)):
    row = _variant_or_404(db, project_id, variant_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, key, value.strip() if isinstance(value, str) else value)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/projects/{project_id}/variants/{variant_id}", status_code=204)
def delete_variant(project_id: UUID, variant_id: UUID, db: Session = Depends(get_db)):
    row = _variant_or_404(db, project_id, variant_id)
    db.delete(row)
    db.commit()
    return None


@router.post("/projects/{project_id}/variants/{variant_id}/values", response_model=VariantValueOut)
def create_variant_value(
    project_id: UUID, variant_id: UUID, payload: VariantValueCreate, db: Session = Depends(get_db)
):
    _variant_or_404(db, project_id, variant_id)
    row = VariantValue(
        variant_id=variant_id,
        key=payload.key.strip(),
        name=payload.name.strip(),
        sort_order=payload.sort_order,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/projects/{project_id}/variant-values/{value_id}", response_model=VariantValueOut)
def update_variant_value(project_id: UUID, value_id: UUID, payload: VariantValueUpdate, db: Session = Depends(get_db)):
    _project(db, project_id)
    row = db.get(VariantValue, value_id)
    if not row:
        raise HTTPException(404, "Variant value not found")
    variant = db.get(Variant, row.variant_id)
    if not variant or variant.project_id != project_id:
        raise HTTPException(404, "Variant value not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, key, value.strip() if isinstance(value, str) else value)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/projects/{project_id}/variant-values/{value_id}", status_code=204)
def delete_variant_value(project_id: UUID, value_id: UUID, db: Session = Depends(get_db)):
    _project(db, project_id)
    row = db.get(VariantValue, value_id)
    if not row:
        raise HTTPException(404, "Variant value not found")
    variant = db.get(Variant, row.variant_id)
    if not variant or variant.project_id != project_id:
        raise HTTPException(404, "Variant value not found")
    db.delete(row)
    db.commit()
    return None


@router.get("/projects/{project_id}/configurations", response_model=list[ProductConfigurationOut])
def list_configurations(project_id: UUID, db: Session = Depends(get_db)):
    _project(db, project_id)
    return (
        db.query(ProductConfiguration)
        .filter(ProductConfiguration.project_id == project_id)
        .order_by(ProductConfiguration.name)
        .all()
    )


@router.post("/projects/{project_id}/configurations", response_model=ProductConfigurationOut)
def create_configuration(project_id: UUID, payload: ProductConfigurationCreate, db: Session = Depends(get_db)):
    _project(db, project_id)
    row = ProductConfiguration(
        project_id=project_id,
        key=payload.key.strip(),
        name=payload.name.strip(),
        description=payload.description,
        selection=payload.selection,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/projects/{project_id}/configurations/{config_id}", response_model=ProductConfigurationOut)
def update_configuration(
    project_id: UUID, config_id: UUID, payload: ProductConfigurationUpdate, db: Session = Depends(get_db)
):
    row = get_configuration(db, project_id, config_id)
    if not row:
        raise HTTPException(404, "Configuration not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        if isinstance(value, str):
            setattr(row, key, value.strip())
        else:
            setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/projects/{project_id}/configurations/{config_id}", status_code=204)
def delete_configuration(project_id: UUID, config_id: UUID, db: Session = Depends(get_db)):
    row = get_configuration(db, project_id, config_id)
    if not row:
        raise HTTPException(404, "Configuration not found")
    db.delete(row)
    db.commit()
    return None


def _snapshot(db: Session, project_id: UUID, config_id: UUID) -> dict:
    selection, cfg = _ctx(db, project_id, config_id)
    arts = db.query(Artifact).filter(Artifact.project_id == project_id).all()
    keep = matched_artifact_ids(arts, selection)
    resolved = [a for a in arts if a.id in keep]
    bom = resolve_bom(db.query(BomItem).filter(BomItem.project_id == project_id).all(), selection)
    tests = [a for a in resolved if a.viewpoint == Viewpoint.T]
    reqs = [a for a in resolved if a.kind.value in {"requirement", "customer_feature", "stakeholder_need"}]
    quality = compute_quality(
        db, project_id, selection=selection, config_id=cfg.id if cfg else None, config_name=cfg.name if cfg else ""
    )
    return {
        "config": ProductConfigurationOut.model_validate(cfg).model_dump(mode="json") if cfg else None,
        "quality": quality,
        "artifacts": {str(a.id): {"id": str(a.id), "identifier": a.identifier, "title": a.title, "kind": a.kind.value, "viewpoint": a.viewpoint.value} for a in resolved},
        "requirements": [{"id": str(a.id), "identifier": a.identifier, "title": a.title} for a in reqs],
        "tests": [{"id": str(a.id), "identifier": a.identifier, "title": a.title, "status": a.status.value} for a in tests],
        "bom": [{"id": str(b.id), "part_number": b.part_number, "name": b.name, "qty": b.qty} for b in bom],
    }


@router.get("/projects/{project_id}/config-compare")
def compare_configurations(project_id: UUID, left: UUID, right: UUID, db: Session = Depends(get_db)):
    _project(db, project_id)
    a = _snapshot(db, project_id, left)
    b = _snapshot(db, project_id, right)

    def keyed(rows: list[dict], key: str) -> dict[str, dict]:
        return {row[key]: row for row in rows}

    def diff(left_rows: list[dict], right_rows: list[dict], key: str):
        lmap, rmap = keyed(left_rows, key), keyed(right_rows, key)
        only_left = [lmap[k] for k in lmap if k not in rmap]
        only_right = [rmap[k] for k in rmap if k not in lmap]
        both = [k for k in lmap if k in rmap]
        return {"only_left": only_left, "only_right": only_right, "shared": len(both)}

    return {
        "left": a["config"],
        "right": b["config"],
        "quality_left": a["quality"],
        "quality_right": b["quality"],
        "quality_delta": {
            "score": (b["quality"]["score"] or 0) - (a["quality"]["score"] or 0),
            "coverage": round((b["quality"]["coverage"] or 0) - (a["quality"]["coverage"] or 0), 1),
            "open_gaps": (b["quality"]["open_gaps"] or 0) - (a["quality"]["open_gaps"] or 0),
        },
        "requirements": diff(a["requirements"], b["requirements"], "identifier"),
        "tests": diff(a["tests"], b["tests"], "identifier"),
        "bom": diff(a["bom"], b["bom"], "part_number"),
    }


@router.get("/projects/{project_id}/search")
def global_search(
    project_id: UUID,
    q: str,
    config_id: UUID | None = None,
    limit: int = 40,
    db: Session = Depends(get_db),
):
    _project(db, project_id)
    selection, _ = _ctx(db, project_id, config_id)
    term = (q or "").strip()
    if not term:
        return {"query": q, "artifacts": [], "bom": [], "findings": []}
    like = f"%{term}%"
    arts = (
        db.query(Artifact)
        .filter(
            Artifact.project_id == project_id,
            (Artifact.identifier.ilike(like))
            | (Artifact.title.ilike(like))
            | (Artifact.owner.ilike(like))
            | (Artifact.description.ilike(like)),
        )
        .order_by(Artifact.identifier)
        .limit(200)
        .all()
    )
    arts = resolve_artifacts(arts, selection, keep_ancestors=False)[:limit]
    bom = resolve_bom(
        db.query(BomItem)
        .filter(
            BomItem.project_id == project_id,
            (BomItem.part_number.ilike(like)) | (BomItem.name.ilike(like)),
        )
        .limit(50)
        .all(),
        selection,
    )[: min(10, limit)]
    findings = [
        FindingOut.model_validate(f).model_dump(mode="json")
        for f in findings_for_view(db, project_id, selection)
        if term.lower() in (f.title or "").lower() or term.lower() in (f.detail or "").lower()
    ][:10]
    return {
        "query": term,
        "artifacts": [ArtifactOut.model_validate(a).model_dump(mode="json") for a in arts],
        "bom": [BomItemOut.model_validate(b).model_dump(mode="json") for b in bom],
        "findings": findings,
    }


@router.get("/projects/{project_id}/impact/{artifact_id}")
def impact_preview(project_id: UUID, artifact_id: UUID, db: Session = Depends(get_db)):
    art = get_artifact(db, project_id, artifact_id)
    links = db.query(TraceLink).filter(TraceLink.project_id == project_id).all()
    by_id = {a.id: a for a in db.query(Artifact).filter(Artifact.project_id == project_id).all()}
    related: dict[str, list[dict]] = {
        "upstream": [],
        "downstream": [],
        "tests": [],
        "bom": [],
    }
    seen: set[UUID] = set()
    for link in links:
        other_id = None
        bucket = None
        if link.source_id == artifact_id:
            other_id = link.target_id
            bucket = "downstream"
        elif link.target_id == artifact_id:
            other_id = link.source_id
            bucket = "upstream"
        if other_id is None or other_id in seen:
            continue
        other = by_id.get(other_id)
        if not other:
            continue
        seen.add(other_id)
        row = {
            "id": str(other.id),
            "identifier": other.identifier,
            "title": other.title,
            "kind": other.kind.value,
            "viewpoint": other.viewpoint.value,
            "status": other.status.value,
            "link_type": link.link_type.value,
        }
        if other.kind in {ArtifactKind.TEST_CASE, ArtifactKind.TEST_SPEC} or other.viewpoint == Viewpoint.T:
            related["tests"].append(row)
        else:
            related[bucket].append(row)
    for item in db.query(BomItem).filter(BomItem.project_id == project_id, BomItem.linked_artifact_id == artifact_id):
        related["bom"].append(
            {"id": str(item.id), "part_number": item.part_number, "name": item.name, "qty": item.qty}
        )
    return {
        "artifact": ArtifactOut.model_validate(art).model_dump(mode="json"),
        "counts": {k: len(v) for k, v in related.items()},
        **related,
    }


@router.get("/projects/{project_id}/report.md")
def export_report_markdown(project_id: UUID, config_id: UUID | None = None, db: Session = Depends(get_db)):
    report = get_report(project_id, config_id, db)
    lines = [
        f"# Quality report — {report.project.name}",
        "",
        f"Generated: {report.generated_at}",
        f"Score: **{report.quality.score}/100** · Coverage {report.quality.coverage}% · "
        f"Gaps {report.quality.open_gaps} · Critical {report.quality.critical}",
        "",
        "## Narrative",
        report.narrative,
        "",
        "## Missing links",
    ]
    if not report.missing_links:
        lines.append("- None")
    for m in report.missing_links:
        lines.append(f"- `{m.get('identifier')}` {m.get('title')}: {', '.join(m.get('missing') or [])}")
    lines += ["", "## Findings"]
    if not report.findings:
        lines.append("- None")
    for f in report.findings:
        lines.append(f"- **{f.severity}** {f.title} — {f.detail}")
    lines += ["", "## V-model stations"]
    for n in report.v_model:
        lines.append(
            f"- {n.name} ({n.domain}): progress {n.progress}%, coverage {n.coverage}%, gaps {n.gaps}"
        )
    body = "\n".join(lines) + "\n"
    return PlainTextResponse(body, media_type="text/markdown; charset=utf-8")


@router.post("/projects/{project_id}/import/requirements")
def import_requirements(project_id: UUID, payload: RequirementImportIn, db: Session = Depends(get_db)):
    _project(db, project_id)
    created = []
    for row in payload.rows:
        existing = (
            db.query(Artifact)
            .filter(Artifact.project_id == project_id, Artifact.identifier == row.identifier.strip())
            .first()
        )
        if existing:
            existing.title = row.title.strip()
            existing.description = row.description
            existing.owner = row.owner
            created.append(existing)
            continue
        art = make_artifact(
            db,
            project_id,
            identifier=row.identifier,
            title=row.title,
            description=row.description,
            viewpoint=Viewpoint.R,
            kind=parse_enum(ArtifactKind, row.kind, "kind"),
            domain=parse_enum(Domain, row.domain, "domain"),
            owner=row.owner,
            v_node_key=row.v_node_key or "system_req",
            progress=10,
            status=LifecycleStatus.DRAFT,
        )
        created.append(art)
    db.commit()
    return {"created": len(created), "artifacts": [ArtifactOut.model_validate(a) for a in created]}


@router.post("/projects/{project_id}/bulk/status")
def bulk_status(project_id: UUID, payload: BulkStatusIn, db: Session = Depends(get_db)):
    _project(db, project_id)
    status = parse_enum(LifecycleStatus, payload.status, "status")
    updated = 0
    for aid in payload.artifact_ids:
        row = get_artifact(db, project_id, aid)
        row.status = status
        if payload.progress is not None:
            row.progress = max(0, min(100, int(payload.progress)))
        updated += 1
    db.commit()
    return {"updated": updated}


@router.post("/projects/{project_id}/bulk/links")
def bulk_links(project_id: UUID, payload: BulkLinkIn, db: Session = Depends(get_db)):
    _project(db, project_id)
    get_artifact(db, project_id, payload.target_id)
    link_type = parse_enum(LinkType, payload.link_type, "link_type")
    created = []
    for sid in payload.source_ids:
        get_artifact(db, project_id, sid)
        row = add_link(db, project_id, sid, payload.target_id, link_type)
        created.append(serialize_link(db, row))
    db.commit()
    return {"created": len(created), "links": created}


@router.get("/projects/{project_id}/config-rules", response_model=list[ConfigRuleOut])
def list_config_rules(project_id: UUID, db: Session = Depends(get_db)):
    _project(db, project_id)
    return db.query(ConfigRule).filter(ConfigRule.project_id == project_id).order_by(ConfigRule.name).all()


@router.post("/projects/{project_id}/config-rules", response_model=ConfigRuleOut)
def create_config_rule(project_id: UUID, payload: ConfigRuleCreate, db: Session = Depends(get_db)):
    _project(db, project_id)
    if payload.rule_type not in {"exclude", "require"}:
        raise HTTPException(400, "rule_type must be exclude or require")
    row = ConfigRule(
        project_id=project_id,
        name=payload.name.strip(),
        rule_type=payload.rule_type,
        when_expr=payload.when_expr,
        then_expr=payload.then_expr,
        description=payload.description,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/projects/{project_id}/config-rules/{rule_id}", status_code=204)
def delete_config_rule(project_id: UUID, rule_id: UUID, db: Session = Depends(get_db)):
    _project(db, project_id)
    row = db.get(ConfigRule, rule_id)
    if not row or row.project_id != project_id:
        raise HTTPException(404, "Rule not found")
    db.delete(row)
    db.commit()
    return None


@router.get("/projects/{project_id}/config-validate")
def validate_configuration(project_id: UUID, config_id: UUID, db: Session = Depends(get_db)):
    """Check named SKU against config rules (exclude/require)."""
    selection, cfg = _ctx(db, project_id, config_id)
    if not cfg or selection is None:
        raise HTTPException(404, "Configuration not found")
    rules = db.query(ConfigRule).filter(ConfigRule.project_id == project_id).all()
    violations = []
    for rule in rules:
        when = rule.when_expr or {}
        then = rule.then_expr or {}
        when_hit = all(selection.get(k) in (v if isinstance(v, list) else [v]) for k, v in when.items())
        if not when_hit:
            continue
        if rule.rule_type == "exclude":
            for k, v in then.items():
                allowed = v if isinstance(v, list) else [v]
                if selection.get(k) in allowed:
                    violations.append(
                        {
                            "rule": rule.name,
                            "rule_type": rule.rule_type,
                            "detail": f"{cfg.name} selects {k}={selection.get(k)} which is excluded when {when}",
                        }
                    )
        elif rule.rule_type == "require":
            for k, v in then.items():
                allowed = v if isinstance(v, list) else [v]
                if selection.get(k) not in allowed:
                    violations.append(
                        {
                            "rule": rule.name,
                            "rule_type": rule.rule_type,
                            "detail": f"{cfg.name} must set {k} to one of {allowed}",
                        }
                    )
    return {"config": ProductConfigurationOut.model_validate(cfg), "ok": not violations, "violations": violations}
