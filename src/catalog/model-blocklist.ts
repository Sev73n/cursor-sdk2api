import { chmodSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { ensurePrivateDir } from "../core/lineage-store.js";

// Operator catalog blocklist: the console keeps the full catalog; GET /v1/models omits blocked ids.

const MODEL_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MAX_IDS = 256;

interface BlocklistFile {
  version: 1;
  ids: string[];
}

export class ModelBlocklistError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelBlocklistError";
  }
}

export class ModelBlocklist {
  readonly path: string;

  constructor(stateDir: string) {
    ensurePrivateDir(stateDir);
    this.path = join(stateDir, "model-blocklist.json");
  }

  list(): string[] {
    return this.read();
  }

  set(id: string, blocked: boolean): string[] {
    const modelId = id.trim();
    if (!MODEL_ID_RE.test(modelId)) throw new ModelBlocklistError("model id is invalid");
    const current = this.read();
    const next = blocked
      ? [...new Set([...current, modelId])].sort((left, right) => left.localeCompare(right))
      : current.filter((item) => item !== modelId);
    if (next.length > MAX_IDS) throw new ModelBlocklistError("model blocklist is full");
    if (sameIds(current, next)) return current;
    this.write(next);
    return next;
  }

  private read(): string[] {
    try {
      const parsed = JSON.parse(readFileSync(this.path, "utf8")) as unknown;
      if (!isBlocklistFile(parsed)) return [];
      return parsed.ids;
    } catch {
      return [];
    }
  }

  private write(ids: string[]): void {
    const tmp = `${this.path}.${process.pid}.${randomUUID()}.tmp`;
    const body = JSON.stringify({ version: 1, ids } satisfies BlocklistFile);
    try {
      writeFileSync(tmp, body, { encoding: "utf8", mode: 0o600 });
      renameSync(tmp, this.path);
      try {
        chmodSync(this.path, 0o600);
      } catch {
        // best effort on filesystems that ignore mode
      }
    } catch (error) {
      try {
        unlinkSync(tmp);
      } catch {
        // best effort cleanup
      }
      throw error;
    }
  }
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function isBlocklistFile(value: unknown): value is BlocklistFile {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Partial<BlocklistFile>;
  return record.version === 1
    && Array.isArray(record.ids)
    && record.ids.every((id) => typeof id === "string" && MODEL_ID_RE.test(id));
}
