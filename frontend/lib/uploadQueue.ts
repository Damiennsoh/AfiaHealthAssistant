import { uploadDB, aiRequestDB, generateId } from './db';

const MAX_ATTEMPTS = 4;
const BACKOFF_BASE_MS = 1000;
let _running = false;
let _processing = false;
let _needsProcessing = false;
let _unsubscribe: (() => void) | null = null;

async function processQueue() {
  if (_processing) {
    _needsProcessing = true;
    return;
  }
  
  _processing = true;
  _needsProcessing = false;

  try {
    await processOnce();
  } catch (err) {
    console.error("Error processing upload queue:", err);
  } finally {
    _processing = false;
    if (_needsProcessing && _running) {
      processQueue();
    }
  }
}

export function startUploadProcessor() {
  if (_running) return;
  _running = true;
  
  // Initial check
  processQueue();

  // Subscribe to changes
  _unsubscribe = uploadDB.subscribe(() => {
    if (_running) processQueue();
  });
}

export function stopUploadProcessor() {
  if (!_running) return;
  _running = false;
  if (_unsubscribe) {
    _unsubscribe();
    _unsubscribe = null;
  }
}

export async function enqueueUpload(blob: Blob, name: string, contentType: string) {
  const id = generateId();
  const now = new Date().toISOString();
  const task = {
    id,
    name,
    contentType,
    blob,
    status: 'pending',
    attempts: 0,
    progress: 0,
    s3Key: null,
    createdAt: now,
    updatedAt: now,
  } as any;
  await uploadDB.save(task);
  return task;
}

async function presign(name: string, contentType: string) {
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, contentType }),
  });
  if (!res.ok) throw new Error('presign failed');
  return res.json();
}

async function doPutWithProgress(url: string, blob: Blob, onProgress?: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url);
      xhr.setRequestHeader('Content-Type', blob.type || 'application/octet-stream');
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          const p = Math.round((e.loaded / e.total) * 100);
          onProgress(p);
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error('put failed'));
      };
      xhr.onerror = () => reject(new Error('put failed'));
      xhr.send(blob as any);
    } catch (err) {
      reject(err);
    }
  });
}

async function processOnce() {
  const pending = await uploadDB.getPending();
  for (const t of pending) {
    try {
      // update to uploading
      t.status = 'uploading';
      t.attempts = (t.attempts || 0) + 1;
      t.updatedAt = new Date().toISOString();
      t.progress = 0;
      await uploadDB.save(t);

      const presignResponse = await presign(t.name, t.contentType);
      const presignedPutUrl = presignResponse.putUrl || presignResponse.url;
      const s3Key = presignResponse.key;

      // perform PUT with progress callback that updates the DB
      await doPutWithProgress(presignedPutUrl, t.blob, async (p) => {
        t.progress = p;
        t.updatedAt = new Date().toISOString();
        await uploadDB.save(t);
      });

      t.status = 'uploaded';
      t.s3Key = s3Key;
      t.progress = 100;
      t.updatedAt = new Date().toISOString();
      await uploadDB.save(t);

      // After a successful upload, create an image-analysis AI request referencing the s3 key
      const aiReq = {
        id: generateId(),
        encounterId: '',
        patientId: '',
        type: 'image-analysis',
        payload: JSON.stringify({ s3Key, name: t.name }),
        response: null,
        status: 'queued',
        createdAt: new Date().toISOString(),
        completedAt: null,
      } as any;
      await aiRequestDB.save(aiReq);

    } catch (err: any) {
      t.updatedAt = new Date().toISOString();
      if ((t.attempts || 0) >= MAX_ATTEMPTS) {
        t.status = 'failed';
        t.progress = 0;
      } else {
        t.status = 'pending';
        // exponential backoff sleep
        const backoff = BACKOFF_BASE_MS * Math.pow(2, (t.attempts || 1) - 1);
        await new Promise((r) => setTimeout(r, backoff));
      }
      await uploadDB.save(t);
    }
  }
}

const uploadQueueUtils = {
  enqueueUpload,
  startUploadProcessor,
  stopUploadProcessor,
};

export default uploadQueueUtils;
