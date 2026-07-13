
import { aiRequestDB, uploadDB, AIRequest } from './db';
import { isNetworkSuitableForAI } from './ai-error-handling';

let _running = false;
let _processing = false;
let _needsProcessing = false;
let _unsubscribe: (() => void) | null = null;
let _onlineListener: (() => void) | null = null;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function processRequest(req: AIRequest) {
  try {
    // Check network
    if (!isNetworkSuitableForAI()) return;

    // Update status to processing
    req.status = 'processing';
    await aiRequestDB.save(req);

    let responseData: any;

    if (req.type === 'image-analysis') {
      let payload: any;
      try {
        payload = JSON.parse(req.payload);
      } catch (e) {
        payload = { s3Key: req.payload }; // Fallback if payload is just a string
      }
      
      const { s3Key } = payload;
      
      // Find associated upload task to get the blob
      // We need the blob because the backend /api/afia expects imageBase64
      const uploads = await uploadDB.getAll();
      const uploadTask = uploads.find(u => u.s3Key === s3Key);

      if (!uploadTask || !uploadTask.blob) {
         throw new Error(`Original image not found for key: ${s3Key}`);
      }

      const base64 = await blobToBase64(uploadTask.blob);
      
      // Call API
      const res = await fetch('/api/afia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: "Analyze this clinical image and provide concise findings.",
          imageBase64: base64,
          concise: true
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `API error: ${res.statusText}`);
      }
      
      const data = await res.json();
      responseData = data.data || data;

    } else if (req.type === 'chat' || req.type === 'diagnosis') {
        let payload: any;
        try {
            payload = JSON.parse(req.payload);
        } catch (e) {
            payload = { text: req.payload };
        }

        const prompt = payload.query || payload.prompt || payload.text || req.payload;
        
        const res = await fetch('/api/afia', {
            method: 'POST',
             headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: prompt,
                concise: true
            })
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.message || errorData.error || `API error: ${res.statusText}`);
        }
        
        const data = await res.json();
        responseData = data.data || data;
    } else {
        throw new Error(`Unknown request type: ${req.type}`);
    }

    // Success
    req.status = 'completed';
    req.response = typeof responseData === 'string' ? responseData : JSON.stringify(responseData);
    req.completedAt = new Date().toISOString();
    await aiRequestDB.save(req);

  } catch (error: any) {
    console.error("AI Queue Processing Error:", error);
    req.status = 'failed';
    req.response = `Error: ${error.message}`;
    req.completedAt = new Date().toISOString(); 
    await aiRequestDB.save(req);
  }
}

async function processQueue() {
    if (_processing) {
        _needsProcessing = true;
        return;
    }
    if (!isNetworkSuitableForAI()) return;

    _processing = true;
    _needsProcessing = false;
    try {
        const queued = await aiRequestDB.getQueued();
        // Process one by one to avoid overwhelming the client/network
        for (const req of queued) {
            await processRequest(req);
            // Small delay between requests
            await new Promise(r => setTimeout(r, 1000));
        }
    } catch (err) {
        console.error("Error processing AI queue:", err);
    } finally {
        _processing = false;
        if (_needsProcessing && _running) {
             processQueue().catch(() => {});
        }
    }
}

export function startAIRequestProcessor() {
    if (_running) return;
    _running = true;
    
    // Initial run
    processQueue().catch(() => {});

    // Subscribe
    _unsubscribe = aiRequestDB.subscribe(() => {
        if (_running) processQueue().catch(() => {});
    });

    // Listen for network recovery
    if (typeof window !== 'undefined') {
        _onlineListener = () => {
            console.log("Network restored. Resuming AI queue processing...");
            if (_running) processQueue().catch(() => {});
        };
        window.addEventListener('online', _onlineListener);
    }
}

export function stopAIRequestProcessor() {
    if (!_running) return;
    _running = false;
    if (_unsubscribe) {
        _unsubscribe();
        _unsubscribe = null;
    }
    
    if (_onlineListener && typeof window !== 'undefined') {
        window.removeEventListener('online', _onlineListener);
        _onlineListener = null;
    }
}
