/**
 * One generic in-memory store, reused by the evidence fabric, case engine, and every other MESH
 * object store instead of hand-writing the same Map<id, T> CRUD seventeen times. It has no opinion
 * about status transitions or event emission — those are each store's own rules, layered on top.
 */
export class DuplicateIdError extends Error {
  constructor(id: string) {
    super(`MESH object with id "${id}" already exists — ids are never reused, corrections are new objects (spec §42).`);
  }
}

export class NotFoundError extends Error {
  constructor(id: string) {
    super(`No MESH object with id "${id}".`);
  }
}

export class MeshStore<T extends { id: string }> {
  private readonly items = new Map<string, T>();

  add(item: T): T {
    if (this.items.has(item.id)) throw new DuplicateIdError(item.id);
    this.items.set(item.id, structuredClone(item));
    return structuredClone(item);
  }

  get(id: string): T | undefined {
    const item = this.items.get(id);
    return item === undefined ? undefined : structuredClone(item);
  }

  require(id: string): T {
    const item = this.items.get(id);
    if (!item) throw new NotFoundError(id);
    return structuredClone(item);
  }

  list(): T[] {
    return structuredClone([...this.items.values()]);
  }

  /** Replaces the stored item wholesale. Callers decide what "wholesale" means (e.g. a new status). */
  replace(id: string, next: T): T {
    this.require(id);
    if (next.id !== id) throw new Error('A replacement cannot change object identity');
    this.items.set(id, structuredClone(next));
    return structuredClone(next);
  }

  size(): number {
    return this.items.size;
  }
}
