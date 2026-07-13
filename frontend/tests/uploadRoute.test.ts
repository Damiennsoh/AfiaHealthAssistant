import { describe, it, expect, beforeAll, vi } from 'vitest';

// Mock getSignedUrl
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: async () => 'https://signed.example.com/put',
}));

import { POST } from '../app/api/upload/route';

beforeAll(() => {
  process.env.AWS_S3_BUCKET = 'test-bucket';
  process.env.AWS_REGION = 'us-east-1';
});

describe('upload route', () => {
  it('returns presigned url and publicUrl', async () => {
    const body = { name: 'photo.jpg', contentType: 'image/jpeg' };
    const req = new Request('http://localhost/api/upload', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
    const res = await POST(req as any);
    expect(res).toBeDefined();
    const json = await res.json();
    expect(json.putUrl).toBe('https://signed.example.com/put');
    expect(json.key).toBeDefined();
  });
});
