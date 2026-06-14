/**
 * StateDat store — load/save state.dat from local storage.
 */
import type { RecoFreePersona } from "@/lib/types/memory/memoryCore.types";
import type { StateDat } from "@/lib/types/memory/stateDat.types";
import { createEmptyStateDat } from "@/lib/types/memory/stateDat.types";
import { readJson, writeJson } from "./atomicJsonStore";
import { getStateDatKey } from "./localMemoryPaths";

export interface StateDatStore {
  load(persona: RecoFreePersona): Promise<StateDat>;
  save(stateDat: StateDat): Promise<void>;
}

export function createStateDatStore(): StateDatStore {
  return {
    async load(persona) {
      const key = getStateDatKey(persona);
      const existing = await readJson<StateDat>(key);
      if (existing && existing.schemaVersion === "state.dat.v2") {
        return existing;
      }
      const empty = createEmptyStateDat(persona);
      await writeJson(key, empty);
      return empty;
    },
    async save(stateDat) {
      const key = getStateDatKey(stateDat.persona);
      await writeJson(key, stateDat);
    },
  };
}
