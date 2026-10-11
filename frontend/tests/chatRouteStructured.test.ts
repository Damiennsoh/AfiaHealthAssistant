import { afterEach, describe, expect, it, vi } from "vitest";

const { askAfiaMock } = vi.hoisted(() => ({ askAfiaMock: vi.fn() }));

vi.mock("@/lib/afia-ai", () => ({ askAfia: askAfiaMock }));
vi.mock("@/lib/knowledge-base", () => ({ formatKnowledgeForAI: vi.fn(() => "") }));

import { POST } from "../app/api/chat/route";

function makeRequest() {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ structuredOnly: true, prompt: "Analyze this encounter" }),
  });
}

describe("structured clinical responses", () => {
  afterEach(() => {
    askAfiaMock.mockReset();
  });

  it("rejects placeholder-only output instead of returning a successful blank assessment", async () => {
    askAfiaMock.mockResolvedValue({
      success: true,
      data: JSON.stringify({
        diagnosis: "Clinical assessment pending",
        treatment: "",
        clinicalNotes: "",
      }),
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      error: "AI returned an empty or invalid clinical response",
    });
  });

  it("returns complete structured clinical output", async () => {
    askAfiaMock.mockResolvedValue({
      success: true,
      data: JSON.stringify({
        diagnosis: "Acute upper respiratory tract infection",
        treatment: "Supportive care and review if symptoms worsen.",
        clinicalNotes: "Patient is clinically stable based on the supplied encounter details.",
      }),
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      diagnosis: "Acute upper respiratory tract infection",
      treatment: "Supportive care and review if symptoms worsen.",
      clinicalNotes: "Patient is clinically stable based on the supplied encounter details.",
    });
  });
});