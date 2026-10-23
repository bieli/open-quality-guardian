import type {
  Artifact,
  BomItem,
  ConfigCompare,
  ConfigDictionary,
  Diagram,
  Finding,
  LinkRow,
  ProductConfiguration,
  Project,
  Quality,
  Report,
  TraceMatrix,
  Variant,
  VariantValue,
  VNode,
} from "./types";

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    let detail = `${res.status} ${path}`;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      /* ignore */
    }
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

function json(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

function qs(params: Record<string, string | undefined | null>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  const s = search.toString();
  return s ? `?${s}` : "";
}

export const api = {
  projects: () => http<Project[]>("/api/projects"),
  project: (id: string) => http<Project>(`/api/projects/${id}`),
  createProject: (body: unknown) => http<Project>("/api/projects", json("POST", body)),
  updateProject: (id: string, body: unknown) => http<Project>(`/api/projects/${id}`, json("PATCH", body)),
  deleteProject: (id: string) => http<void>(`/api/projects/${id}`, { method: "DELETE" }),
  quality: (id: string, configId?: string | null) =>
    http<Quality>(`/api/projects/${id}/quality${qs({ config_id: configId })}`),
  artifacts: (id: string, viewpoint?: string, configId?: string | null) =>
    http<Artifact[]>(`/api/projects/${id}/artifacts${qs({ viewpoint, config_id: configId })}`),
  createArtifact: (id: string, body: unknown) => http<Artifact>(`/api/projects/${id}/artifacts`, json("POST", body)),
  updateArtifact: (id: string, aid: string, body: unknown) =>
    http<Artifact>(`/api/projects/${id}/artifacts/${aid}`, json("PATCH", body)),
  deleteArtifact: (id: string, aid: string) => http<void>(`/api/projects/${id}/artifacts/${aid}`, { method: "DELETE" }),
  vmodel: (id: string, configId?: string | null) =>
    http<VNode[]>(`/api/projects/${id}/v-model${qs({ config_id: configId })}`),
  findings: (id: string, configId?: string | null) =>
    http<Finding[]>(`/api/projects/${id}/findings${qs({ config_id: configId })}`),
  links: (id: string, configId?: string | null) =>
    http<LinkRow[]>(`/api/projects/${id}/traceability${qs({ config_id: configId })}`),
  createLink: (id: string, body: unknown) => http<LinkRow>(`/api/projects/${id}/traceability`, json("POST", body)),
  deleteLink: (id: string, lid: string) => http<void>(`/api/projects/${id}/traceability/${lid}`, { method: "DELETE" }),
  matrix: (id: string, configId?: string | null) =>
    http<TraceMatrix>(`/api/projects/${id}/trace-matrix${qs({ config_id: configId })}`),
  diagrams: (id: string, configId?: string | null) =>
    http<Diagram[]>(`/api/projects/${id}/diagrams${qs({ config_id: configId })}`),
  diagram: (id: string, did: string) => http<Diagram>(`/api/projects/${id}/diagrams/${did}`),
  createDiagram: (id: string, body: unknown) => http<Diagram>(`/api/projects/${id}/diagrams`, json("POST", body)),
  updateDiagram: (id: string, did: string, body: unknown) =>
    http<Diagram>(`/api/projects/${id}/diagrams/${did}`, json("PUT", body)),
  bom: (id: string, configId?: string | null) => http<BomItem[]>(`/api/projects/${id}/bom${qs({ config_id: configId })}`),
  createBom: (id: string, body: unknown) => http<BomItem>(`/api/projects/${id}/bom`, json("POST", body)),
  updateBom: (id: string, bid: string, body: unknown) => http<BomItem>(`/api/projects/${id}/bom/${bid}`, json("PATCH", body)),
  deleteBom: (id: string, bid: string) => http<void>(`/api/projects/${id}/bom/${bid}`, { method: "DELETE" }),
  tests: (id: string, configId?: string | null) =>
    http<Artifact[]>(`/api/projects/${id}/tests${qs({ config_id: configId })}`),
  report: (id: string, configId?: string | null) =>
    http<Report>(`/api/projects/${id}/report${qs({ config_id: configId })}`),
  dictionary: (id: string) => http<ConfigDictionary>(`/api/projects/${id}/config-dictionary`),
  createVariant: (id: string, body: unknown) => http<Variant>(`/api/projects/${id}/variants`, json("POST", body)),
  updateVariant: (id: string, vid: string, body: unknown) =>
    http<Variant>(`/api/projects/${id}/variants/${vid}`, json("PATCH", body)),
  deleteVariant: (id: string, vid: string) => http<void>(`/api/projects/${id}/variants/${vid}`, { method: "DELETE" }),
  createVariantValue: (id: string, vid: string, body: unknown) =>
    http<VariantValue>(`/api/projects/${id}/variants/${vid}/values`, json("POST", body)),
  deleteVariantValue: (id: string, valueId: string) =>
    http<void>(`/api/projects/${id}/variant-values/${valueId}`, { method: "DELETE" }),
  createConfiguration: (id: string, body: unknown) =>
    http<ProductConfiguration>(`/api/projects/${id}/configurations`, json("POST", body)),
  updateConfiguration: (id: string, cid: string, body: unknown) =>
    http<ProductConfiguration>(`/api/projects/${id}/configurations/${cid}`, json("PATCH", body)),
  deleteConfiguration: (id: string, cid: string) =>
    http<void>(`/api/projects/${id}/configurations/${cid}`, { method: "DELETE" }),
  compareConfigurations: (id: string, left: string, right: string) =>
    http<ConfigCompare>(`/api/projects/${id}/config-compare${qs({ left, right })}`),
  wizardProject: (body: unknown) => http<Project>("/api/wizards/project", json("POST", body)),
  wizardRequirement: (id: string, body: unknown) =>
    http<{ created: Artifact[] }>(`/api/projects/${id}/wizards/requirement`, json("POST", body)),
  wizardFunction: (id: string, body: unknown) =>
    http<{ created: Artifact[] }>(`/api/projects/${id}/wizards/function`, json("POST", body)),
  wizardLogical: (id: string, body: unknown) =>
    http<{ created: Artifact[] }>(`/api/projects/${id}/wizards/logical`, json("POST", body)),
  wizardPhysical: (id: string, body: unknown) =>
    http<{ created: Artifact[] }>(`/api/projects/${id}/wizards/physical`, json("POST", body)),
  wizardVerification: (id: string, body: unknown) =>
    http<{ created: Artifact[] }>(`/api/projects/${id}/wizards/verification`, json("POST", body)),
};
