import { Route, Routes } from "react-router-dom";
import { ProjectShell } from "./App";
import { Home } from "./pages/Home";
import { Overview } from "./pages/Overview";
import { VModelPage } from "./pages/VModelPage";
import { RflpPage } from "./pages/RflpPage";
import { DiagramsPage } from "./pages/DiagramsPage";
import { TraceabilityPage } from "./pages/TraceabilityPage";
import { ArtifactsPage } from "./pages/ArtifactsPage";
import { TestsPage } from "./pages/TestsPage";
import { ReportPage } from "./pages/ReportPage";

export function RoutesApp() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/projects/:id" element={<ProjectShell />}>
        <Route index element={<Overview />} />
        <Route path="v-model" element={<VModelPage />} />
        <Route path="rflp" element={<RflpPage />} />
        <Route path="diagrams" element={<DiagramsPage />} />
        <Route path="traceability" element={<TraceabilityPage />} />
        <Route path="artifacts" element={<ArtifactsPage />} />
        <Route path="tests" element={<TestsPage />} />
        <Route path="report" element={<ReportPage />} />
      </Route>
    </Routes>
  );
}
