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
    with_v_model: bool = True


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    product_type: Optional[str] = None
    description: Optional[str] = None


class ArtifactCreate(BaseModel):
    identifier: str
    title: str
    description: str = ""
    viewpoint: str = "R"
    domain: str = "system"
    kind: str = "requirement"
    status: str = "draft"
    owner: str = ""
    v_node_key: str = ""
    progress: int = 10
    parent_id: Optional[UUID] = None
    extra: dict[str, Any] = Field(default_factory=dict)
    effectivity: dict[str, Any] = Field(default_factory=dict)


class ArtifactUpdate(BaseModel):
    identifier: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    viewpoint: Optional[str] = None
    domain: Optional[str] = None
    kind: Optional[str] = None
    status: Optional[str] = None
    owner: Optional[str] = None
    v_node_key: Optional[str] = None
    progress: Optional[int] = None
    parent_id: Optional[UUID] = None
    extra: Optional[dict[str, Any]] = None
    effectivity: Optional[dict[str, Any]] = None


class TraceLinkCreate(BaseModel):
    source_id: UUID
    target_id: UUID
    link_type: str = "allocates"


class BomItemCreate(BaseModel):
    part_number: str
    name: str
    qty: float = 1
    unit: str = "ea"
    category: str = "electrical"
    supplier: str = ""
    linked_artifact_id: Optional[UUID] = None
    extra: dict[str, Any] = Field(default_factory=dict)
    effectivity: dict[str, Any] = Field(default_factory=dict)


class BomItemUpdate(BaseModel):
    part_number: Optional[str] = None
    name: Optional[str] = None
    qty: Optional[float] = None
    unit: Optional[str] = None
    category: Optional[str] = None
    supplier: Optional[str] = None
    linked_artifact_id: Optional[UUID] = None
    extra: Optional[dict[str, Any]] = None
    effectivity: Optional[dict[str, Any]] = None


class DiagramWrite(BaseModel):
    identifier: str
    title: str
    description: str = ""
    lanes: list[dict[str, Any]] = Field(default_factory=list)
    nodes: list[dict[str, Any]] = Field(default_factory=list)
    edges: list[dict[str, Any]] = Field(default_factory=list)
    notes: list[dict[str, Any]] = Field(default_factory=list)
    allocate_from_ids: list[UUID] = Field(default_factory=list)


class ProjectWizardIn(BaseModel):
    name: str
    product_type: str = "complex product"
    description: str = ""
    owner: str = ""
    first_feature: str = ""
    first_requirement: str = ""
    first_function: str = ""


class RequirementWizardIn(BaseModel):
    identifier: str
    title: str
    description: str = ""
    kind: str = "requirement"
    domain: str = "system"
    owner: str = ""
    parent_id: Optional[UUID] = None
    refines_from_id: Optional[UUID] = None
    v_node_key: str = "system_req"
    status: str = "draft"
    progress: int = 10


class FunctionWizardIn(BaseModel):
    identifier: str
    title: str
    description: str = ""
    owner: str = ""
    allocate_from_ids: list[UUID] = Field(default_factory=list)
    with_diagram: bool = True
    lanes: list[str] = Field(default_factory=lambda: ["Sense", "Decide", "Act"])
    parent_id: Optional[UUID] = None


class LogicalWizardIn(BaseModel):
    identifier: str
    title: str
    description: str = ""
    owner: str = ""
    allocate_from_ids: list[UUID] = Field(default_factory=list)
    v_node_key: str = "system_architecture"
    parent_id: Optional[UUID] = None


class PhysicalWizardIn(BaseModel):
    identifier: str
    title: str
    description: str = ""
    kind: str = "sw_component"
    domain: str = "software"
    owner: str = ""
    implement_from_ids: list[UUID] = Field(default_factory=list)
    v_node_key: str = "sw_architecture"


class VerificationWizardIn(BaseModel):
    identifier: str
    title: str
    description: str = ""
    kind: str = "test_case"
    v_node_key: str = "system_verification"
    verifies_id: Optional[UUID] = None
    validates_id: Optional[UUID] = None
    owner: str = ""
    verdict: str = "draft"
    subjects: list[str] = Field(default_factory=list)
    progress: Optional[int] = None


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
    effectivity: dict[str, Any] = Field(default_factory=dict)


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
    effectivity: dict[str, Any] = Field(default_factory=dict)


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
    config_id: Optional[str] = None
    config_name: str = ""
    mode: str = "150"


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


class ArtifactWizardOut(BaseModel):
    created: list[ArtifactOut]
    links: list[TraceLinkOut] = Field(default_factory=list)


class VariantValueCreate(BaseModel):
    key: str
    name: str
    sort_order: int = 0


class VariantValueUpdate(BaseModel):
    key: Optional[str] = None
    name: Optional[str] = None
    sort_order: Optional[int] = None


class VariantCreate(BaseModel):
    key: str
    name: str
    description: str = ""
    sort_order: int = 0
    values: list[VariantValueCreate] = Field(default_factory=list)


class VariantUpdate(BaseModel):
    key: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None


class VariantValueOut(OrmModel):
    id: UUID
    variant_id: UUID
    key: str
    name: str
    sort_order: int


class VariantOut(OrmModel):
    id: UUID
    project_id: UUID
    key: str
    name: str
    description: str
    sort_order: int
    values: list[VariantValueOut] = Field(default_factory=list)


class ProductConfigurationCreate(BaseModel):
    key: str
    name: str
    description: str = ""
    selection: dict[str, Any] = Field(default_factory=dict)


class ProductConfigurationUpdate(BaseModel):
    key: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    selection: Optional[dict[str, Any]] = None


class ProductConfigurationOut(OrmModel):
    id: UUID
    project_id: UUID
    key: str
    name: str
    description: str
    selection: dict[str, Any] = Field(default_factory=dict)


class ConfigRuleCreate(BaseModel):
    name: str
    rule_type: str = "exclude"
    when_expr: dict[str, Any] = Field(default_factory=dict)
    then_expr: dict[str, Any] = Field(default_factory=dict)
    description: str = ""


class ConfigRuleOut(OrmModel):
    id: UUID
    project_id: UUID
    name: str
    rule_type: str
    when_expr: dict[str, Any] = Field(default_factory=dict)
    then_expr: dict[str, Any] = Field(default_factory=dict)
    description: str


class ConfigDictionaryOut(BaseModel):
    variants: list[VariantOut]
    configurations: list[ProductConfigurationOut]
    rules: list[ConfigRuleOut] = Field(default_factory=list)


class EffectivityPatch(BaseModel):
    effectivity: dict[str, Any] = Field(default_factory=dict)


class RequirementImportRow(BaseModel):
    identifier: str
    title: str
    description: str = ""
    kind: str = "requirement"
    domain: str = "system"
    owner: str = ""
    v_node_key: str = "system_req"


class RequirementImportIn(BaseModel):
    rows: list[RequirementImportRow] = Field(default_factory=list)


class BulkStatusIn(BaseModel):
    artifact_ids: list[UUID]
    status: str
    progress: Optional[int] = None


class BulkLinkIn(BaseModel):
    source_ids: list[UUID]
    target_id: UUID
    link_type: str = "allocates"
