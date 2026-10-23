import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { ConfigDictionary, ProductConfiguration } from "./types";

type Mode = "150" | "100";

type Stored = { mode: Mode; configId: string | null };

type ConfigState = {
  projectId: string;
  mode: Mode;
  configId: string | null;
  activeConfigId: string | null;
  activeConfig: ProductConfiguration | undefined;
  dictionary?: ConfigDictionary;
  setMode: (mode: Mode) => void;
  setConfigId: (id: string | null) => void;
};

const ConfigContext = createContext<ConfigState | null>(null);

function storageKey(projectId: string) {
  return `oqg-config:${projectId}`;
}

function readStored(projectId: string): Stored {
  try {
    const raw = sessionStorage.getItem(storageKey(projectId));
    if (!raw) return { mode: "100", configId: null };
    return JSON.parse(raw) as Stored;
  } catch {
    return { mode: "100", configId: null };
  }
}

export function ConfigProvider({ projectId, children }: { projectId: string; children: ReactNode }) {
  const stored = readStored(projectId);
  const [mode, setModeState] = useState<Mode>(stored.mode);
  const [configId, setConfigIdState] = useState<string | null>(stored.configId);
  const dict = useQuery({
    queryKey: ["dictionary", projectId],
    queryFn: () => api.dictionary(projectId),
    enabled: !!projectId,
  });

  useEffect(() => {
    const configs = dict.data?.configurations || [];
    if (!configs.length) return;
    if (!configId || !configs.some((c) => c.id === configId)) {
      setConfigIdState(configs[0].id);
    }
  }, [dict.data, configId]);

  useEffect(() => {
    sessionStorage.setItem(storageKey(projectId), JSON.stringify({ mode, configId }));
  }, [projectId, mode, configId]);

  const activeConfig = (dict.data?.configurations || []).find((c) => c.id === configId);
  const value = useMemo<ConfigState>(
    () => ({
      projectId,
      mode,
      configId,
      activeConfigId: mode === "100" ? configId : null,
      activeConfig,
      dictionary: dict.data,
      setMode: setModeState,
      setConfigId: setConfigIdState,
    }),
    [projectId, mode, configId, activeConfig, dict.data],
  );

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useProjectConfig() {
  const ctx = useContext(ConfigContext);
  if (!ctx) {
    return {
      projectId: "",
      mode: "150" as Mode,
      configId: null,
      activeConfigId: null,
      activeConfig: undefined,
      dictionary: undefined,
      setMode: () => undefined,
      setConfigId: () => undefined,
    };
  }
  return ctx;
}

export function formatEffectivity(expr?: Record<string, string[]> | null) {
  if (!expr || !Object.keys(expr).length) return "common";
  return Object.entries(expr)
    .map(([key, values]) => `${key}=${values.join("|")}`)
    .join(" · ");
}
