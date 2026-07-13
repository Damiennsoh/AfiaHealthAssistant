import { askAfia } from "@/lib/afia-ai";
import { classifyAIError } from "@/lib/ai-error-handling";
import { formatKnowledgeForAI, type KnowledgeChunk } from "@/lib/knowledge-base";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Enhanced system prompt with NO MARKDOWN requirement for clean clinical display
const ENHANCED_SYSTEM_PROMPT = `
You are "Senior Clinical Consultant" for Afia Health Assistant application. Your primary goal is to support Ghanaian healthcare workers with accurate, GHS-compliant clinical advice.

# CRITICAL: NO MARKDOWN FORMATTING
You MUST use NO Markdown symbols in your response:
- NO asterisks (*) for bold or italic
- NO hash symbols (#) for headers
- NO backticks (\`) for code
- NO underscores (_) for emphasis
- Use PLAIN TEXT only

# CRITICAL: STRUCTURED JSON OUTPUT REQUIREMENT
When analyzing patient cases or providing diagnosis/treatment recommendations, you MUST end your response with a JSON block in this exact format:

\`\`\`json
{
  "primaryDiagnosis": "Main diagnosis with clinical reasoning",
  "secondaryDiagnosis": "Comorbidities or differential diagnoses (or 'None')",
  "treatmentPlan": "Detailed treatment with medications, dosages, and duration",
  "clinicalNotes": "Assessment rationale and key clinical findings",
  "followUpInstructions": "Specific follow-up timeline and warning signs"
}
\`\`\`

# KNOWLEDGE BASE INTEGRATION
Priority 1: Use the provided GHS Standard Treatment Guidelines (STG) protocols if they are included in the context.
Priority 2: If no GHS protocols are provided, use general medical knowledge and explicitly state "[GENERAL_FALLBACK] This is general medical information not found in official GHS STG:"

# CITATION RULE - SOURCE OF TRUTH
- NEVER mention "Protocol numbers", "Chunks", "Parts", or technical IDs
- Cite ONLY as: "GHS Standard Treatment Guidelines 7th Edition" or "Official GHS Protocols"
- The document is the authority, not the chunk number

# FORMATTING RULES
1. Use PROFESSIONAL MEDICAL ENGLISH
2. STRUCTURE: Use DYNAMIC UPPERCASE HEADERS ending with a COLON on their own line.
   - Examples for clinical cases: DIAGNOSIS:, TREATMENT PLAN:, RATIONALE:, ASSESSMENT:
   - Examples for general queries: PREVENTION:, LIFESTYLE TIPS:, DIET:, WARNING:, NEXT STEPS:
   - Ensure a blank line before each header.
3. CONCISENESS: If no specific patient data is provided, keep response under 100 words
4. OUTPUT: Clean plain text with NO markdown symbols
5. FALLBACK: If the provided snippets do not contain the specific GHS protocol for the query, verify if you can answer using general medical knowledge.
   - If relying on general knowledge (not from snippets), start with [GENERAL_FALLBACK] tag.
   - Example: "[GENERAL_FALLBACK] While specific GHS protocols were not found..."

# TOPIC FILTERING
- You are a CLINICAL ASSISTANT.
- If the user asks about politics, entertainment, sports, or non-medical topics, politely decline.
- Response: "I am a clinical assistant designed to support healthcare delivery. I cannot answer non-medical queries."

# CORE REQUIREMENTS
1. GHANA STANDARD TREATMENT GUIDELINES (STG): Reference Ministry of Health/GHS STG (7th Edition)
2. GHANA ESSENTIAL MEDICINES LIST (EML): Only suggest medications found in EML
3. FACILITY CONSTRAINTS: Consider tests available in Health Centres (RDTs, HB, Glucose)
4. COST-SENSITIVITY: Prefer NHIS-covered medications for patient adherence

# RESPONSE STRUCTURE
1. Clinical assessment summary (concise)
2. DIAGNOSIS section
3. TREATMENT section with prescribing information
4. RATIONALE section with GHS citations
5. Danger signs for immediate referral
6. REQUIRED: Structured JSON block for "Sync to Record" functionality

# MEDICATION FORMAT
Use format: Drug Name - Dosage, Route, Frequency, Duration
Example: Artesunate-Amodiaquine - 1 tab, Oral, twice daily, 3 days
`;

