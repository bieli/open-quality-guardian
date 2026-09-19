from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models import (
    Artifact,
    ArtifactKind,
    BomItem,
    Domain,
    LifecycleStatus,
    LinkType,
    Project,
    TraceLink,
    VModelNode,
    VSide,
    Viewpoint,
)
from app.services.quality import rebuild_findings

S = LifecycleStatus


def _slugify(name: str) -> str:
    return "".join(ch.lower() if ch.isalnum() else "-" for ch in name).strip("-")[:80]


def art(
    db: Session,
    project: Project,
    identifier: str,
    title: str,
    *,
    viewpoint: Viewpoint,
    kind: ArtifactKind,
    domain: Domain = Domain.SYSTEM,
    parent: Optional[Artifact] = None,
    status: LifecycleStatus = S.IN_PROGRESS,
    owner: str = "",
    v_node_key: str = "",
    progress: int = 40,
    description: str = "",
    extra: Optional[dict[str, Any]] = None,
) -> Artifact:
    row = Artifact(
        project_id=project.id,
        parent_id=parent.id if parent else None,
        identifier=identifier,
        title=title,
        description=description,
        viewpoint=viewpoint,
        domain=domain,
        kind=kind,
        status=status,
        owner=owner,
        v_node_key=v_node_key,
        progress=progress,
        extra=extra or {},
    )
    db.add(row)
    db.flush()
    return row


def link(db: Session, project: Project, source: Artifact, target: Artifact, link_type: LinkType) -> None:
    db.add(
        TraceLink(
            project_id=project.id,
            source_id=source.id,
            target_id=target.id,
            link_type=link_type,
        )
    )


def seed_v_model(db: Session, project: Project) -> None:
    nodes = [
        ("stakeholder_req", "Stakeholder Requirements", Domain.SYSTEM, VSide.DESIGN, 0, "validation",
         "Needs and customer features that define product success."),
        ("validation", "Validation", Domain.SYSTEM, VSide.VERIFY, 0, "stakeholder_req",
         "Does the product satisfy the original stakeholder intent?"),
        ("system_req", "System Requirements", Domain.SYSTEM, VSide.DESIGN, 1, "system_verification",
         "Quantified system-level requirements allocated across domains."),
        ("system_verification", "System Verification", Domain.SYSTEM, VSide.VERIFY, 1, "system_req",
         "Evidence that system requirements are met."),
        ("system_architecture", "System Architecture", Domain.SYSTEM, VSide.INTEGRATION, 2, "system_integration",
         "RFLP architecture that keeps every detail of a complex product connected."),
        ("system_integration", "System Integration & Integration Verification", Domain.SYSTEM, VSide.VERIFY, 2, "system_architecture",
         "Bring hardware, software and mechanics together and prove the whole."),
        ("sw_req", "Software Requirements", Domain.SOFTWARE, VSide.DESIGN, 3, "sw_verification",
         "Software obligations derived from system requirements."),
        ("sw_verification", "Software Verification", Domain.SOFTWARE, VSide.VERIFY, 3, "sw_req",
         "Requirements-based software tests and reviews."),
        ("sw_architecture", "Software Architecture", Domain.SOFTWARE, VSide.DESIGN, 4, "sw_comp_verif",
         "Components, interfaces and allocation of logical functions."),
        ("sw_comp_verif", "Software Component Verification", Domain.SOFTWARE, VSide.VERIFY, 4, "sw_architecture",
         "Component and integration tests for software blocks."),
        ("sw_detailed_design", "Software Detailed Design", Domain.SOFTWARE, VSide.DESIGN, 5, "sw_unit_verif",
         "Unit-level design of algorithms and services."),
        ("sw_unit_verif", "Software Unit Verification", Domain.SOFTWARE, VSide.VERIFY, 5, "sw_detailed_design",
         "Unit tests and static analysis."),
        ("hw_req", "Hardware Requirements", Domain.HARDWARE, VSide.DESIGN, 3, "hw_verification",
         "Electrical, sensing and actuation requirements."),
        ("hw_verification", "Hardware Verification", Domain.HARDWARE, VSide.VERIFY, 3, "hw_req",
         "Hardware requirements-based tests."),
        ("hw_architecture", "Hardware Architecture", Domain.HARDWARE, VSide.DESIGN, 4, "hw_comp_verif",
         "Sensors, control units, power and actuators."),
        ("hw_comp_verif", "Hardware Component Verification", Domain.HARDWARE, VSide.VERIFY, 4, "hw_architecture",
         "Board bring-up, sensor characterisation, EMI."),
        ("hw_detailed_design", "Hardware Detailed Design", Domain.HARDWARE, VSide.DESIGN, 5, "hw_unit_verif",
         "KiCad schematics, PCB, CAD fits and BOM."),
        ("hw_unit_verif", "Hardware Unit Verification", Domain.HARDWARE, VSide.VERIFY, 5, "hw_detailed_design",
         "ICT, flying probe, memory and sensor unit tests."),
    ]
    for key, name, domain, side, row, counterpart, desc in nodes:
        db.add(
            VModelNode(
                project_id=project.id,
                key=key,
                name=name,
                domain=domain,
                side=side,
                row=row,
                counterpart_key=counterpart,
                description=desc,
            )
        )


