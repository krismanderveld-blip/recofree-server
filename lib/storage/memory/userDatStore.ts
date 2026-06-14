/**
 * UserDat store — load/save user.dat from local storage.
 */
import type { RecoFreePersona } from "@/lib/types/memory/memoryCore.types";
import type { UserDat } from "@/lib/types/memory/userDat.types";
import { createEmptyUserDat } from "@/lib/types/memory/userDat.types";
import { readJson, writeJson } from "./atomicJsonStore";
import { getUserDatKey } from "./localMemoryPaths";

export interface UserDatStore {
  load(persona: RecoFreePersona, localUserId: string): Promise<UserDat>;
  save(userDat: UserDat): Promise<void>;
}

export function createUserDatStore(): UserDatStore {
  return {
    async load(persona, localUserId) {
      const key = getUserDatKey(persona);
      const existing = await readJson<UserDat>(key);
      if (existing && existing.schemaVersion === "user.dat.v2") {
        return existing;
      }
      // Initialize empty
      const empty = createEmptyUserDat(persona, localUserId);
      await writeJson(key, empty);
      return empty;
    },
    async save(userDat) {
      const key = getUserDatKey(userDat.persona);
      await writeJson(key, userDat);
    },
  };
}
