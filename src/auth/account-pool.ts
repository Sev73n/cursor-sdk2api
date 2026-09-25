import { compareAccountOrder, type StoredCursorAccount } from "../account/file-store.js";

export class CursorAccountPool {
  private readonly cursors = new Map<string, number>();

  reset(): void {
    this.cursors.clear();
  }

  pick(accounts: StoredCursorAccount[], routeKey: string): StoredCursorAccount | undefined {
    if (accounts.length === 0) return undefined;
    const ordered = [...accounts].sort(compareAccountOrder);
    const cursor = this.cursors.get(routeKey) ?? 0;
    const selected = ordered[cursor % ordered.length];
    this.cursors.set(routeKey, (cursor + 1) % ordered.length);
    return selected;
  }
}
