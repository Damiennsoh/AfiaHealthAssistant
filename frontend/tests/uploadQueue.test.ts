import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { enqueueUpload, startUploadProcessor, stopUploadProcessor } from '../lib/uploadQueue';
import { uploadDB } from '../lib/db';

describe('upload queue', () => {
  beforeEach(async () => {
    const all = await uploadDB.getAll();
    await Promise.all(all.map((a) => uploadDB.delete(a.id)));
  });

  it('retries failed PUTs with backoff and succeeds', async () => {
    // mock fetch for presign
    vi.stubGlobal('fetch', async (url: any, opts: any) => {
      if (url === '/api/upload') {
        return {
          ok: true,
          json: async () => ({ putUrl: 'https://signed.example.com/put', key: 'uploads/test-1.jpg' }),
        } as any;
      }
      return { ok: false } as any;
    });

    // Provide a fake XMLHttpRequest that fails the first two PUT attempts then succeeds
    let putAttempts = 0;
    class FakeXHR {
      public status = 0;
      public upload: any = {};
      private onload: any = null;
      private onerror: any = null;
      open(method: string, url: string) {}
      setRequestHeader() {}
      send(_body: any) {
        putAttempts++;
        // simulate progress
        const total = 100;
        let loaded = 0;
        const iv = setInterval(() => {
          loaded += 25;
          if (this.upload && this.upload.onprogress) {
            this.upload.onprogress({ lengthComputable: true, loaded, total });
          }
          if (loaded >= total) {
            clearInterval(iv);
            // fail first two attempts
            if (putAttempts <= 2) {
              this.status = 500;
              if (this.onerror) this.onerror(new Error('network'));
            } else {
              this.status = 200;
              if (this.onload) this.onload();
            }
          }
        }, 10);
      }
      addEventListener(name: string, cb: any) {
        if (name === 'load') this.onload = cb;
        if (name === 'error') this.onerror = cb;
      }
    }

    // @ts-ignore
    // Replace global XMLHttpRequest
    (globalThis as any).XMLHttpRequest = FakeXHR as any;

    const blob = new Blob(['hello'], { type: 'text/plain' });
    const task = await enqueueUpload(blob, 'test.txt', 'text/plain');
    expect(task.status).toBe('pending');

    // run processor
    startUploadProcessor();

    // wait until uploaded or timeout
    const timeoutAt = Date.now() + 5000;
    let saved: any = null;
    while (Date.now() < timeoutAt) {
      const all = await uploadDB.getAll();
      saved = all.find((a) => a.id === task.id);
      if (saved && saved.status === 'uploaded') break;
      await new Promise((r) => setTimeout(r, 50));
    }

    stopUploadProcessor();

    expect(saved).toBeDefined();
    expect(saved.status).toBe('uploaded');
    expect(saved.s3Key).toBe('uploads/test-1.jpg');
    expect(putAttempts).toBeGreaterThanOrEqual(3);
  });
});
