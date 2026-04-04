import { rm } from "node:fs/promises";

type RuntimeEntry = {
  sourceRootPath: string;
  tempDirPath?: string;
};

export class RuntimeRegistry {
  private entries = new Map<string, RuntimeEntry>();

  register(runtimeManualId: string, entry: RuntimeEntry) {
    this.entries.set(runtimeManualId, entry);
  }

  get(runtimeManualId: string) {
    return this.entries.get(runtimeManualId) ?? null;
  }

  async abandon(runtimeManualId: string) {
    const entry = this.entries.get(runtimeManualId);
    if (!entry) {
      return;
    }

    this.entries.delete(runtimeManualId);
    if (entry.tempDirPath) {
      await rm(entry.tempDirPath, { recursive: true, force: true });
    }
  }

  async abandonAll() {
    const runtimeIds = [...this.entries.keys()];
    await Promise.all(runtimeIds.map((runtimeId) => this.abandon(runtimeId)));
  }
}
