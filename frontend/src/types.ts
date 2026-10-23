export type Quality = {
  score: number;
  coverage: number;
  progress: number;
  requirements: number;
  verified_requirements: number;
  tests: number;
  tests_passed: number;
  open_gaps: number;
  critical: number;
  by_viewpoint: Record<string, { count: number; progress: number; verified: number }>;
  by_domain: Record<string, { count: number; progress: number; verified: number }>;
  config_id?: string | null;
  config_name?: string;
  mode?: string;
};

export type Project = {
  id: string;
  slug: string;
  name: string;
  product_type: string;
  description: string;
  created_at: string;
  quality?: Quality;
};

export type Artifact = {
  id: string;
  project_id: string;
  parent_id: string | null;
  identifier: string;
  title: string;
  description: string;
  viewpoint: string;
  domain: string;
  kind: string;
  status: string;
  owner: string;
  v_node_key: string;
  progress: number;
  extra: Record<string, unknown>;
  effectivity?: Record<string, string[]>;
};

export type VNode = {
  id: string;
  key: string;
  name: string;
  domain: string;
  side: string;
  row: number;
  counterpart_key: string;
  description: string;
  artifact_count: number;
  coverage: number;
  progress: number;
  verified: number;
  gaps: number;
  status: string;
};

export type Finding = {
  id: string;
  artifact_id: string | null;
  rule: string;
  severity: string;
  title: string;
  detail: string;
  status: string;
};

export type LinkRow = {
  id: string;
  source_id: string;
  target_id: string;
  link_type: string;
  source_identifier: string;
  source_title: string;
  target_identifier: string;
  target_title: string;
};

export type Diagram = {
  id: string;
  identifier: string;
  title: string;
  description: string;
  lanes: { id: string; title: string; subtitle?: string }[];
  nodes: { id: string; lane: string; label: string; kind: string; x: number; y: number }[];
  edges: { from: string; to: string; label?: string }[];
  notes: { label: string; ref?: string }[];
};

export type BomItem = {
  id: string;
  part_number: string;
  name: string;
  qty: number;
  unit: string;
  category: string;
  supplier: string;
  linked_artifact_id: string | null;
  extra?: Record<string, unknown>;
  effectivity?: Record<string, string[]>;
};

export type Report = {
  project: Project;
  generated_at: string;
  quality: Quality;
  v_model: VNode[];
  findings: Finding[];
  missing_links: { identifier: string; title: string; missing: string[] }[];
  narrative: string;
};

export type TraceMatrix = {
  rows: {
    id: string;
    identifier: string;
    title: string;
    viewpoint: string;
    status: string;
    linked: { id: string; identifier: string; title: string }[];
    missing: number;
  }[];
  functions: { id: string; identifier: string; title: string }[];
};

export type VariantValue = {
  id: string;
  variant_id: string;
  key: string;
  name: string;
  sort_order: number;
};

export type Variant = {
  id: string;
  project_id: string;
  key: string;
  name: string;
  description: string;
  sort_order: number;
  values: VariantValue[];
};

export type ProductConfiguration = {
  id: string;
  project_id: string;
  key: string;
  name: string;
  description: string;
  selection: Record<string, string>;
};

export type ConfigDictionary = {
  variants: Variant[];
  configurations: ProductConfiguration[];
};

export type ConfigCompare = {
  left: ProductConfiguration;
  right: ProductConfiguration;
  quality_left: Quality;
  quality_right: Quality;
  quality_delta: { score: number; coverage: number; open_gaps: number };
  requirements: { only_left: { identifier: string; title: string }[]; only_right: { identifier: string; title: string }[]; shared: number };
  tests: { only_left: { identifier: string; title: string }[]; only_right: { identifier: string; title: string }[]; shared: number };
  bom: { only_left: { part_number: string; name: string }[]; only_right: { part_number: string; name: string }[]; shared: number };
};