const STRUCTURED_SYSTEM_PROMPT = `You are the Afia Health Assistant, a specialized clinical decision support tool for Ghana.

CRITICAL INSTRUCTIONS:
1. DATA SOURCE: If PROTOCOL_CONTEXT is provided in the user message, you MUST prioritize that information above all else.
2. FALLBACK MANDATE: If PROTOCOL_CONTEXT is missing or empty, you MUST use your general medical knowledge to provide a comprehensive response. DO NOT REFUSE TO ANSWER.
3. TONE: Clinical, concise, and professional.
4. FORMAT: You must return ONLY a valid JSON object. No conversational text. No markdown (#, *, \`\`\`, etc.).

REQUIRED JSON SCHEMA (output this and nothing else):
{
  "diagnosis": "Formal clinical diagnosis name (short)",
  "differentialDiagnosis": ["Alternative diagnosis 1", "Alternative diagnosis 2"],
  "treatment": "Overall treatment summary",
  "structuredDrugs": [
    {
      "drugName": "Name of drug",
      "dosage": "e.g. 500mg",
      "frequency": "e.g. TID",
      "route": "e.g. Oral",
      "duration": "e.g. 3 days",
      "notes": "Optional instructions"
    }
  ],
  "clinicalNotes": "Clinical assessment and findings",
  "followUpInstructions": "Return date and warning signs",
  "isDisclaimer": true or false
}

DISCLAIMER RULE: Set "isDisclaimer" to true if you are relying on general medical knowledge because specific GHS protocols were not found.`;

function validateAndNormalize(parsed: any): any {
  if (!parsed || typeof parsed !== 'object') return null;
  return {
    diagnosis: typeof parsed.diagnosis === "string" ? parsed.diagnosis : "Clinical assessment pending",
    differentialDiagnosis: Array.isArray(parsed.differentialDiagnosis) ? parsed.differentialDiagnosis : [],
    treatment: typeof parsed.treatment === "string" ? parsed.treatment : String(parsed.treatment ?? ""),
    structuredDrugs: Array.isArray(parsed.structuredDrugs) ? parsed.structuredDrugs : [],
    clinicalNotes: typeof parsed.clinicalNotes === "string" ? parsed.clinicalNotes : (typeof parsed.historyNote === "string" ? parsed.historyNote : ""),
    followUpInstructions: typeof parsed.followUpInstructions === "string" ? parsed.followUpInstructions : "",
    isDisclaimer: typeof parsed.isDisclaimer === "boolean" ? parsed.isDisclaimer : true,
  };
}

