/**
 * LogsDat store — encrypted append-only session memory.
 */
import type { RecoFreePersona } from "@/lib/types/memory/memoryCore.types";
import type {
  LogsDatPlaintext,
  LogsDatEncryptedEnvelope,
  SessionLogSummary,
  LogsRoutingAuditEntry,
} from "@/lib/types/memory/logsDat.types";
import { createEmptyLogsDat } from "@/lib/types/memory/logsDat.types";
import { encryptJsonAes256Gcm, decryptJsonAes256Gcm } from "@/lib/storage/crypto/aes256gcm";
import { readJson, writeJson } from "./atomicJsonStore";
import { getLogsDatKey, getEncryptionKeyAlias } from "./localMemoryPaths";

export interface LogsDatStore {
  load(persona: RecoFreePersona): Promise<LogsDatPlaintext>;
  save(persona: RecoFreePersona, data: LogsDatPlaintext): Promise<void>;
  appendSessionSummary(persona: RecoFreePersona, summary: SessionLogSummary): Promise<void>;
  appendRoutingAudit(persona: RecoFreePersona, audit: LogsRoutingAuditEntry): Promise<void>;
}

export function createLogsDatStore(): LogsDatStore {
  return {
    async load(persona) {
      const key = getLogsDatKey(persona);
      const envelope = await readJson<LogsDatEncryptedEnvelope>(key);

      if (!envelope) {
        return createEmptyLogsDat(persona);
      }

      if (envelope.schemaVersion !== "logs.dat.encrypted.v2") {
        // Unrecognized format, start fresh but don't overwrite
        return createEmptyLogsDat(persona);
      }

      try {
        const plaintext = await decryptJsonAes256Gcm<LogsDatPlaintext>(envelope);
        return plaintext;
      } catch {
        // Decrypt failed — do NOT overwrite existing file
        console.error("[LogsDatStore] Decrypt failed, returning empty (preserving existing file)");
        return createEmptyLogsDat(persona);
      }
    },

    async save(persona, data) {
      const key = getLogsDatKey(persona);
      const keyAlias = getEncryptionKeyAlias(persona);
      const envelope = await encryptJsonAes256Gcm(keyAlias, persona, data);
      await writeJson(key, envelope);
    },

    async appendSessionSummary(persona, summary) {
      const data = await this.load(persona);
      data.sessions.push(summary);
      data.updatedAt = new Date().toISOString();
      await this.save(persona, data);
    },

    async appendRoutingAudit(persona, audit) {
      const data = await this.load(persona);
      data.routingAudits.push(audit);
      data.updatedAt = new Date().toISOString();
      await this.save(persona, data);
    },
  };
}
