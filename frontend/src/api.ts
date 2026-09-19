import type { Artifact, BomItem, Diagram, Finding, LinkRow, Project, Quality, Report, TraceMatrix, VNode } from "./types";

async function http<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

export const api = {
  projects: () => http<Project[]>("/api/projects"),
  project: (id: string) => http<Project>(`/api/projects/${id}`),
  quality: (id: string) => http<Quality>(`/api/projects/${id}/quality`),
  artifacts: (id: string, viewpoint?: string) =>
    http<Artifact[]>(`/api/projects/${id}/artifacts${viewpoint ? `?viewpoint=${viewpoint}` : ""}`),
  vmodel: (id: string) => http<VNode[]>(`/api/projects/${id}/v-model`),
  findings: (id: string) => http<Finding[]>(`/api/projects/${id}/findings`),
  links: (id: string) => http<LinkRow[]>(`/api/projects/${id}/traceability`),
  matrix: (id: string) => http<TraceMatrix>(`/api/projects/${id}/trace-matrix`),
  diagrams: (id: string) => http<Diagram[]>(`/api/projects/${id}/diagrams`),
  diagram: (id: string, did: string) => http<Diagram>(`/api/projects/${id}/diagrams/${did}`),
  bom: (id: string) => http<BomItem[]>(`/api/projects/${id}/bom`),
  tests: (id: string) => http<Artifact[]>(`/api/projects/${id}/tests`),
  report: (id: string) => http<Report>(`/api/projects/${id}/report`),
};
