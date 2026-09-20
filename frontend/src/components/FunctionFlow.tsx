import { useMemo } from "react";
import { Background, Controls, MiniMap, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Diagram } from "../types";
import { diagramToFlow } from "../workflow/convert";
import { workflowNodeTypes } from "../workflow/nodes";

export function FunctionFlow({ diagram }: { diagram: Diagram }) {
  const { nodes, edges } = useMemo(() => diagramToFlow(diagram), [diagram]);
  return (
    <div className="flow-wrap">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={workflowNodeTypes}
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
