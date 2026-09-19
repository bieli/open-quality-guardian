import { useMemo } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Diagram } from "../types";

function ActionNode({ data }: NodeProps<{ label: string; kind: string }>) {
  const kind = String(data.kind || "action");
  const handles = (
    <>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </>
  );
  if (kind === "sync")
    return (
      <div className="fn-node sync">
        {handles}
      </div>
    );
  if (kind === "end")
    return (
      <div className="fn-node end">
        {handles}
      </div>
    );
  if (kind === "decision")
    return (
      <div className="fn-node decision">
        {handles}
        <span>{String(data.label)}</span>
      </div>
    );
  return (
    <div className="fn-node">
      {handles}
      {String(data.label)}
    </div>
  );
}

const nodeTypes = { action: ActionNode, sync: ActionNode, decision: ActionNode, end: ActionNode };

export function FunctionFlow({ diagram }: { diagram: Diagram }) {
  const { nodes, edges } = useMemo(() => {
    const laneW = 280;
    const ns: Node[] = [];
    diagram.lanes.forEach((lane, i) => {
      ns.push({
        id: `lane-${lane.id}`,
        type: "group",
        position: { x: i * laneW, y: 0 },
        data: { label: lane.title },
        style: {
          width: laneW - 8,
          height: 560,
          background: "rgba(255,255,255,0.4)",
          border: "1px solid #d4c9b8",
          borderRadius: 12,
          fontSize: 13,
          padding: 10,
          color: "#6f655c",
        },
        selectable: false,
        draggable: false,
      });
    });
    diagram.nodes.forEach((n) => {
      ns.push({
        id: n.id,
        type: n.kind === "action" ? "action" : n.kind,
        parentId: `lane-${n.lane}`,
        position: { x: 28 + n.x * 0.12, y: 56 + n.y * 0.85 },
        data: { label: n.label, kind: n.kind },
        draggable: false,
        zIndex: 2,
      });
    });
    const es: Edge[] = diagram.edges.map((e, i) => ({
      id: `${e.from}-${e.to}-${i}`,
      source: e.from,
      target: e.to,
      label: e.label,
      style: { stroke: "#9c1d33", strokeWidth: 1.8 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "#9c1d33" },
    }));
    return { nodes: ns, edges: es };
  }, [diagram]);

  return (
    <div className="flow-wrap">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#d4c9b8" gap={18} />
        <MiniMap pannable />
        <Controls />
      </ReactFlow>
    </div>
  );
}
