import { afterEach, describe, expect, it, vi } from "vitest";

class MockSearchWorker {
  onmessage: ((event: { data: any }) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  messages: any[] = [];

  postMessage(message: any) {
    this.messages.push(message);
  }
}

const workers: MockSearchWorker[] = [];

describe("knowledge search worker readiness", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    workers.length = 0;
  });

  it("waits for READY and routes concurrent results to their matching searches", async () => {
    vi.stubGlobal("Worker", class extends MockSearchWorker {
      constructor() {
        super();
        workers.push(this);
      }
    });
    vi.resetModules();

    const { knowledgeSearchService } = await import("../lib/knowledge-search-service");
    const worker = workers[0];
    const firstSearch = knowledgeSearchService.search("fever", 5, "GH");
    const secondSearch = knowledgeSearchService.search("cough", 5, "GH");

    expect(worker.messages.map((message) => message.type)).toEqual(["INIT"]);

    worker.onmessage?.({ data: { type: "READY", count: 10 } });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const requests = worker.messages.filter((message) => message.type === "SEARCH");
    expect(requests).toHaveLength(2);
    expect(requests[0].requestId).not.toBe(requests[1].requestId);

    const firstResult = [{ id: "fever", content: "Fever protocol" }];
    const secondResult = [{ id: "cough", content: "Cough protocol" }];
    worker.onmessage?.({ data: { type: "RESULTS", requestId: requests[1].requestId, results: secondResult } });
    worker.onmessage?.({ data: { type: "RESULTS", requestId: requests[0].requestId, results: firstResult } });

    await expect(firstSearch).resolves.toEqual(firstResult);
    await expect(secondSearch).resolves.toEqual(secondResult);
  });
});