def collision_diagram() -> dict[str, Any]:
    return {
        "lanes": [
            {"id": "terrain", "title": "Terrain Awareness", "subtitle": "Terrain Localization / warning"},
            {"id": "state", "title": "Robot State Acquisition", "subtitle": "Pose, heading, speed"},
            {"id": "intruder", "title": "Intruder Detection", "subtitle": "Localization of unexpected objects"},
            {"id": "avoid", "title": "Collision Avoidance", "subtitle": "Logical function"},
        ],
        "nodes": [
            {"id": "map", "lane": "terrain", "label": "Terrain Map", "kind": "action", "x": 40, "y": 40},
            {"id": "warn", "lane": "terrain", "label": "Terrain Approaching Warning", "kind": "action", "x": 40, "y": 280},
            {"id": "pos", "lane": "state", "label": "Determine Robot Position", "kind": "action", "x": 40, "y": 70},
            {"id": "head", "lane": "state", "label": "Determine Robot Heading", "kind": "action", "x": 40, "y": 160},
            {"id": "speed", "lane": "state", "label": "Determine Robot Speed", "kind": "action", "x": 40, "y": 250},
            {"id": "sync", "lane": "state", "label": "", "kind": "sync", "x": 250, "y": 70},
            {"id": "intr", "lane": "intruder", "label": "Intruder Localization", "kind": "action", "x": 40, "y": 170},
            {"id": "recalc", "lane": "avoid", "label": "Recalculate Route", "kind": "action", "x": 40, "y": 40},
            {"id": "advisory", "lane": "avoid", "label": "Send Traffic Advisory", "kind": "action", "x": 40, "y": 250},
            {"id": "stop", "lane": "avoid", "label": "Stop", "kind": "action", "x": 280, "y": 140},
        ],
        "edges": [
            {"from": "map", "to": "pos"},
            {"from": "map", "to": "recalc"},
            {"from": "pos", "to": "sync"},
            {"from": "head", "to": "sync"},
            {"from": "speed", "to": "sync"},
            {"from": "sync", "to": "recalc"},
            {"from": "intr", "to": "recalc"},
            {"from": "warn", "to": "recalc"},
            {"from": "recalc", "to": "stop"},
            {"from": "advisory", "to": "stop"},
        ],
        "notes": [
            {"label": "Robot vacuum cleaner state", "ref": "[SYS.2]"},
            {"label": "Functional Safety Requirement", "ref": "ISO 13849 / IEC 61508 analogue"},
        ],
    }


def terrain_diagram() -> dict[str, Any]:
    return {
        "lanes": [
            {"id": "scan", "title": "Terrain Scanning", "subtitle": "Terrain localization"},
            {"id": "map", "title": "Map Creation / Update", "subtitle": "Virtual boundaries"},
            {"id": "state", "title": "Robot State Acquisition", "subtitle": "Pose fusion"},
            {"id": "warn", "title": "Terrain Awareness and Warning", "subtitle": "Logical function"},
        ],
        "nodes": [
            {"id": "scan", "lane": "scan", "label": "Terrain Scanning", "kind": "action", "x": 30, "y": 160},
            {"id": "bounds", "lane": "map", "label": "Virtual Boundaries", "kind": "action", "x": 30, "y": 40},
            {"id": "update", "lane": "map", "label": "Update Map", "kind": "action", "x": 30, "y": 160},
            {"id": "pos", "lane": "state", "label": "Determine Robot Position", "kind": "action", "x": 40, "y": 80},
            {"id": "head", "lane": "state", "label": "Determine Robot Heading", "kind": "action", "x": 40, "y": 170},
            {"id": "speed", "lane": "state", "label": "Determine Robot Speed", "kind": "action", "x": 40, "y": 260},
            {"id": "sync", "lane": "state", "label": "", "kind": "sync", "x": 260, "y": 80},
            {"id": "calc", "lane": "warn", "label": "Calculate Distances", "kind": "action", "x": 20, "y": 40},
            {"id": "dec", "lane": "warn", "label": "distance < threshold", "kind": "decision", "x": 280, "y": 160},
            {"id": "trig", "lane": "warn", "label": "Trigger Terrain Approaching Warning", "kind": "action", "x": 480, "y": 70},
            {"id": "send", "lane": "warn", "label": "Send Terrain Map", "kind": "action", "x": 480, "y": 230},
            {"id": "end", "lane": "warn", "label": "", "kind": "end", "x": 520, "y": 340},
        ],
        "edges": [
            {"from": "scan", "to": "update"},
            {"from": "bounds", "to": "calc"},
            {"from": "update", "to": "pos"},
            {"from": "update", "to": "calc"},
            {"from": "pos", "to": "sync"},
            {"from": "head", "to": "sync"},
            {"from": "speed", "to": "sync"},
            {"from": "sync", "to": "calc"},
            {"from": "calc", "to": "dec"},
            {"from": "dec", "to": "trig", "label": "yes"},
            {"from": "dec", "to": "send", "label": "else"},
            {"from": "trig", "to": "send"},
            {"from": "send", "to": "end"},
        ],
        "notes": [],
    }


