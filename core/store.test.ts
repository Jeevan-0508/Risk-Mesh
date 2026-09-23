import { describe, expect, it } from 'bun:test';
import { MeshStore, DuplicateIdError, NotFoundError } from './store';

describe('MeshStore', () => {
  it('rejects a duplicate id rather than silently overwriting history', () => {
    const store = new MeshStore<{ id: string; v: number }>();
    store.add({ id: 'a', v: 1 });
    expect(() => store.add({ id: 'a', v: 2 })).toThrow(DuplicateIdError);
  });

  it('throws NotFoundError from require() for a missing id', () => {
    const store = new MeshStore<{ id: string }>();
    expect(() => store.require('missing')) .toThrow(NotFoundError);
  });

  it('list() reflects replace()', () => {
    const store = new MeshStore<{ id: string; v: number }>();
    store.add({ id: 'a', v: 1 });
    store.replace('a', { id: 'a', v: 2 });
    expect(store.get('a')?.v).toBe(2);
    expect(store.list().length).toBe(1);
  });
});
