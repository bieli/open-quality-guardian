from __future__ import annotations

from typing import Any, Iterable, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import Artifact, BomItem, ProductConfiguration


def matches_effectivity(expr: dict[str, Any] | None, selection: dict[str, Any] | None) -> bool:
    """Include if no effectivity, or every dictionary dimension matches the active configuration."""
    if not expr:
        return True
    if not selection:
        return False
    for dim, allowed in expr.items():
        if not allowed:
            return False
        chosen = selection.get(dim)
        if chosen not in allowed:
            return False
    return True


def get_configuration(db: Session, project_id: UUID, config_id: UUID | None) -> ProductConfiguration | None:
    if not config_id:
        return None
    row = db.get(ProductConfiguration, config_id)
    if not row or row.project_id != project_id:
        raise HTTPException(404, "Configuration not found")
    return row


def resolve_artifacts(
    artifacts: Iterable[Artifact],
    selection: dict[str, Any] | None,
    *,
    keep_ancestors: bool = False,
) -> list[Artifact]:
    items = list(artifacts)
    if not selection:
        return items
    matched = {a.id for a in items if matches_effectivity(a.effectivity, selection)}
    if keep_ancestors:
        by_id = {a.id: a for a in items}
        extra: set[UUID] = set()
        for aid in list(matched):
            parent_id = by_id[aid].parent_id if aid in by_id else None
            while parent_id and parent_id not in matched and parent_id not in extra:
                extra.add(parent_id)
                parent = by_id.get(parent_id)
                parent_id = parent.parent_id if parent else None
        matched |= extra
    return [a for a in items if a.id in matched]


def resolve_bom(items: Iterable[BomItem], selection: dict[str, Any] | None) -> list[BomItem]:
    if not selection:
        return list(items)
    return [row for row in items if matches_effectivity(row.effectivity, selection)]


def matched_artifact_ids(artifacts: Iterable[Artifact], selection: dict[str, Any] | None) -> set[UUID]:
    """IDs that themselves match (no ancestor padding). Used by quality and trace links."""
    items = list(artifacts)
    if not selection:
        return {a.id for a in items}
    return {a.id for a in items if matches_effectivity(a.effectivity, selection)}


def load_selection(db: Session, project_id: UUID, config_id: UUID | None) -> dict[str, Any] | None:
    cfg = get_configuration(db, project_id, config_id)
    if not cfg:
        return None
    return dict(cfg.selection or {})


def summarize_effectivity(expr: dict[str, Any] | None) -> str:
    if not expr:
        return "common"
    parts = []
    for key, values in expr.items():
        parts.append(f"{key}={'|'.join(str(v) for v in values)}")
    return ", ".join(parts)
