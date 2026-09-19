from __future__ import annotations

from typing import Any, Optional, TypeVar
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import (
    Artifact,
    ArtifactKind,
    BomItem,
    Domain,
    LifecycleStatus,
    LinkType,
    Project,
    QualityFinding,
    TraceLink,
    Viewpoint,
)
from app.schemas import ArtifactOut, TraceLinkOut

E = TypeVar("E")


def parse_enum(enum_cls: type, value: str, field: str):
    try:
        return enum_cls(value)
    except ValueError as exc:
        allowed = ", ".join(i.value for i in enum_cls)
        raise HTTPException(400, f"Invalid {field} '{value}'. Allowed: {allowed}") from exc


def unique_slug(db: Session, base: str) -> str:
    slug = (base or "project")[:80]
    n = 1
    while db.query(Project).filter(Project.slug == slug).first():
        n += 1
        slug = f"{base[:70]}-{n}"
    return slug


def get_artifact(db: Session, project_id: UUID, artifact_id: UUID) -> Artifact:
    row = db.get(Artifact, artifact_id)
    if not row or row.project_id != project_id:
        raise HTTPException(404, "Artifact not found")
    return row


def serialize_link(db: Session, link: TraceLink) -> TraceLinkOut:
    src = db.get(Artifact, link.source_id)
    dst = db.get(Artifact, link.target_id)
    return TraceLinkOut(
        id=link.id,
        source_id=link.source_id,
        target_id=link.target_id,
        link_type=link.link_type.value,
        source_identifier=src.identifier if src else "",
        source_title=src.title if src else "",
        target_identifier=dst.identifier if dst else "",
        target_title=dst.title if dst else "",
    )


def add_link(db: Session, project_id: UUID, source_id: UUID, target_id: UUID, link_type: LinkType) -> TraceLink:
    if source_id == target_id:
        raise HTTPException(400, "A link cannot point at itself")
    existing = (
        db.query(TraceLink)
        .filter(
            TraceLink.project_id == project_id,
            TraceLink.source_id == source_id,
            TraceLink.target_id == target_id,
            TraceLink.link_type == link_type,
        )
        .first()
    )
    if existing:
        return existing
    row = TraceLink(project_id=project_id, source_id=source_id, target_id=target_id, link_type=link_type)
    db.add(row)
    db.flush()
    return row


def make_artifact(
    db: Session,
    project_id: UUID,
    *,
    identifier: str,
    title: str,
    viewpoint: Viewpoint,
    kind: ArtifactKind,
    domain: Domain = Domain.SYSTEM,
    status: LifecycleStatus = LifecycleStatus.DRAFT,
    owner: str = "",
    v_node_key: str = "",
    progress: int = 10,
    description: str = "",
    parent_id: Optional[UUID] = None,
    extra: Optional[dict[str, Any]] = None,
) -> Artifact:
    if parent_id:
        get_artifact(db, project_id, parent_id)
    row = Artifact(
        project_id=project_id,
        parent_id=parent_id,
        identifier=identifier.strip(),
        title=title.strip(),
        description=description,
        viewpoint=viewpoint,
        domain=domain,
        kind=kind,
        status=status,
        owner=owner,
        v_node_key=v_node_key,
        progress=max(0, min(100, progress)),
        extra=extra or {},
    )
    db.add(row)
    db.flush()
    return row


def apply_artifact_fields(row: Artifact, data: dict[str, Any]) -> None:
    mapping = {
        "viewpoint": Viewpoint,
        "domain": Domain,
        "kind": ArtifactKind,
        "status": LifecycleStatus,
    }
    for key, value in data.items():
        if value is None and key != "parent_id":
            continue
        if key in mapping:
            setattr(row, key, parse_enum(mapping[key], value, key))
        elif key == "progress":
            row.progress = max(0, min(100, int(value)))
        elif key == "extra" and value is not None:
            row.extra = value
        else:
            setattr(row, key, value)


def delete_artifact(db: Session, project_id: UUID, artifact_id: UUID) -> None:
    row = get_artifact(db, project_id, artifact_id)
    children = db.query(Artifact).filter(Artifact.parent_id == artifact_id).all()
    for child in children:
        delete_artifact(db, project_id, child.id)
    db.query(TraceLink).filter((TraceLink.source_id == artifact_id) | (TraceLink.target_id == artifact_id)).delete()
    db.query(QualityFinding).filter(QualityFinding.artifact_id == artifact_id).delete()
    db.query(BomItem).filter(BomItem.linked_artifact_id == artifact_id).update({BomItem.linked_artifact_id: None})
    db.delete(row)
    db.flush()


def slug_lane(title: str, index: int) -> str:
    raw = "".join(ch.lower() if ch.isalnum() else "-" for ch in title).strip("-")
    return (raw or f"lane-{index}")[:40]


def diagram_extra(lanes: list[str], nodes: list[dict] | None = None, edges: list[dict] | None = None) -> dict[str, Any]:
    lane_objs = []
    for i, title in enumerate(lanes or ["Sense", "Decide", "Act"]):
        lane_objs.append({"id": slug_lane(title, i), "title": title, "subtitle": ""})
    return {"lanes": lane_objs, "nodes": nodes or [], "edges": edges or [], "notes": []}


def out_art(row: Artifact) -> ArtifactOut:
    return ArtifactOut.model_validate(row)
