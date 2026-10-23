from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import (
    JSON,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def uid() -> uuid.UUID:
    return uuid.uuid4()


def enum_values(enum_cls):
    return [item.value for item in enum_cls]


def enum_col(enum_cls):
    return Enum(enum_cls, native_enum=False, values_callable=enum_values)


class Viewpoint(str, enum.Enum):
    R = "R"
    F = "F"
    L = "L"
    P = "P"
    T = "T"
    A = "A"


class Domain(str, enum.Enum):
    SYSTEM = "system"
    SOFTWARE = "software"
    HARDWARE = "hardware"
    MECHANICAL = "mechanical"
    ELECTRICAL = "electrical"
    PRODUCT = "product"


class ArtifactKind(str, enum.Enum):
    STAKEHOLDER_NEED = "stakeholder_need"
    CUSTOMER_FEATURE = "customer_feature"
    REQUIREMENT = "requirement"
    FUNCTION = "function"
    ACTION = "action"
    LOGICAL_BLOCK = "logical_block"
    SW_COMPONENT = "sw_component"
    HW_COMPONENT = "hw_component"
    TEST_SPEC = "test_spec"
    TEST_CASE = "test_case"
    BOM = "bom"
    CAD = "cad"
    KICAD_SCH = "kicad_sch"
    KICAD_PCB = "kicad_pcb"
    ELECTRICAL = "electrical"
    MODEL_3D = "model_3d"
    SPECIFICATION = "specification"
    DIAGRAM = "diagram"
    DOCUMENT = "document"


class LifecycleStatus(str, enum.Enum):
    DRAFT = "draft"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    IN_PROGRESS = "in_progress"
    IMPLEMENTED = "implemented"
    VERIFIED = "verified"
    FAILED = "failed"
    BLOCKED = "blocked"


class LinkType(str, enum.Enum):
    SATISFIES = "satisfies"
    REFINES = "refines"
    ALLOCATES = "allocates"
    IMPLEMENTS = "implements"
    VERIFIES = "verifies"
    VALIDATES = "validates"
    DERIVES = "derives"
    TRACES = "traces"


class VSide(str, enum.Enum):
    DESIGN = "design"
    VERIFY = "verify"
    INTEGRATION = "integration"


class FindingSeverity(str, enum.Enum):
    INFO = "info"
    WARNING = "warning"
    GAP = "gap"
    CRITICAL = "critical"


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    product_type: Mapped[str] = mapped_column(String(120), default="complex product")
    description: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    artifacts: Mapped[list[Artifact]] = relationship(back_populates="project", cascade="all, delete-orphan")
    links: Mapped[list[TraceLink]] = relationship(back_populates="project", cascade="all, delete-orphan")
    v_nodes: Mapped[list[VModelNode]] = relationship(back_populates="project", cascade="all, delete-orphan")
    bom_items: Mapped[list[BomItem]] = relationship(back_populates="project", cascade="all, delete-orphan")
    findings: Mapped[list[QualityFinding]] = relationship(back_populates="project", cascade="all, delete-orphan")
    variants: Mapped[list[Variant]] = relationship(back_populates="project", cascade="all, delete-orphan")
    configurations: Mapped[list[ProductConfiguration]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    config_rules: Mapped[list[ConfigRule]] = relationship(back_populates="project", cascade="all, delete-orphan")


class Artifact(Base):
    __tablename__ = "artifacts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"), index=True)
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("artifacts.id"), nullable=True)
    identifier: Mapped[str] = mapped_column(String(80), index=True)
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text, default="")
    viewpoint: Mapped[Viewpoint] = mapped_column(enum_col(Viewpoint))
    domain: Mapped[Domain] = mapped_column(enum_col(Domain), default=Domain.SYSTEM)
    kind: Mapped[ArtifactKind] = mapped_column(enum_col(ArtifactKind))
    status: Mapped[LifecycleStatus] = mapped_column(enum_col(LifecycleStatus), default=LifecycleStatus.DRAFT)
    owner: Mapped[str] = mapped_column(String(120), default="")
    v_node_key: Mapped[str] = mapped_column(String(80), default="")
    progress: Mapped[int] = mapped_column(Integer, default=0)
    extra: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    effectivity: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    project: Mapped[Project] = relationship(back_populates="artifacts")
    parent: Mapped[Optional[Artifact]] = relationship(remote_side="Artifact.id", back_populates="children")
    children: Mapped[list[Artifact]] = relationship(back_populates="parent")
    files: Mapped[list[FileAsset]] = relationship(back_populates="artifact", cascade="all, delete-orphan")


