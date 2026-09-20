import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { Diagram } from "../types";

export const LANE_W = 300;
export const LANE_H = 640;
export const DND_MIME = "application/oqg-workflow";

export type StepKind = "start" | "action" | "decision" | "sync" | "end";

export type StepData = {
  label: string;
  kind: StepKind;
};

export const STEP_CATALOG: { kind: StepKind; label: string; hint: string }[] = [
  { kind: "start", label: "Start", hint: "Entry of the behaviour" },
  { kind: "action", label: "Action", hint: "A step the product performs" },
  { kind: "decision", label: "Decision", hint: "Branch, e.g. distance < threshold" },
  { kind: "sync", label: "Join / sync", hint: "Wait for several inputs" },
  { kind: "end", label: "End", hint: "Stop or hand-off" },
];

function laneId(id: string) {
  return id.startsWith("lane-") ? id : `lane-${id}`;
}

export function diagramToFlow(diagram: Diagram): { nodes: Node[]; edges: Edge[] } {
  const lanes = diagram.lanes.length
    ? diagram.lanes
    : [{ id: "main", title: "Workflow", subtitle: "" }];
  const nodes: Node[] = lanes.map((lane, i) => ({
    id: laneId(lane.id),
    type: "lane",
    position: { x: i * LANE_W, y: 0 },
    data: { label: lane.title, kind: "lane" },
    style: { width: LANE_W - 12, height: LANE_H },
    width: LANE_W - 12,
    height: LANE_H,
    draggable: true,
    selectable: true,
  }));
  const laneIds = new Set(lanes.map((l) => l.id));
  diagram.nodes.forEach((n, i) => {
    const lane = laneIds.has(n.lane) ? n.lane : lanes[0].id;
    const kind = (["start", "action", "decision", "sync", "end"].includes(n.kind) ? n.kind : "action") as StepKind;
    const innerW = LANE_W - 12;
    const xRaw = Number.isFinite(n.x) ? n.x : 36;
    const yRaw = Number.isFinite(n.y) ? n.y : 64 + i * 80;
    nodes.push({
      id: n.id,
      type: kind,
      parentId: laneId(lane),
      position: {
        x: Math.max(16, Math.min(xRaw, innerW - 148)),
        y: Math.max(48, yRaw),
      },
      data: { label: n.label || kind, kind },
      extent: "parent",
      draggable: true,
    });
  });
  const edges: Edge[] = diagram.edges.map((e, i) => ({
    id: `${e.from}-${e.to}-${i}`,
    source: e.from,
    target: e.to,
    label: e.label,
    type: "smoothstep",
    style: { stroke: "#9c1d33", strokeWidth: 1.7 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#9c1d33", width: 16, height: 16 },
  }));
  return { nodes, edges };
}

export function flowToDiagram(
  diagram: Diagram,
  nodes: Node[],
  edges: Edge[],
): Pick<Diagram, "lanes" | "nodes" | "edges"> {
  const lanes = nodes
    .filter((n) => n.type === "lane")
    .sort((a, b) => a.position.x - b.position.x)
    .map((n) => ({
      id: n.id.replace(/^lane-/, ""),
      title: String((n.data as { label?: string }).label || "Lane"),
      subtitle: "",
    }));
  const fallback = lanes[0]?.id || "main";
  const steps = nodes
    .filter((n) => n.type !== "lane")
    .map((n) => {
      const parent = (n.parentId || "").replace(/^lane-/, "") || fallback;
      const data = n.data as StepData;
      return {
        id: n.id,
        lane: parent,
        label: data.label || n.id,
        kind: (data.kind || n.type || "action") as string,
        x: Math.round(n.position.x),
        y: Math.round(n.position.y),
      };
    });
  const savedEdges = edges
    .filter((e) => e.source && e.target && !e.source.startsWith("lane-") && !e.target.startsWith("lane-"))
    .map((e) => ({
      from: e.source,
      to: e.target,
      label: typeof e.label === "string" ? e.label : undefined,
    }));
  return { lanes: lanes.length ? lanes : diagram.lanes, nodes: steps, edges: savedEdges };
}

export function arrangeByLane(nodes: Node[]): Node[] {
  const lanes = nodes.filter((n) => n.type === "lane").sort((a, b) => a.position.x - b.position.x);
  const steps = nodes.filter((n) => n.type !== "lane");
  const nextLanes = lanes.map((lane, i) => ({
    ...lane,
    position: { x: i * LANE_W, y: 0 },
    style: { ...lane.style, width: LANE_W - 12, height: LANE_H },
  }));
  const byParent = new Map<string, Node[]>();
  const defaultParent = nextLanes[0]?.id;
  for (const step of steps) {
    const pid = step.parentId && nextLanes.some((l) => l.id === step.parentId) ? step.parentId : defaultParent;
    const list = byParent.get(pid || "") || [];
    list.push(step);
    byParent.set(pid || "", list);
  }
  const nextSteps: Node[] = [];
  for (const lane of nextLanes) {
    const kids = byParent.get(lane.id) || [];
    kids.forEach((step, i) => {
      nextSteps.push({
        ...step,
        parentId: lane.id,
        extent: "parent",
        position: { x: 40, y: 56 + i * 124 },
      });
    });
  }
  return [...nextLanes, ...nextSteps];
}

export function findLaneAt(nodes: Node[], flowPos: { x: number; y: number }): Node | undefined {
  const lanes = nodes.filter((n) => n.type === "lane");
  const hit = lanes.find((n) => {
    const w = Number(n.style?.width || n.width || LANE_W - 12);
    const h = Number(n.style?.height || n.height || LANE_H);
    return flowPos.x >= n.position.x && flowPos.x <= n.position.x + w && flowPos.y >= n.position.y && flowPos.y <= n.position.y + h;
  });
  if (hit) return hit;
  return [...lanes].sort((a, b) => {
    const ax = a.position.x + Number(a.style?.width || a.width || LANE_W) / 2;
    const bx = b.position.x + Number(b.style?.width || b.width || LANE_W) / 2;
    return Math.abs(ax - flowPos.x) - Math.abs(bx - flowPos.x);
  })[0];
}
