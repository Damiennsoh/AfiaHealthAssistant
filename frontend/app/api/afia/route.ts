import { NextResponse } from "next/server";
import { askAfia } from "@/lib/afia-ai";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt: string = body.prompt ?? body.query ?? "";
    const imageBase64: string | undefined = body.imageBase64;
    const concise: boolean = body.concise === true;

    if (!prompt && !imageBase64) {
      return NextResponse.json({ 
        success: false, 
        error: "Missing prompt or image",
        errorType: "validation",
        userMessage: "Please provide a question, prompt, or image for the AI assistant."
      }, { status: 400 });
    }

    const basePrompt = prompt.trim() || "Analyze this clinical image and provide concise findings.";
    const effectivePrompt = concise
      ? basePrompt + "\n\n[INSTRUCTION: Keep the response concise. Use plain text only—no markdown (#, *, **). Use bullet points (•) for lists.]"
      : basePrompt;
    const res = await askAfia(effectivePrompt, imageBase64);
    
    if (!res.success) {
      // Return enhanced error information
      const errorRes = res as any;
      return NextResponse.json({ 
        success: false, 
        error: errorRes.error,
        errorType: errorRes.errorType || "unknown",
        userMessage: errorRes.userMessage || "AI request failed",
        retryable: errorRes.retryable,
        retryAfter: errorRes.retryAfter,
        details: process.env.NODE_ENV === "development" ? errorRes.details : undefined
      }, { status: errorRes.errorType === "api_key" ? 500 : 502 });
    }

    const successRes = res as any;
    return NextResponse.json({ 
      success: true, 
      data: successRes.data, 
      model: successRes.model 
    });
  } catch (err: any) {
    console.error("Unexpected error in afia route:", err);
    
    return NextResponse.json({ 
      success: false, 
      error: err?.message ?? String(err),
      errorType: "server_error",
      userMessage: "An unexpected error occurred. Please try again.",
      retryable: true
    }, { status: 500 });
  }
}
