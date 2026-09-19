from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.crud import (
    add_link,
    diagram_extra,
    make_artifact,
    parse_enum,
    serialize_link,
    unique_slug,
)
from app.database import get_db
from app.models import ArtifactKind, Domain, LifecycleStatus, LinkType, Project, Viewpoint
from app.schemas import (
    ArtifactWizardOut,
    FunctionWizardIn,
    LogicalWizardIn,
    PhysicalWizardIn,
    ProjectOut,
    ProjectWizardIn,
    RequirementWizardIn,
    VerificationWizardIn,
)
from app.seed import _slugify, seed_v_model

router = APIRouter()

KIND_VNODE = {
    "customer_feature": ("stakeholder_req", Viewpoint.R, Domain.SYSTEM),
    "stakeholder_need": ("stakeholder_req", Viewpoint.R, Domain.SYSTEM),
    "requirement": ("system_req", Viewpoint.R, Domain.SYSTEM),
}


def _project(db: Session, project_id: UUID) -> Project:
    from fastapi import HTTPException

    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return project


@router.post("/wizards/project", response_model=ProjectOut)
def wizard_project(payload: ProjectWizardIn, db: Session = Depends(get_db)):
    slug = unique_slug(db, _slugify(payload.name))
    project = Project(
        name=payload.name.strip(),
        product_type=payload.product_type.strip() or "complex product",
        description=payload.description,
        slug=slug,
    )
    db.add(project)
    db.flush()
    seed_v_model(db, project)
    owner = payload.owner
    if payload.first_feature:
        feature = make_artifact(
            db,
            project.id,
            identifier="CF-1",
            title=payload.first_feature,
            viewpoint=Viewpoint.R,
            kind=ArtifactKind.CUSTOMER_FEATURE,
            v_node_key="stakeholder_req",
            owner=owner,
            status=LifecycleStatus.DRAFT,
        )
        if payload.first_requirement:
            req = make_artifact(
                db,
                project.id,
                identifier="SYS-1",
                title=payload.first_requirement,
                viewpoint=Viewpoint.R,
                kind=ArtifactKind.REQUIREMENT,
                v_node_key="system_req",
                owner=owner,
            )
            add_link(db, project.id, feature.id, req.id, LinkType.REFINES)
            if payload.first_function:
                fn = make_artifact(
                    db,
                    project.id,
                    identifier="F-1",
                    title=payload.first_function,
                    viewpoint=Viewpoint.F,
                    kind=ArtifactKind.FUNCTION,
                    v_node_key="system_architecture",
                    owner=owner,
                    extra=diagram_extra(["Sense", "Decide", "Act"]),
                )
                add_link(db, project.id, req.id, fn.id, LinkType.ALLOCATES)
    db.commit()
    db.refresh(project)
    return project


@router.post("/projects/{project_id}/wizards/requirement", response_model=ArtifactWizardOut)
def wizard_requirement(project_id: UUID, payload: RequirementWizardIn, db: Session = Depends(get_db)):
    _project(db, project_id)
    kind = parse_enum(ArtifactKind, payload.kind, "kind")
    domain = parse_enum(Domain, payload.domain, "domain")
    status = parse_enum(LifecycleStatus, payload.status, "status")
    defaults = KIND_VNODE.get(kind.value, ("system_req", Viewpoint.R, domain))
    v_node = payload.v_node_key or defaults[0]
    viewpoint = Viewpoint.R
    if domain == Domain.SOFTWARE and kind == ArtifactKind.REQUIREMENT:
        v_node = payload.v_node_key or "sw_req"
    if domain == Domain.HARDWARE and kind == ArtifactKind.REQUIREMENT:
        v_node = payload.v_node_key or "hw_req"
    art = make_artifact(
        db,
        project_id,
        identifier=payload.identifier,
        title=payload.title,
        description=payload.description,
        viewpoint=viewpoint,
        kind=kind,
        domain=domain,
        status=status,
        owner=payload.owner,
        v_node_key=v_node,
        progress=payload.progress,
        parent_id=payload.parent_id,
    )
    links = []
    if payload.refines_from_id:
        links.append(add_link(db, project_id, payload.refines_from_id, art.id, LinkType.REFINES))
    db.commit()
    db.refresh(art)
    return ArtifactWizardOut(created=[art], links=[serialize_link(db, l) for l in links])


