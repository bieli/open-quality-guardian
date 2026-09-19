import type { Artifact, BomItem, Diagram, Finding, LinkRow, Project, Quality, Report, TraceMatrix, VNode } from "./types";

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

export const api = {
  projects: () => http<Project[]>("/api/projects"),
  project: (id: string) => http<Project>(`/api/projects/${id}`),
  createProject: (body: unknown) => http<Project>("/api/projects", json("POST", body)),
  updateProject: (id: string, body: unknown) => http<Project>(`/api/projects/${id}`, json("PATCH", body)),
  deleteProject: (id: string) => http<void>(`/api/projects/${id}`, { method: "DELETE" }),
  quality: (id: string) => http<Quality>(`/api/projects/${id}/quality`),
  artifacts: (id: string, viewpoint?: string) =>
    http<Artifact[]>(`/api/projects/${id}/artifacts${viewpoint ? `?viewpoint=${viewpoint}` : ""}`),
  createArtifact: (id: string, body: unknown) => http<Artifact>(`/api/projects/${id}/artifacts`, json("POST", body)),
  updateArtifact: (id: string, aid: string, body: unknown) =>
    http<Artifact>(`/api/projects/${id}/artifacts/${aid}`, json("PATCH", body)),
  deleteArtifact: (id: string, aid: string) => http<void>(`/api/projects/${id}/artifacts/${aid}`, { method: "DELETE" }),
  vmodel: (id: string) => http<VNode[]>(`/api/projects/${id}/v-model`),
  findings: (id: string) => http<Finding[]>(`/api/projects/${id}/findings`),
  links: (id: string) => http<LinkRow[]>(`/api/projects/${id}/traceability`),
  createLink: (id: string, body: unknown) => http<LinkRow>(`/api/projects/${id}/traceability`, json("POST", body)),
  deleteLink: (id: string, lid: string) => http<void>(`/api/projects/${id}/traceability/${lid}`, { method: "DELETE" }),
  matrix: (id: string) => http<TraceMatrix>(`/api/projects/${id}/trace-matrix`),
  diagrams: (id: string) => http<Diagram[]>(`/api/projects/${id}/diagrams`),
  diagram: (id: string, did: string) => http<Diagram>(`/api/projects/${id}/diagrams/${did}`),
  createDiagram: (id: string, body: unknown) => http<Diagram>(`/api/projects/${id}/diagrams`, json("POST", body)),
  updateDiagram: (id: string, did: string, body: unknown) =>
    http<Diagram>(`/api/projects/${id}/diagrams/${did}`, json("PUT", body)),
  bom: (id: string) => http<BomItem[]>(`/api/projects/${id}/bom`),
  createBom: (id: string, body: unknown) => http<BomItem>(`/api/projects/${id}/bom`, json("POST", body)),
  updateBom: (id: string, bid: string, body: unknown) => http<BomItem>(`/api/projects/${id}/bom/${bid}`, json("PATCH", body)),
  deleteBom: (id: string, bid: string) => http<void>(`/api/projects/${id}/bom/${bid}`, { method: "DELETE" }),
  tests: (id: string) => http<Artifact[]>(`/api/projects/${id}/tests`),
  report: (id: string) => http<Report>(`/api/projects/${id}/report`),
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
