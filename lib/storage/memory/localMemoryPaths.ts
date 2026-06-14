/**
 * Local file paths for memory layers.
 * All memory persists on-device only.
 */
import type { RecoFreePersona } from "@/lib/types/memory/memoryCore.types";

const MEMORY_DIR = "recofree_memory";

export function getUserDatKey(persona: RecoFreePersona): string {
  return `${MEMORY_DIR}/${persona}/user.dat`;
}

export function getStateDatKey(persona: RecoFreePersona): string {
  return `${MEMORY_DIR}/${persona}/state.dat`;
}

export function getProjectionsDatKey(persona: RecoFreePersona): string {
  return `${MEMORY_DIR}/${persona}/projections.dat`;
}

export function getLogsDatKey(persona: RecoFreePersona): string {
  return `${MEMORY_DIR}/${persona}/logs.dat`;
}

export function getEncryptionKeyAlias(persona: RecoFreePersona): string {
  return `recofree_logs_key_${persona}`;
}