@router.post("/projects/{project_id}/wizards/function", response_model=ArtifactWizardOut)
def wizard_function(project_id: UUID, payload: FunctionWizardIn, db: Session = Depends(get_db)):
    _project(db, project_id)
    extra = diagram_extra(payload.lanes) if payload.with_diagram else {}
    art = make_artifact(
        db,
        project_id,
        identifier=payload.identifier,
        title=payload.title,
        description=payload.description,
        viewpoint=Viewpoint.F,
        kind=ArtifactKind.FUNCTION,
        v_node_key="system_architecture",
        owner=payload.owner,
        parent_id=payload.parent_id,
        extra=extra,
        status=LifecycleStatus.IN_PROGRESS,
        progress=15,
    )
    links = []
    for src in payload.allocate_from_ids:
        links.append(add_link(db, project_id, src, art.id, LinkType.ALLOCATES))
    db.commit()
    db.refresh(art)
    return ArtifactWizardOut(created=[art], links=[serialize_link(db, l) for l in links])


@router.post("/projects/{project_id}/wizards/logical", response_model=ArtifactWizardOut)
def wizard_logical(project_id: UUID, payload: LogicalWizardIn, db: Session = Depends(get_db)):
    _project(db, project_id)
    art = make_artifact(
        db,
        project_id,
        identifier=payload.identifier,
        title=payload.title,
        description=payload.description,
        viewpoint=Viewpoint.L,
        kind=ArtifactKind.LOGICAL_BLOCK,
        v_node_key=payload.v_node_key or "system_architecture",
        owner=payload.owner,
        parent_id=payload.parent_id,
        status=LifecycleStatus.IN_PROGRESS,
        progress=15,
    )
    links = []
    for src in payload.allocate_from_ids:
        links.append(add_link(db, project_id, src, art.id, LinkType.ALLOCATES))
    db.commit()
    db.refresh(art)
    return ArtifactWizardOut(created=[art], links=[serialize_link(db, l) for l in links])


@router.post("/projects/{project_id}/wizards/physical", response_model=ArtifactWizardOut)
def wizard_physical(project_id: UUID, payload: PhysicalWizardIn, db: Session = Depends(get_db)):
    _project(db, project_id)
    kind = parse_enum(ArtifactKind, payload.kind, "kind")
    domain = parse_enum(Domain, payload.domain, "domain")
    v_node = payload.v_node_key
    if not v_node:
        v_node = "sw_architecture" if domain == Domain.SOFTWARE else "hw_architecture"
    art = make_artifact(
        db,
        project_id,
        identifier=payload.identifier,
        title=payload.title,
        description=payload.description,
        viewpoint=Viewpoint.P,
        kind=kind,
        domain=domain,
        v_node_key=v_node,
        owner=payload.owner,
        status=LifecycleStatus.IN_PROGRESS,
        progress=15,
    )
    links = []
    for src in payload.implement_from_ids:
        links.append(add_link(db, project_id, src, art.id, LinkType.IMPLEMENTS))
    db.commit()
    db.refresh(art)
    return ArtifactWizardOut(created=[art], links=[serialize_link(db, l) for l in links])


@router.post("/projects/{project_id}/wizards/verification", response_model=ArtifactWizardOut)
def wizard_verification(project_id: UUID, payload: VerificationWizardIn, db: Session = Depends(get_db)):
    _project(db, project_id)
    kind = parse_enum(ArtifactKind, payload.kind, "kind")
    verdict = parse_enum(LifecycleStatus, payload.verdict, "verdict")
    progress = payload.progress
    if progress is None:
        progress = 100 if verdict == LifecycleStatus.VERIFIED else 40 if verdict == LifecycleStatus.IN_PROGRESS else 10
    domain = Domain.SYSTEM
    if payload.v_node_key.startswith("sw_"):
        domain = Domain.SOFTWARE
    elif payload.v_node_key.startswith("hw_"):
        domain = Domain.HARDWARE
    art = make_artifact(
        db,
        project_id,
        identifier=payload.identifier,
        title=payload.title,
        description=payload.description,
        viewpoint=Viewpoint.T,
        kind=kind,
        domain=domain,
        status=verdict,
        owner=payload.owner,
        v_node_key=payload.v_node_key,
        progress=progress,
        extra={"subjects": payload.subjects},
    )
    links = []
    if payload.verifies_id:
        links.append(add_link(db, project_id, art.id, payload.verifies_id, LinkType.VERIFIES))
    if payload.validates_id:
        links.append(add_link(db, project_id, art.id, payload.validates_id, LinkType.VALIDATES))
    db.commit()
    db.refresh(art)
    return ArtifactWizardOut(created=[art], links=[serialize_link(db, l) for l in links])
