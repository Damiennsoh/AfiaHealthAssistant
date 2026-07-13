import { test, expect } from '@playwright/test';

test('presigned upload flow (mocked)', async ({ page }) => {
  // Intercept presign request
  await page.route('**/api/upload', async (route) => {
    const body = await route.request().postDataJSON();
    const putUrl = 'https://signed.example.com/put';
    const getUrl = 'https://signed.example.com/get/uploads/1.jpg';
    await route.fulfill({ status: 200, body: JSON.stringify({ putUrl, getUrl, key: 'uploads/1.jpg' }) });
  });

  // Intercept PUT to presigned URL
  await page.route('https://signed.example.com/put', async (route) => {
    await route.fulfill({ status: 200, body: 'OK' });
  });

  // Visit a simple page and exercise fetch-based upload flow
  await page.goto('about:blank');

  // Perform presign + put from the page context to simulate client behavior
  const result = await page.evaluate(async () => {
    const res = await fetch('/api/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'test.jpg', contentType: 'image/jpeg' }) });
    const json = await res.json();
    const blob = new Blob(['hello'], { type: 'image/jpeg' });
    const put = await fetch(json.putUrl, { method: 'PUT', body: blob });
    return { presignOk: !!json.putUrl, putOk: put.ok };
  });

  expect(result.presignOk).toBe(true);
  expect(result.putOk).toBe(true);
});
