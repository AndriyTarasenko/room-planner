/** In-memory Storage for tests (the test environment has no localStorage). */
export class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  /** When set, setItem throws like a full browser storage. */
  failWrites = false;

  get length() {
    return this.data.size;
  }

  clear() {
    this.data.clear();
  }

  getItem(key: string) {
    return this.data.get(key) ?? null;
  }

  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.data.delete(key);
  }

  setItem(key: string, value: string) {
    if (this.failWrites) throw new DOMException('Quota exceeded', 'QuotaExceededError');
    this.data.set(key, String(value));
  }
}
