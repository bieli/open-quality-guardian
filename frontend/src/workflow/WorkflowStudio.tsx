import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  Background,
  ConnectionLineType,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Node,
  type OnConnect,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { CircleDot, Diamond, GitMerge, Play, Square, Columns3, LayoutGrid } from "lucide-react";
import type { Diagram } from "../types";
import { Btn, Field } from "../components/ui";
import {
  DND_MIME,
  LANE_H,
  LANE_W,
  STEP_CATALOG,
  arrangeByLane,
  diagramToFlow,
  findLaneAt,
  flowToDiagram,
  type StepKind,
} from "./convert";
import { defaultLabel, workflowNodeTypes } from "./nodes";

const ICONS: Record<StepKind, typeof Play> = {
  start: Play,
  action: Square,
  decision: Diamond,
  sync: GitMerge,
  end: CircleDot,
};

const KINDS = new Set<StepKind>(["start", "action", "decision", "sync", "end"]);

function Palette({ onPick }: { onPick: (kind: StepKind) => void }) {
  const onDragStart = (event: DragEvent, kind: StepKind) => {
    event.dataTransfer.setData(DND_MIME, kind);
    event.dataTransfer.setData("text/plain", kind);
    event.dataTransfer.effectAllowed = "move";
  };
  return (
    <aside className="wf-palette">
      <div className="eyebrow">Steps</div>
      <p className="small muted">Drag onto a swimlane, or click to drop into the selected lane.</p>
      {STEP_CATALOG.map((item) => {
        const Icon = ICONS[item.kind];
        return (
          <div
            key={item.kind}
            className={`wf-palette-item kind-${item.kind}`}
            draggable
            role="button"
            tabIndex={0}
            onClick={() => onPick(item.kind)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onPick(item.kind);
            }}
            onDragStart={(e) => onDragStart(e, item.kind)}
          >
            <Icon size={16} />
            <div>
              <strong>{item.label}</strong>
              <span>{item.hint}</span>
            </div>
          </div>
        );
      })}
      <p className="small muted" style={{ marginTop: 12 }}>
        Draw arrows between the crimson dots. Select a step to rename it in the inspector.
      </p>
    </aside>
  );
}