class TraceLink(Base):
    __tablename__ = "trace_links"
    __table_args__ = (UniqueConstraint("project_id", "source_id", "target_id", "link_type"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"), index=True)
    source_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("artifacts.id"), index=True)
    target_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("artifacts.id"), index=True)
    link_type: Mapped[LinkType] = mapped_column(enum_col(LinkType))

    project: Mapped[Project] = relationship(back_populates="links")
    source: Mapped[Artifact] = relationship(foreign_keys=[source_id])
    target: Mapped[Artifact] = relationship(foreign_keys=[target_id])


class VModelNode(Base):
    __tablename__ = "v_model_nodes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"), index=True)
    key: Mapped[str] = mapped_column(String(80))
    name: Mapped[str] = mapped_column(String(200))
    domain: Mapped[Domain] = mapped_column(enum_col(Domain))
    side: Mapped[VSide] = mapped_column(enum_col(VSide))
    row: Mapped[int] = mapped_column(Integer)
    counterpart_key: Mapped[str] = mapped_column(String(80), default="")
    description: Mapped[str] = mapped_column(Text, default="")

    project: Mapped[Project] = relationship(back_populates="v_nodes")


class BomItem(Base):
    __tablename__ = "bom_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"), index=True)
    part_number: Mapped[str] = mapped_column(String(80))
    name: Mapped[str] = mapped_column(String(200))
    qty: Mapped[float] = mapped_column(Float, default=1)
    unit: Mapped[str] = mapped_column(String(20), default="ea")
    category: Mapped[str] = mapped_column(String(80), default="electrical")
    supplier: Mapped[str] = mapped_column(String(120), default="")
    linked_artifact_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("artifacts.id"), nullable=True)
    extra: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    effectivity: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    project: Mapped[Project] = relationship(back_populates="bom_items")


class FileAsset(Base):
    __tablename__ = "file_assets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    artifact_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("artifacts.id"), index=True)
    filename: Mapped[str] = mapped_column(String(260))
    mime: Mapped[str] = mapped_column(String(120), default="application/octet-stream")
    path: Mapped[str] = mapped_column(String(500))
    kind: Mapped[str] = mapped_column(String(40), default="attachment")

    artifact: Mapped[Artifact] = relationship(back_populates="files")


class QualityFinding(Base):
    __tablename__ = "quality_findings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"), index=True)
    artifact_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("artifacts.id"), nullable=True)
    rule: Mapped[str] = mapped_column(String(80))
    severity: Mapped[FindingSeverity] = mapped_column(enum_col(FindingSeverity))
    title: Mapped[str] = mapped_column(String(300))
    detail: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(40), default="open")

    project: Mapped[Project] = relationship(back_populates="findings")


class Variant(Base):
    __tablename__ = "variants"
    __table_args__ = (UniqueConstraint("project_id", "key"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"), index=True)
    key: Mapped[str] = mapped_column(String(40))
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    project: Mapped[Project] = relationship(back_populates="variants")
    values: Mapped[list[VariantValue]] = relationship(
        back_populates="variant",
        cascade="all, delete-orphan",
        order_by="VariantValue.sort_order",
    )


class VariantValue(Base):
    __tablename__ = "variant_values"
    __table_args__ = (UniqueConstraint("variant_id", "key"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    variant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("variants.id"), index=True)
    key: Mapped[str] = mapped_column(String(40))
    name: Mapped[str] = mapped_column(String(120))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    variant: Mapped[Variant] = relationship(back_populates="values")


class ProductConfiguration(Base):
    __tablename__ = "product_configurations"
    __table_args__ = (UniqueConstraint("project_id", "key"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"), index=True)
    key: Mapped[str] = mapped_column(String(80))
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    selection: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    project: Mapped[Project] = relationship(back_populates="configurations")


class ConfigRule(Base):
    """Simple include/exclude rule, e.g. sku=home excludes nav=lidar."""

    __tablename__ = "config_rules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    rule_type: Mapped[str] = mapped_column(String(20), default="exclude")  # exclude | require
    when_expr: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    then_expr: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    description: Mapped[str] = mapped_column(Text, default="")

    project: Mapped[Project] = relationship(back_populates="config_rules")