def seed_vacuum(db: Session) -> Project:
    project = Project(
        slug="aurora-vac",
        name="AuroraVac",
        product_type="Autonomous household robot",
        description=(
            "Reference product used to demonstrate Open Quality Guardian on a complex "
            "cyber-physical system: an autonomous vacuum similar in intent to a Roomba, "
            "with mapping, collision avoidance, terrain awareness, electrical design and CAD."
        ),
    )
    db.add(project)
    db.flush()
    seed_v_model(db, project)

    # --- Requirements (R) ---
    cf_map = art(db, project, "CF-1", "Create and keep a floor map", viewpoint=Viewpoint.R,
                 kind=ArtifactKind.CUSTOMER_FEATURE, v_node_key="stakeholder_req", progress=90,
                 status=S.APPROVED, owner="Product Owner",
                 description="Customer can start a job and trust that the robot knows the home.")
    cf_avoid = art(db, project, "CF-2", "Do not collide with people, pets or furniture", viewpoint=Viewpoint.R,
                  kind=ArtifactKind.CUSTOMER_FEATURE, v_node_key="stakeholder_req", progress=85,
                  status=S.APPROVED, owner="Product Owner")
    cf_terrain = art(db, project, "CF-3", "Warn and adapt on stairs, rugs and drop-offs", viewpoint=Viewpoint.R,
                    kind=ArtifactKind.CUSTOMER_FEATURE, v_node_key="stakeholder_req", progress=70,
                    status=S.APPROVED, owner="Product Owner")
    cf_app = art(db, project, "CF-4", "Control and observe from a phone", viewpoint=Viewpoint.R,
                kind=ArtifactKind.CUSTOMER_FEATURE, v_node_key="stakeholder_req", progress=55,
                status=S.IN_PROGRESS, owner="Product Owner")

    sys = art(db, project, "1.1", "AuroraVac System", viewpoint=Viewpoint.R, kind=ArtifactKind.REQUIREMENT,
              v_node_key="system_req", progress=72, status=S.IN_PROGRESS, owner="System Architect")
    req_map = art(db, project, "1.1.1", "Creation map", viewpoint=Viewpoint.R, kind=ArtifactKind.REQUIREMENT,
                 parent=sys, v_node_key="system_req", progress=80, status=S.APPROVED, owner="Perception lead")
    req_floor = art(db, project, "1.1.1.1", "Initial creation of the floor plan", viewpoint=Viewpoint.R,
                   kind=ArtifactKind.REQUIREMENT, parent=req_map, v_node_key="system_req", progress=88,
                   status=S.VERIFIED, owner="Perception lead",
                   description="The robot shall produce a navigable occupancy map of the dwelling on first run.")
    req_objects = art(db, project, "1.1.1.2", "Standing objects", viewpoint=Viewpoint.R, kind=ArtifactKind.REQUIREMENT,
                     parent=req_map, v_node_key="system_req", progress=60, status=S.IN_PROGRESS, owner="Perception lead")
    req_clean = art(db, project, "1.1.2", "Cleaning function", viewpoint=Viewpoint.R, kind=ArtifactKind.REQUIREMENT,
                   parent=sys, v_node_key="system_req", progress=50, status=S.IN_PROGRESS, owner="Mechatronics")
    req_op = art(db, project, "1.1.3", "Operating endurance", viewpoint=Viewpoint.R, kind=ArtifactKind.REQUIREMENT,
                parent=sys, v_node_key="system_req", progress=75, status=S.APPROVED, owner="Power electronics")
    req_batt = art(db, project, "1.1.3.1", "Powerful lithium-ion battery", viewpoint=Viewpoint.R,
                  kind=ArtifactKind.REQUIREMENT, parent=req_op, v_node_key="system_req", progress=82,
                  status=S.IMPLEMENTED, owner="Power electronics", domain=Domain.ELECTRICAL)
    req_assist = art(db, project, "1.1.4", "Computational assistance", viewpoint=Viewpoint.R,
                    kind=ArtifactKind.REQUIREMENT, parent=sys, v_node_key="system_req", progress=68,
                    status=S.IN_PROGRESS, owner="System Architect")
    req_avoid = art(db, project, "1.1.4.1", "Collision avoidance", viewpoint=Viewpoint.R, kind=ArtifactKind.REQUIREMENT,
                   parent=req_assist, v_node_key="system_req", progress=74, status=S.IN_PROGRESS, owner="Safety engineer",
                   description="The robot shall detect static and dynamic obstacles and replan or stop before contact.")
    req_replan = art(db, project, "1.1.4.1.1", "Replanning the route", viewpoint=Viewpoint.R,
                    kind=ArtifactKind.REQUIREMENT, parent=req_avoid, v_node_key="system_req", progress=70,
                    status=S.IN_PROGRESS, owner="Navigation")
    req_perc = art(db, project, "1.1.4.2", "Perception functionality", viewpoint=Viewpoint.R,
                  kind=ArtifactKind.REQUIREMENT, parent=req_assist, v_node_key="system_req", progress=66,
                  status=S.IN_PROGRESS, owner="Perception lead")
    req_state = art(db, project, "1.1.4.2.1", "Robot vacuum cleaner state", viewpoint=Viewpoint.R,
                   kind=ArtifactKind.REQUIREMENT, parent=req_perc, v_node_key="system_req", progress=78,
                   status=S.IMPLEMENTED, owner="Localization")
    req_intruder = art(db, project, "1.1.4.2.2", "Intruder state", viewpoint=Viewpoint.R, kind=ArtifactKind.REQUIREMENT,
                      parent=req_perc, v_node_key="system_req", progress=40, status=S.IN_PROGRESS, owner="Perception lead")
    req_terrain = art(db, project, "1.1.4.3", "Terrain localization", viewpoint=Viewpoint.R, kind=ArtifactKind.REQUIREMENT,
                     parent=req_assist, v_node_key="system_req", progress=58, status=S.IN_PROGRESS, owner="Perception lead")
    req_hmi = art(db, project, "1.1.5", "HMI functionality", viewpoint=Viewpoint.R, kind=ArtifactKind.REQUIREMENT,
                 parent=sys, v_node_key="system_req", progress=45, status=S.IN_PROGRESS, owner="App team")
    req_safety = art(db, project, "1.1.3.1-FS", "Functional safety requirement", viewpoint=Viewpoint.R,
                    kind=ArtifactKind.REQUIREMENT, parent=sys, v_node_key="system_req", progress=35,
                    status=S.IN_REVIEW, owner="Safety engineer",
                    description="Hazardous motion shall be inhibited when cliff or collision confidence is insufficient.")

    sw_nav = art(db, project, "SW-NAV-1", "Navigation stack shall replan within 200 ms", viewpoint=Viewpoint.R,
                kind=ArtifactKind.REQUIREMENT, domain=Domain.SOFTWARE, v_node_key="sw_req", progress=62,
                status=S.IN_PROGRESS, owner="Firmware")
    sw_map = art(db, project, "SW-MAP-1", "Non-volatile floor-plan memory", viewpoint=Viewpoint.R,
                kind=ArtifactKind.REQUIREMENT, domain=Domain.SOFTWARE, v_node_key="sw_req", progress=90,
                status=S.VERIFIED, owner="Firmware")
    hw_us = art(db, project, "HW-US-1", "Front-middle ultrasonic ranging", viewpoint=Viewpoint.R,
               kind=ArtifactKind.REQUIREMENT, domain=Domain.HARDWARE, v_node_key="hw_req", progress=70,
               status=S.IMPLEMENTED, owner="Hardware designer")
    hw_mcu = art(db, project, "HW-MCU-1", "Control unit shall host navigation and safety loop", viewpoint=Viewpoint.R,
                kind=ArtifactKind.REQUIREMENT, domain=Domain.HARDWARE, v_node_key="hw_req", progress=64,
                status=S.IN_PROGRESS, owner="Hardware designer")

    # --- Functional (F) ---
    fn_avoid = art(db, project, "F-CA", "Collision Avoidance Function", viewpoint=Viewpoint.F,
                  kind=ArtifactKind.FUNCTION, v_node_key="system_architecture", progress=72,
                  status=S.IN_PROGRESS, owner="System Architect", extra=collision_diagram(),
                  description="Activity flow that fuses terrain, ego-state and intruders into stop or replan.")
    fn_terrain = art(db, project, "F-TA", "Terrain Awareness Function", viewpoint=Viewpoint.F,
                    kind=ArtifactKind.FUNCTION, v_node_key="system_architecture", progress=61,
                    status=S.IN_PROGRESS, owner="System Architect", extra=terrain_diagram())
    for ident, title, parent, prog in [
        ("F-CA-1", "Terrain map fusion", fn_avoid, 80),
        ("F-CA-2", "Determine robot pose", fn_avoid, 78),
        ("F-CA-3", "Intruder localization", fn_avoid, 42),
        ("F-CA-4", "Recalculate route", fn_avoid, 70),
        ("F-CA-5", "Stop", fn_avoid, 88),
        ("F-TA-1", "Terrain scanning", fn_terrain, 66),
        ("F-TA-2", "Update map", fn_terrain, 74),
        ("F-TA-3", "Calculate distances", fn_terrain, 55),
        ("F-TA-4", "Trigger approaching warning", fn_terrain, 48),
    ]:
        art(db, project, ident, title, viewpoint=Viewpoint.F, kind=ArtifactKind.ACTION, parent=parent,
            v_node_key="system_architecture", progress=prog, status=S.IN_PROGRESS, owner="System Architect")

    # --- Logical (L) ---
    sys1 = art(db, project, "L-SYS-1", "Perception & mapping system", viewpoint=Viewpoint.L,
              kind=ArtifactKind.LOGICAL_BLOCK, v_node_key="system_architecture", progress=70,
              status=S.IN_PROGRESS, owner="System Architect")
    sense = art(db, project, "L-SENSE-1", "Sense 1 — ranging and cliff", viewpoint=Viewpoint.L,
               kind=ArtifactKind.LOGICAL_BLOCK, parent=sys1, v_node_key="system_architecture", progress=76,
               status=S.IMPLEMENTED, owner="Hardware designer")
    log1 = art(db, project, "L-FN-1", "Logical Function 1 — localize & map", viewpoint=Viewpoint.L,
              kind=ArtifactKind.LOGICAL_BLOCK, parent=sys1, v_node_key="system_architecture", progress=68,
              status=S.IN_PROGRESS, owner="Perception lead")
    act1 = art(db, project, "L-ACT-1", "Actuation 1 — drive and brush", viewpoint=Viewpoint.L,
              kind=ArtifactKind.LOGICAL_BLOCK, parent=sys1, v_node_key="system_architecture", progress=60,
              status=S.IN_PROGRESS, owner="Mechatronics")
    sys2 = art(db, project, "L-SYS-2", "Safety supervisory system", viewpoint=Viewpoint.L,
              kind=ArtifactKind.LOGICAL_BLOCK, v_node_key="system_architecture", progress=50,
              status=S.IN_PROGRESS, owner="Safety engineer")
    log2 = art(db, project, "L-FN-2", "Logical Function 2 — collision inhibit", viewpoint=Viewpoint.L,
              kind=ArtifactKind.LOGICAL_BLOCK, parent=sys2, v_node_key="system_architecture", progress=52,
              status=S.IN_PROGRESS, owner="Safety engineer")
    act2 = art(db, project, "L-ACT-2", "Actuation 2 — emergency stop torque-off", viewpoint=Viewpoint.L,
              kind=ArtifactKind.LOGICAL_BLOCK, parent=sys2, v_node_key="system_architecture", progress=44,
              status=S.IN_REVIEW, owner="Safety engineer")

    # --- Physical (P) software ---
    sw1 = art(db, project, "SWC-1", "Sensor drivers", viewpoint=Viewpoint.P, kind=ArtifactKind.SW_COMPONENT,
             domain=Domain.SOFTWARE, v_node_key="sw_architecture", progress=82, status=S.IMPLEMENTED, owner="Firmware")
    sw2 = art(db, project, "SWC-2", "Localization & mapping", viewpoint=Viewpoint.P, kind=ArtifactKind.SW_COMPONENT,
             domain=Domain.SOFTWARE, v_node_key="sw_architecture", progress=70, status=S.IN_PROGRESS, owner="Perception lead")
    sw3 = art(db, project, "SWC-3", "Planner / route recalculation", viewpoint=Viewpoint.P, kind=ArtifactKind.SW_COMPONENT,
             domain=Domain.SOFTWARE, v_node_key="sw_architecture", progress=64, status=S.IN_PROGRESS, owner="Navigation")
    sw4 = art(db, project, "SWC-4", "Safety monitor", viewpoint=Viewpoint.P, kind=ArtifactKind.SW_COMPONENT,
             domain=Domain.SOFTWARE, v_node_key="sw_architecture", progress=48, status=S.IN_REVIEW, owner="Safety engineer")
    sw5 = art(db, project, "SWC-5", "HMI & connectivity", viewpoint=Viewpoint.P, kind=ArtifactKind.SW_COMPONENT,
             domain=Domain.SOFTWARE, v_node_key="sw_architecture", progress=40, status=S.IN_PROGRESS, owner="App team")
    sw_unit = art(db, project, "SW-DD-PLAN", "A* repair planner detailed design", viewpoint=Viewpoint.P,
                 kind=ArtifactKind.SPECIFICATION, domain=Domain.SOFTWARE, v_node_key="sw_detailed_design",
                 progress=55, status=S.IN_PROGRESS, owner="Navigation")

    # --- Physical hardware / CAD / KiCad ---
    sensor = art(db, project, "HW-SENS-1", "Sensor cluster (ultrasonic + cliff IR)", viewpoint=Viewpoint.P,
                kind=ArtifactKind.HW_COMPONENT, domain=Domain.HARDWARE, v_node_key="hw_architecture",
                progress=78, status=S.IMPLEMENTED, owner="Hardware designer")
    mcu = art(db, project, "HW-CU-1", "Control Unit 1", viewpoint=Viewpoint.P, kind=ArtifactKind.HW_COMPONENT,
             domain=Domain.HARDWARE, v_node_key="hw_architecture", progress=66, status=S.IN_PROGRESS,
             owner="Hardware designer")
    act_w = art(db, project, "HW-ACT-1", "Drive actuators", viewpoint=Viewpoint.P, kind=ArtifactKind.HW_COMPONENT,
               domain=Domain.HARDWARE, v_node_key="hw_architecture", progress=60, status=S.IN_PROGRESS,
               owner="Mechatronics")
    act_b = art(db, project, "HW-ACT-2", "Brush & vacuum motor", viewpoint=Viewpoint.P, kind=ArtifactKind.HW_COMPONENT,
               domain=Domain.HARDWARE, v_node_key="hw_architecture", progress=58, status=S.IN_PROGRESS,
               owner="Mechatronics")

    sch = art(
        db, project, "EE-SCH-1", "Mainboard KiCad schematic", viewpoint=Viewpoint.A,
        kind=ArtifactKind.KICAD_SCH, domain=Domain.ELECTRICAL, v_node_key="hw_detailed_design",
        progress=72, status=S.IN_PROGRESS, owner="Hardware designer",
        extra={
            "format": "kicad_sch",
            "sheet": "AURORA_MAIN",
            "components": [
                {"reference": "U1", "value": "STM32H743VIT6", "footprint": "LQFP-100"},
                {"reference": "U2", "value": "W25Q128", "footprint": "SOIC-8"},
                {"reference": "U3", "value": "TMC2209", "footprint": "QFN-28"},
                {"reference": "J1", "value": "HC-SR04", "footprint": "US-MOD"},
                {"reference": "M1", "value": "DRIVE-L", "footprint": "JST-XH-2"},
                {"reference": "M2", "value": "DRIVE-R", "footprint": "JST-XH-2"},
                {"reference": "BT1", "value": "Li-ion 14.4V 5200mAh", "footprint": "XT60"},
            ],
            "nets": ["3V3", "GND", "VBAT", "USART_LIDAR", "STEP_L", "STEP_R", "CLIFF_IR", "ESTOP"],
        },
    )
    pcb = art(
        db, project, "EE-PCB-1", "Mainboard KiCad PCB", viewpoint=Viewpoint.A, kind=ArtifactKind.KICAD_PCB,
        domain=Domain.ELECTRICAL, v_node_key="hw_detailed_design", progress=50, status=S.IN_PROGRESS,
        owner="Hardware designer",
        extra={"layers": ["F.Cu", "In1.Cu", "In2.Cu", "B.Cu"], "size_mm": [92, 64], "drc_errors": 2},
    )
    cad = art(
        db, project, "ME-CAD-1", "Housing CAD assembly", viewpoint=Viewpoint.A, kind=ArtifactKind.CAD,
        domain=Domain.MECHANICAL, v_node_key="hw_detailed_design", progress=63, status=S.IN_PROGRESS,
        owner="Industrial design",
        extra={"format": "STEP", "mass_g": 3200, "diameter_mm": 350, "clearance_lidar_mm": 12},
    )
    model = art(
        db, project, "ME-3D-1", "Product 3D visualization", viewpoint=Viewpoint.A, kind=ArtifactKind.MODEL_3D,
        domain=Domain.MECHANICAL, v_node_key="system_architecture", progress=80, status=S.APPROVED,
        owner="Industrial design", extra={"renderer": "procedural-vacuum"},
    )
    spec = art(
        db, project, "SPEC-SYS-1", "Product specification", viewpoint=Viewpoint.A, kind=ArtifactKind.SPECIFICATION,
        domain=Domain.PRODUCT, v_node_key="system_req", progress=77, status=S.APPROVED, owner="Program manager",
        extra={
            "runtime_min": 90,
            "noise_dba": 58,
            "coverage_m2": 150,
            "safety": "Stop on cliff confidence < 0.8",
        },
    )
    bom_art = art(
        db, project, "BOM-1", "Manufacturing bill of materials", viewpoint=Viewpoint.A, kind=ArtifactKind.BOM,
        domain=Domain.PRODUCT, v_node_key="hw_detailed_design", progress=58, status=S.IN_PROGRESS,
        owner="Operations",
        extra={"items": [{"mpn": "STM32H743VIT6", "name": "MCU"}, {"mpn": "W25Q128", "name": "NOR flash"}]},
    )

    bom_rows = [
        ("STM32H743VIT6", "Application MCU", 1, "electrical", "ST"),
        ("W25Q128", "Floor-plan NOR flash", 1, "electrical", "Winbond"),
        ("TMC2209", "Stepper driver", 2, "electrical", "Trinamic"),
        ("HC-SR04", "Ultrasonic module (front middle)", 1, "electrical", "Generic"),
        ("IR-CLIFF-940", "Cliff IR pair", 4, "electrical", "Vishay"),
        ("BLDC-WHEEL", "Hub drive motor", 2, "mechanical", "Nidec"),
        ("VAC-FAN-80", "Vacuum impeller", 1, "mechanical", "Internal"),
        ("CELL-18650-4S2P", "Li-ion pack 14.4V 5200mAh", 1, "electrical", "Pack vendor"),
        ("HOUSING-ABS", "Upper/lower shell CAD", 1, "mechanical", "Moulder"),
    ]
    for mpn, name, qty, cat, supplier in bom_rows:
        db.add(
            BomItem(
                project_id=project.id,
                part_number=mpn,
                name=name,
                qty=qty,
                category=cat,
                supplier=supplier,
                linked_artifact_id=mcu.id if "STM32" in mpn else sensor.id if "HC-SR" in mpn else cad.id if "HOUSING" in mpn else None,
            )
        )

    # --- Tests ---
    ts_hw = art(
        db, project, "09", "Test Hardware Detailed Design", viewpoint=Viewpoint.T, kind=ArtifactKind.TEST_SPEC,
        domain=Domain.HARDWARE, v_node_key="hw_unit_verif", progress=40, status=S.IN_PROGRESS,
        owner="HardwareDetailedDesigner",
        extra={"suite": "Hardware Detailed Design Test Specification"},
    )
    tc_mem = art(
        db, project, "09.1.1", "Import of sensor data for floor plan", viewpoint=Viewpoint.T,
        kind=ArtifactKind.TEST_CASE, domain=Domain.HARDWARE, parent=ts_hw, v_node_key="hw_unit_verif",
        progress=100, status=S.VERIFIED, owner="HardwareDetailedDesigner",
        extra={"subjects": ["Memory Module 1"], "precondition": "Empty NOR sector", "postcondition": "Map CRC valid"},
    )
    tc_nv = art(
        db, project, "09.1.2", "Check non-volatile memory for floor plan", viewpoint=Viewpoint.T,
        kind=ArtifactKind.TEST_CASE, domain=Domain.HARDWARE, parent=ts_hw, v_node_key="hw_unit_verif",
        progress=100, status=S.VERIFIED, owner="HardwareDetailedDesigner",
        extra={"subjects": ["Memory Module 1"]},
    )
    tc_us = art(
        db, project, "09.2", "Ultrasonic sensor (front middle)", viewpoint=Viewpoint.T, kind=ArtifactKind.TEST_CASE,
        domain=Domain.HARDWARE, parent=ts_hw, v_node_key="hw_comp_verif", progress=30, status=S.FAILED,
        owner="", extra={"subjects": ["Microcontroller"], "verdict_note": "Range scatter above 8% at 1.5 m"},
    )
    tc_sys = art(
        db, project, "SYS-V-CA", "Collision avoidance system verification", viewpoint=Viewpoint.T,
        kind=ArtifactKind.TEST_CASE, domain=Domain.SYSTEM, v_node_key="system_verification", progress=45,
        status=S.IN_PROGRESS, owner="V&V lead",
    )
    tc_val = art(
        db, project, "VAL-HOME", "Home validation — pets and stairs", viewpoint=Viewpoint.T,
        kind=ArtifactKind.TEST_CASE, domain=Domain.SYSTEM, v_node_key="validation", progress=20,
        status=S.DRAFT, owner="Program manager",
    )
    tc_sw = art(
        db, project, "SW-U-PLAN", "Planner unit tests", viewpoint=Viewpoint.T, kind=ArtifactKind.TEST_CASE,
        domain=Domain.SOFTWARE, v_node_key="sw_unit_verif", progress=80, status=S.VERIFIED, owner="Navigation",
    )

    # Traceability: customer -> system -> function -> logical -> physical -> tests
    for src, dst, kind in [
        (cf_map, req_floor, LinkType.REFINES),
        (cf_map, req_objects, LinkType.REFINES),
        (cf_avoid, req_avoid, LinkType.REFINES),
        (cf_terrain, req_terrain, LinkType.REFINES),
        (cf_app, req_hmi, LinkType.REFINES),
        (req_avoid, fn_avoid, LinkType.ALLOCATES),
        (req_replan, fn_avoid, LinkType.ALLOCATES),
        (req_terrain, fn_terrain, LinkType.ALLOCATES),
        (req_state, fn_avoid, LinkType.ALLOCATES),
        (req_floor, fn_terrain, LinkType.ALLOCATES),
        (fn_avoid, log2, LinkType.ALLOCATES),
        (fn_avoid, log1, LinkType.ALLOCATES),
        (fn_terrain, log1, LinkType.ALLOCATES),
        (log1, sw2, LinkType.IMPLEMENTS),
        (log2, sw4, LinkType.IMPLEMENTS),
        (sense, sensor, LinkType.IMPLEMENTS),
        (act1, act_w, LinkType.IMPLEMENTS),
        (act2, mcu, LinkType.IMPLEMENTS),
        (req_avoid, sw_nav, LinkType.DERIVES),
        (req_floor, sw_map, LinkType.DERIVES),
        (req_avoid, hw_us, LinkType.DERIVES),
        (sw_nav, sw3, LinkType.ALLOCATES),
        (sw_map, sw2, LinkType.ALLOCATES),
        (hw_us, sensor, LinkType.ALLOCATES),
        (hw_mcu, mcu, LinkType.ALLOCATES),
        (tc_mem, sw_map, LinkType.VERIFIES),
        (tc_nv, sw_map, LinkType.VERIFIES),
        (tc_us, hw_us, LinkType.VERIFIES),
        (tc_sys, req_avoid, LinkType.VERIFIES),
        (tc_val, cf_avoid, LinkType.VALIDATES),
        (tc_sw, sw_unit, LinkType.VERIFIES),
        (sch, mcu, LinkType.TRACES),
        (pcb, mcu, LinkType.TRACES),
        (cad, act_w, LinkType.TRACES),
        (model, sys, LinkType.TRACES),
        (spec, sys, LinkType.TRACES),
        (bom_art, mcu, LinkType.TRACES),
        (req_safety, log2, LinkType.ALLOCATES),
        (req_safety, sw4, LinkType.ALLOCATES),
    ]:
        link(db, project, src, dst, kind)

    # Intentionally leave req_intruder, req_clean, req_batt weakly linked so quality gaps appear.
    link(db, project, req_batt, mcu, LinkType.TRACES)

    db.flush()
    rebuild_findings(db, project.id)
    return project


def seed_blank_template(db: Session) -> Project:
    project = Project(
        slug="new-product",
        name="New complex product",
        product_type="Define your product",
        description="Empty V-model ready for a program manager to start capturing quality across RFLP.",
    )
    db.add(project)
    db.flush()
    seed_v_model(db, project)
    return project


def seed_if_empty(db: Session) -> None:
    if db.query(Project).count():
        return
    seed_vacuum(db)
    seed_blank_template(db)
    db.commit()
