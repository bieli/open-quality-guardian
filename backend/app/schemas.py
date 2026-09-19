from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ProjectCreate(BaseModel):
    name: str
    product_type: str = "complex product"
    description: str = ""
    slug: Optional[str] = None


class ProjectOut(OrmModel):
    id: UUID
    slug: str
    name: str
    product_type: str
    description: str
    created_at: datetime


class ArtifactOut(OrmModel):
    id: UUID
    project_id: UUID
    parent_id: Optional[UUID]
    identifier: str
    title: str
    description: str
    viewpoint: str
    domain: str
    kind: str
    status: str
    owner: str
    v_node_key: str
    progress: int
    extra: dict[str, Any] = Field(default_factory=dict)


class ArtifactTree(ArtifactOut):
    children: list[ArtifactTree] = Field(default_factory=list)


class TraceLinkOut(OrmModel):
    id: UUID
    source_id: UUID
    target_id: UUID
    link_type: str
    source_identifier: str = ""
    source_title: str = ""
    target_identifier: str = ""
    target_title: str = ""


class VModelNodeOut(OrmModel):
    id: UUID
    key: str
    name: str
    domain: str
    side: str
    row: int
    counterpart_key: str
    description: str
    artifact_count: int = 0
    coverage: float = 0
    progress: float = 0
    verified: int = 0
    gaps: int = 0
    status: str = "draft"


class BomItemOut(OrmModel):
    id: UUID
    part_number: str
    name: str
    qty: float
    unit: str
    category: str
    supplier: str
    linked_artifact_id: Optional[UUID]
    extra: dict[str, Any] = Field(default_factory=dict)


class FindingOut(OrmModel):
    id: UUID
    artifact_id: Optional[UUID]
    rule: str
    severity: str
    title: str
    detail: str
    status: str


class QualitySummary(BaseModel):
    score: int
    coverage: float
    progress: float
    requirements: int
    verified_requirements: int
    tests: int
    tests_passed: int
    open_gaps: int
    critical: int
    by_viewpoint: dict[str, dict[str, float]]
    by_domain: dict[str, dict[str, float]]


class DiagramOut(BaseModel):
    id: UUID
    identifier: str
    title: str
    description: str
    lanes: list[dict[str, Any]]
    nodes: list[dict[str, Any]]
    edges: list[dict[str, Any]]
    notes: list[dict[str, Any]] = Field(default_factory=list)


class ReportOut(BaseModel):
    project: ProjectOut
    generated_at: str
    quality: QualitySummary
    v_model: list[VModelNodeOut]
    findings: list[FindingOut]
    missing_links: list[dict[str, Any]]
    narrative: str
