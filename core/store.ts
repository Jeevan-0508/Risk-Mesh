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
    this.items.set(item.id, item);
    return item;
  }

  get(id: string): T | undefined {
    return this.items.get(id);
  }

  require(id: string): T {
    const item = this.items.get(id);
    if (!item) throw new NotFoundError(id);
    return item;
  }

  list(): T[] {
    return [...this.items.values()];
  }

  /** Replaces the stored item wholesale. Callers decide what "wholesale" means (e.g. a new status). */
  replace(id: string, next: T): T {
    this.require(id);
    this.items.set(id, next);
    return next;
  }

  size(): number {
    return this.items.size;
  }
}
