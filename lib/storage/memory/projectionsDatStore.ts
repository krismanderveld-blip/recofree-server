/**
 * ProjectionsDat store — load/save projections.dat from local storage.
 */
import type { RecoFreePersona } from "@/lib/types/memory/memoryCore.types";
import type { ProjectionsDat } from "@/lib/types/memory/projectionsDat.types";
import { createEmptyProjectionsDat } from "@/lib/types/memory/projectionsDat.types";
import { readJson, writeJson } from "./atomicJsonStore";
import { getProjectionsDatKey } from "./localMemoryPaths";

export interface ProjectionsDatStore {
  load(persona: RecoFreePersona): Promise<ProjectionsDat>;
  save(projDat: ProjectionsDat): Promise<void>;
}

export function createProjectionsDatStore(): ProjectionsDatStore {
  return {
    async load(persona) {
      const key = getProjectionsDatKey(persona);
      const existing = await readJson<ProjectionsDat>(key);
      if (existing && existing.schemaVersion === "projections.dat.v2") {
        return existing;
      }
      const empty = createEmptyProjectionsDat(persona);
      await writeJson(key, empty);
      return empty;
    },
    async save(projDat) {
      const key = getProjectionsDatKey(projDat.persona);
      await writeJson(key, projDat);
    },
  };
}