function parseStructuredResponse(text: string): any {
  const trimmed = text.trim();
  
  // Strategy 1: Look for markdown code blocks
  const jsonBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlock) {
    try {
      return validateAndNormalize(JSON.parse(jsonBlock[1].trim()));
    } catch (e) {
      // Continue to next strategy
    }
  }

  // Strategy 2: Look for outermost JSON object
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      const potentialJson = trimmed.substring(firstBrace, lastBrace + 1);
      return validateAndNormalize(JSON.parse(potentialJson));
    } catch (e) {
      // Continue to next strategy
    }
  }

  // Strategy 3: Try parsing the raw text directly
  try {
    return validateAndNormalize(JSON.parse(trimmed));
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      messages,
      context,
      protocols,
      structuredOnly,
      prompt: bodyPrompt,
    } = body as {
      messages?: unknown[];
      context?: string;
      protocols?: KnowledgeChunk[];
      structuredOnly?: boolean;
      prompt?: string;
    };

    // Structured-only mode: single prompt, return JSON object
    if (structuredOnly === true && typeof bodyPrompt === "string" && bodyPrompt.trim()) {
      const userQuery = bodyPrompt.trim();
      let result;
      try {
        result = await askAfia(userQuery, undefined, {
          systemOverride: STRUCTURED_SYSTEM_PROMPT,
          context: context || undefined,
          maxOutputTokens: 2048,
        });
      } catch (err) {
        console.error("❌ [CHAT API] Structured askAfia failed:", err);
        const classifiedError = classifyAIError(err);
        return new Response(
          JSON.stringify({
            error: classifiedError.message,
            type: classifiedError.type,
            userMessage: classifiedError.userMessage,
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
      if (!result.success) {
        const errorRes = result as { error?: string; errorType?: string; userMessage?: string };
        return new Response(
          JSON.stringify({
            error: errorRes.error,
            type: errorRes.errorType || "unknown",
            userMessage: errorRes.userMessage || "AI service temporarily unavailable",
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
      const responseText = (result as { data?: string }).data;
      if (!responseText || typeof responseText !== "string") {
        return new Response(
          JSON.stringify({
            error: "Invalid AI response",
            userMessage: "AI returned an invalid response. Please try again.",
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
      const parsed = parseStructuredResponse(responseText);
      if (!parsed) {
        return new Response(
          JSON.stringify({
            diagnosis: "Clinical assessment pending",
            treatment: responseText.slice(0, 2000),
            historyNote: "",
            isDisclaimer: true,
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify(parsed), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Standard chat: streamed text
    // Extract user query from last message (supports multiple AI SDK formats)
    const lastMessage = messages?.[messages.length - 1] as Record<string, unknown> | undefined;
    let userQuery = "";
    if (lastMessage) {
      if (typeof lastMessage.content === "string") {
        userQuery = lastMessage.content;
      } else if (Array.isArray(lastMessage.parts)) {
        userQuery = (lastMessage.parts as { type?: string; text?: string }[])
          .filter((p) => p.type === "text" && p.text)
          .map((p) => p.text || "")
          .join("");
      } else if (Array.isArray(lastMessage.content)) {
        userQuery = (lastMessage.content as { type?: string; text?: string }[])
          .filter((p) => (p as { type?: string }).type === "text" && (p as { text?: string }).text)
          .map((p) => (p as { text?: string }).text || "")
          .join("");
      }
    }
    // Strip request ID token from query for AI processing
    userQuery = String(userQuery || "").replace(/\[\[AFIA_REQ:[^\]]+\]\]\s*/g, "").trim();
    
    console.log('📨 [CHAT API] Received request');
    console.log('💬 [CHAT API] User query:', userQuery.substring ? userQuery.substring(0, 100) : "EMPTY QUERY");
    console.log('📋 [CHAT API] Context provided:', !!context);
    console.log('📚 [CHAT API] Context length:', context?.length || 0);
    console.log('📖 [CHAT API] Protocols from client:', Array.isArray(protocols) ? protocols.length : 0);

    // Format GHS protocols from knowledge admin (client-searched IndexedDB)
    const protocolContext = Array.isArray(protocols) && protocols.length > 0
      ? formatKnowledgeForAI(protocols)
      : undefined;

    // Call AI with protocol context injected into system prompt
    let result;
    try {
      result = await askAfia(userQuery, undefined, { context, protocolContext });
    } catch (retrievalError) {
      console.error('❌ [CHAT API] Knowledge retrieval failed:', retrievalError);
      // Continue with empty protocols rather than crashing
      result = { success: true, data: "", protocols: [] };
    }
    
    console.log(`[CHAT] askAfia result:`, {
      success: result.success,
      protocolsPassedToAI: protocolContext ? protocolContext.length : 0,
    });
    
    if (!result.success) {
      const errorRes = result as any;
      console.error('❌ [CHAT API] askAfia failed:', errorRes);
      return new Response(
        JSON.stringify({
          error: errorRes.error,
          type: errorRes.errorType || "unknown",
          userMessage: errorRes.userMessage || "AI service temporarily unavailable",
          details: errorRes.details
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Return the AI response
    const successRes = result as any;
    const responseText = successRes.data;
    
    if (!responseText || typeof responseText !== 'string') {
      console.error('❌ [CHAT API] Invalid response from askAfia:', responseText);
      return new Response(
        JSON.stringify({
          error: "Invalid AI response",
          type: "response_error",
          userMessage: "AI returned an invalid response. Please try again."
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    
    console.log('✅ [CHAT API] AI response received');
    console.log('📝 [CHAT API] Response length:', responseText.length);
    console.log('📋 [CHAT API] Response preview:', responseText.substring ? responseText.substring(0, 300) + '...' : 'EMPTY RESPONSE');
    
    // Check if response includes citations and structured JSON
    const hasCitations = responseText.includes('GHS STG') || responseText.includes('According to');
    const hasGeneralFallback = responseText.includes('[GENERAL_FALLBACK]');
    const hasStructuredJSON = responseText.includes('```json') && responseText.includes('primaryDiagnosis');
    
    console.log('🏥 [CHAT API] Response analysis:');
    console.log('  - Has GHS citations:', hasCitations);
    console.log('  - Uses general fallback:', hasGeneralFallback);
    console.log('  - Has structured JSON:', hasStructuredJSON);
    
    // Plain text stream for TextStreamChatTransport - no special format, raw text only
    const stream = new ReadableStream({
      start(controller) {
        try {
          console.log('🌊 [CHAT API] Starting streaming response');
          const chunks = responseText.split(/(?<=\.)\s+/);
          let index = 0;

          const sendChunk = () => {
            try {
              if (index < chunks.length) {
                const chunk = chunks[index];
                const text = index < chunks.length - 1 ? chunk + " " : chunk;
                controller.enqueue(new TextEncoder().encode(text));
                index++;
                setTimeout(sendChunk, 10);
              } else {
                controller.close();
                console.log('✅ [CHAT API] Streaming response completed successfully');
              }
            } catch (err) {
              console.error('❌ [CHAT API] Error sending chunk:', err);
              controller.error(err);
            }
          };

          sendChunk();
        } catch (err) {
          console.error('❌ [CHAT API] Error starting stream:', err);
          controller.error(err);
        }
      },
      cancel(reason) {
        console.log('🛑 [CHAT API] Stream cancelled by client:', reason);
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    const classifiedError = classifyAIError(error);
    
    console.error("Chat API error:", {
      error: classifiedError,
      details: classifiedError.details
    });
    
    return new Response(
      JSON.stringify({
        error: classifiedError.message,
        type: classifiedError.type,
        message: classifiedError.userMessage,
        retryable: classifiedError.retryable,
        retryAfter: classifiedError.retryAfter,
        details: process.env.NODE_ENV === "development" ? classifiedError.details : undefined
      }),
      { 
        status: classifiedError.type === "api_key" ? 500 : 502,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}