function StudioInner({
  diagram,
  onSave,
  saving,
}: {
  diagram: Diagram;
  onSave: (next: Pick<Diagram, "lanes" | "nodes" | "edges">) => Promise<unknown> | void;
  saving?: boolean;
}) {
  const { screenToFlowPosition, getNodes } = useReactFlow();
  const seed = useMemo(() => diagramToFlow(diagram), [diagram.id]);
  const [nodes, setNodes, onNodesChange] = useNodesState(seed.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(seed.edges);
  const [dirty, setDirty] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const ignoreMeasure = useRef(true);

  useEffect(() => {
    const next = diagramToFlow(diagram);
    setNodes(next.nodes);
    setEdges(next.edges);
    setDirty(false);
    setSelectedId(null);
    setSelectedEdge(null);
    ignoreMeasure.current = true;
    const t = window.setTimeout(() => {
      ignoreMeasure.current = false;
    }, 700);
    return () => window.clearTimeout(t);
  }, [diagram.id, setNodes, setEdges]);

  const onConnect: OnConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: "smoothstep",
            style: { stroke: "#9c1d33", strokeWidth: 1.7 },
            markerEnd: { type: "arrowclosed", color: "#9c1d33" },
          },
          eds,
        ),
      );
      setDirty(true);
    },
    [setEdges],
  );

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const placeStep = useCallback(
    (kind: StepKind, flowPos?: { x: number; y: number }) => {
      const current = getNodes();
      const lanes = current.filter((n) => n.type === "lane");
      const selected = current.find((n) => n.id === selectedId);
      const parent =
        (flowPos ? findLaneAt(current, flowPos) : undefined) ||
        (selected?.type === "lane" ? selected : undefined) ||
        lanes[0];
      const kids = current.filter((n) => n.parentId === parent?.id);
      const position =
        flowPos && parent
          ? {
              x: Math.max(16, flowPos.x - parent.position.x - 60),
              y: Math.max(48, flowPos.y - parent.position.y - 20),
            }
          : { x: 40, y: 56 + kids.length * 124 };
      const id = `${kind}-${crypto.randomUUID().slice(0, 8)}`;
      const node: Node = {
        id,
        type: kind,
        position,
        parentId: parent?.id,
        extent: parent ? "parent" : undefined,
        data: { label: defaultLabel(kind), kind },
        draggable: true,
      };
      setNodes((nds) => nds.concat(node));
      setSelectedId(id);
      setSelectedEdge(null);
      setDirty(true);
    },
    [getNodes, selectedId, setNodes],
  );

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData(DND_MIME) || event.dataTransfer.getData("text/plain");
      if (!KINDS.has(raw as StepKind)) return;
      const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      placeStep(raw as StepKind, flowPos);
    },
    [placeStep, screenToFlowPosition],
  );

  const addLane = () => {
    const lanes = nodes.filter((n) => n.type === "lane");
    const id = `lane-${crypto.randomUUID().slice(0, 6)}`;
    setNodes((nds) =>
      nds.concat({
        id,
        type: "lane",
        position: { x: lanes.length * LANE_W, y: 0 },
        data: { label: `Partition ${lanes.length + 1}` },
        style: { width: LANE_W - 12, height: LANE_H },
        width: LANE_W - 12,
        height: LANE_H,
      }),
    );
    setDirty(true);
  };

  const selectedNode = nodes.find((n) => n.id === selectedId);
  const selectedEd = edges.find((e) => e.id === selectedEdge);

  const updateSelectedLabel = (label: string) => {
    if (selectedNode) {
      setNodes((nds) => nds.map((n) => (n.id === selectedNode.id ? { ...n, data: { ...n.data, label } } : n)));
      setDirty(true);
    }
  };

  const deleteSelected = () => {
    if (selectedEdge) {
      setEdges((eds) => eds.filter((e) => e.id !== selectedEdge));
      setSelectedEdge(null);
      setDirty(true);
      return;
    }
    if (!selectedNode) return;
    if (selectedNode.type === "lane") {
      setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id && n.parentId !== selectedNode.id));
    } else {
      setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
      setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
    }
    setSelectedId(null);
    setDirty(true);
  };

  const stepCount = nodes.filter((n) => n.type !== "lane").length;

  return (
    <div className="workflow-studio">
      <Palette onPick={placeStep} />
      <div className="wf-canvas" onDragOver={onDragOver} onDrop={onDrop}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={(c) => {
            onNodesChange(c);
            if (ignoreMeasure.current) return;
            if (c.some((x) => x.type !== "select")) setDirty(true);
          }}
          onEdgesChange={(c) => {
            onEdgesChange(c);
            if (ignoreMeasure.current) return;
            if (c.some((x) => x.type !== "select")) setDirty(true);
          }}
          onConnect={onConnect}
          nodeTypes={workflowNodeTypes}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onSelectionChange={({ nodes: ns, edges: es }) => {
            setSelectedId(ns[0]?.id ?? null);
            setSelectedEdge(es[0]?.id ?? null);
          }}
          isValidConnection={(c) =>
            !!c.source &&
            !!c.target &&
            c.source !== c.target &&
            !String(c.source).startsWith("lane-") &&
            !String(c.target).startsWith("lane-")
          }
          connectionLineType={ConnectionLineType.SmoothStep}
          defaultEdgeOptions={{
            type: "smoothstep",
            style: { stroke: "#9c1d33", strokeWidth: 1.7 },
          }}
          fitView
          deleteKeyCode={["Backspace", "Delete"]}
          proOptions={{ hideAttribution: true }}
          snapToGrid
          snapGrid={[16, 16]}
        >
          <Background color="#d4c9b8" gap={16} />
          <MiniMap pannable zoomable />
          <Controls />
          <Panel position="top-right" className="wf-toolbar nodrag nopan">
            <Btn kind="ghost" onClick={addLane}>
              <span className="wf-btn-inner">
                <Columns3 size={14} /> Lane
              </span>
            </Btn>
            <Btn
              kind="ghost"
              onClick={() => {
                setNodes((nds) => arrangeByLane(nds));
                setDirty(true);
              }}
            >
              <span className="wf-btn-inner">
                <LayoutGrid size={14} /> Arrange
              </span>
            </Btn>
            <Btn
              disabled={!dirty || saving}
              onClick={async () => {
                await onSave(flowToDiagram(diagram, nodes, edges));
                setDirty(false);
              }}
            >
              {saving ? "Saving…" : dirty ? "Save workflow" : "Saved"}
            </Btn>
          </Panel>
          {!stepCount && (
            <Panel position="bottom-center" className="wf-hint nodrag nopan">
              Drag a Start or Action from the left onto a swimlane to begin the flow.
            </Panel>
          )}
        </ReactFlow>
      </div>
      <aside className="wf-inspector">
        <div className="eyebrow">Inspector</div>
        {!selectedNode && !selectedEd && (
          <p className="small muted">Select a step or a connection. Drag from the left palette onto a swimlane.</p>
        )}
        {selectedNode && (
          <div className="form-grid">
            <Field label={selectedNode.type === "lane" ? "Lane name" : "Step name"}>
              <input
                value={String((selectedNode.data as { label?: string }).label || "")}
                onChange={(e) => updateSelectedLabel(e.target.value)}
              />
            </Field>
            {selectedNode.type !== "lane" && (
              <p className="small muted">Kind: {String((selectedNode.data as { kind?: string }).kind || selectedNode.type)}</p>
            )}
            <Btn kind="danger" onClick={deleteSelected}>
              Delete
            </Btn>
          </div>
        )}
        {selectedEd && (
          <div className="form-grid">
            <Field label="Flow label (yes / no / signal)">
              <input
                value={typeof selectedEd.label === "string" ? selectedEd.label : ""}
                onChange={(e) => {
                  const label = e.target.value;
                  setEdges((eds) => eds.map((x) => (x.id === selectedEd.id ? { ...x, label } : x)));
                  setDirty(true);
                }}
              />
            </Field>
            <Btn kind="danger" onClick={deleteSelected}>
              Remove connection
            </Btn>
          </div>
        )}
      </aside>
    </div>
  );
}

export function WorkflowStudio({
  diagram,
  onSave,
  saving,
}: {
  diagram: Diagram;
  onSave: (next: Pick<Diagram, "lanes" | "nodes" | "edges">) => Promise<unknown> | void;
  saving?: boolean;
}) {
  return (
    <ReactFlowProvider>
      <StudioInner diagram={diagram} onSave={onSave} saving={saving} />
    </ReactFlowProvider>
  );
}
