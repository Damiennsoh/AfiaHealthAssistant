import { NextResponse } from "next/server";
import { askAfia } from "@/lib/afia-ai";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt: string = body.prompt ?? body.query ?? "";
    const imageBase64: string | undefined = body.imageBase64;

    if (!prompt && !imageBase64) {
      return NextResponse.json({ success: false, error: "Missing prompt or image" }, { status: 400 });
    }

    const res = await askAfia(prompt, imageBase64);
    if (!res.success) {
      return NextResponse.json({ success: false, error: (res as any).error }, { status: 502 });
    }

    const full = (res as any).data ?? "";

    // Stream the response in chunks to give progressive rendering on the client.
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const chunkSize = 200; // characters per chunk
        for (let i = 0; i < full.length; i += chunkSize) {
          const chunk = full.slice(i, i + chunkSize);
          controller.enqueue(encoder.encode(chunk));
          // small pause to allow progressive rendering
          await new Promise((r) => setTimeout(r, 30));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}
