import { Handle, NodeResizer, Position, type Node, type NodeProps } from "@xyflow/react";
import type { StepData, StepKind } from "./convert";

type StepNode = Node<StepData, StepKind>;
type LaneNodeType = Node<{ label: string }, "lane">;

function Handles({ extra }: { extra?: boolean }) {
  return (
    <>
      <Handle type="target" position={Position.Left} className="wf-handle" />
      <Handle type="source" position={Position.Right} className="wf-handle" />
      {extra && <Handle type="source" id="bottom" position={Position.Bottom} className="wf-handle" />}
    </>
  );
}

export function StartNode({ data, selected }: NodeProps<StepNode>) {
  return (
    <div className={`wf-node start ${selected ? "selected" : ""}`}>
      <Handles />
      <span>{data.label || "Start"}</span>
    </div>
  );
}

export function ActionNode({ data, selected }: NodeProps<StepNode>) {
  return (
    <div className={`wf-node action ${selected ? "selected" : ""}`}>
      <Handles />
      <span>{data.label || "Action"}</span>
    </div>
  );
}

export function DecisionNode({ data, selected }: NodeProps<StepNode>) {
  return (
    <div className={`wf-node decision ${selected ? "selected" : ""}`}>
      <Handles extra />
      <span>{data.label || "if?"}</span>
    </div>
  );
}

export function SyncNode({ selected }: NodeProps<StepNode>) {
  return (
    <div className={`wf-node sync ${selected ? "selected" : ""}`}>
      <Handles />
    </div>
  );
}

export function EndNode({ data, selected }: NodeProps<StepNode>) {
  return (
    <div className={`wf-node end ${selected ? "selected" : ""}`}>
      <Handle type="target" position={Position.Left} className="wf-handle" />
      <span>{data.label || "End"}</span>
    </div>
  );
}

export function LaneNode({ data, selected }: NodeProps<LaneNodeType>) {
  return (
    <div className={`wf-lane ${selected ? "selected" : ""}`}>
      <NodeResizer minWidth={220} minHeight={280} color="#9c1d33" isVisible={!!selected} />
      <div className="wf-lane-title">{data.label || "Lane"}</div>
    </div>
  );
}

export const workflowNodeTypes = {
  start: StartNode,
  action: ActionNode,
  decision: DecisionNode,
  sync: SyncNode,
  end: EndNode,
  lane: LaneNode,
};

export function defaultLabel(kind: StepKind) {
  if (kind === "start") return "Start";
  if (kind === "end") return "End";
  if (kind === "decision") return "condition?";
  if (kind === "sync") return "";
  return "New action";
}
