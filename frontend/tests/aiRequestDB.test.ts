import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { aiRequestDB, generateId } from '../lib/db';

describe('aiRequestDB basic operations', () => {
  beforeEach(async () => {
    // clear all requests
    const all = await aiRequestDB.getAll();
    await Promise.all(all.map(r => aiRequestDB.delete(r.id)));
  });

  it('saves and retrieves queued requests', async () => {
    const id = generateId();
    const now = new Date().toISOString();
    const req = {
      id,
      encounterId: 'enc-1',
      patientId: 'pat-1',
      type: 'chat',
      payload: JSON.stringify({ text: 'hello' }),
      response: null,
      status: 'queued',
      createdAt: now,
      completedAt: null,
    };

    await aiRequestDB.save(req as any);
    const queued = await aiRequestDB.getQueued();
    expect(queued.length).toBe(1);
    expect(queued[0].id).toBe(id);
  });

  it('transitions processing -> completed', async () => {
    const id = generateId();
    const now = new Date().toISOString();
    const req = {
      id,
      encounterId: 'enc-1',
      patientId: 'pat-1',
      type: 'chat',
      payload: JSON.stringify({ text: 'test' }),
      response: null,
      status: 'processing',
      createdAt: now,
      completedAt: null,
    };
    await aiRequestDB.save(req as any);

    const saved = await aiRequestDB.getById(id);
    expect(saved).not.toBeNull();
    if (saved) {
      saved.status = 'completed';
      saved.response = 'ok';
      saved.completedAt = new Date().toISOString();
      await aiRequestDB.save(saved);
    }

    const fetched = await aiRequestDB.getById(id);
    expect(fetched?.status).toBe('completed');
    expect(fetched?.response).toBe('ok');
  });
});
