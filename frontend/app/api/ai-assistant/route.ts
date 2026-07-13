import { NextResponse } from "next/server";
import { askAfia } from "@/lib/afia-ai";
import { KnowledgeChunk } from "@/lib/knowledge-base";

const AI_ASSISTANT_SYSTEM_PROMPT = `
You are Afia, an advanced clinical decision support AI for healthcare professionals in Ghana.
Your task is to analyze the user's input and the provided context (GHS Protocols) to generate a structured JSON response.

# CORE RESPONSIBILITIES
1. **Analyze User Intent**: Determine if the query is Clinical, Educational, Lab, or General.
2. **Prioritize Local Knowledge**: ALWAYS check the provided "KNOWLEDGE BASE CONTEXT" first.
3. **Fallback Gracefully**: If the answer is NOT in the context, use your general medical training (Gemini) but MUST add a disclaimer.
4. **Scope Control**: If the query is non-medical (politics, sports, entertainment), politely refuse.

# MODES & INTENT
Determine the intent of the user and select ONE mode:
1. "clinical": For symptom analysis, diagnosis, treatment plans, or case studies.
2. "educational": For definitions, explanations of medical concepts, or "What is X?" questions.
3. "lab": For interpretation of lab results, values, or images.
4. "general": For greetings, casual conversation, or unclear queries.

# FALLBACK & CITATION RULES
- **If answer found in Context**:
  - Source: "GHS STG 2017" or the specific protocol name found in the chunk.
  - Rationale: Cite the specific section/chunk.
- **If answer NOT in Context**:
  - You MAY answer if it is a standard medical question.
  - Source: "General Medical Knowledge (AI)".
  - Rationale: MUST start with "[DISCLAIMER: Not found in local GHS protocols. Recommendation based on standard medical guidelines.]"

# OUTPUT FORMAT
You must return a single JSON object. Do not include markdown formatting.
Ensure all keys are strictly LOWERCASE.
The JSON must have this structure:

{
  "mode": "clinical" | "educational" | "lab" | "general",
  "data": {
    // Fields depend on mode:
    
    // IF clinical:
    "title": "Differential Diagnosis" or "Clinical Snapshot",
    "main": "Primary Diagnosis or Key Finding",
    "treatment": "Specific medication/management",
    "rationale": "Why this diagnosis/treatment?",
    "source": "Source of information"
    
    // IF educational:
    "title": "Medical Definition" or "Concept",
    "main": "The term being defined",
    "insight": "Detailed explanation",
    "takeaway": "Key clinical pearl or summary",
    "source": "Source of information"

    // IF lab:
    "title": "Lab Interpretation",
    "main": "Summary of findings",
    "insight": "Detailed analysis of values",
    "takeaway": "Recommendations or next steps",
    "source": "Source of information"

    // IF general:
    "main": "Your conversational response here."
  }
}

# RESPONSE CLEANING
- Do not use markdown (*, #) in the text fields.
- Keep text professional and concise.
- Ensure the JSON is valid and complete.
`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { query, context, patientContext, image } = body;

    if (!query && !image) {
      return NextResponse.json({ error: "Query or Image is required" }, { status: 400 });
    }

    // Construct the context string
    let fullContext = "";
    if (patientContext) {
      fullContext += `PATIENT CONTEXT: ${JSON.stringify(patientContext)}\n\n`;
    }
    
    if (context && Array.isArray(context) && context.length > 0) {
      fullContext += "KNOWLEDGE BASE CONTEXT:\n";
      context.forEach((chunk: KnowledgeChunk, i: number) => {
        fullContext += `[CHUNK ${i+1}] Source: ${chunk.source}\nContent: ${chunk.content}\n\n`;
      });
    }

    // Call Gemini via askAfia
    // Note: When using systemOverride, askAfia does not automatically append context, so we append it manually.
    const result = await askAfia(query || "Analyze this image", image, {
      systemOverride: AI_ASSISTANT_SYSTEM_PROMPT + "\n\n" + fullContext,
      maxOutputTokens: 4096,
    });

    if (!result.success) {
      throw new Error(result.error || "AI request failed");
    }

    const responseText = (result as any).data;
    
    // Helper to normalize keys to lowercase
    const normalizeKeys = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map(v => normalizeKeys(v));
      } else if (obj !== null && typeof obj === 'object') {
        return Object.keys(obj).reduce((result, key) => {
          result[key.toLowerCase()] = normalizeKeys(obj[key]);
          return result;
        }, {} as any);
      }
      return obj;
    };

    // Parse JSON
    let parsedResponse;
    try {
      // 1. Clean markdown code blocks
      let jsonString = responseText.replace(/```json\n?|```/g, "").trim();
      
      // 2. Attempt direct parse
      try {
        parsedResponse = JSON.parse(jsonString);
      } catch (e1) {
        // 3. Fallback: Extract JSON object using regex
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
        } else {
          throw e1;
        }
      }

      // 4. Normalize keys (handle uppercase keys from AI)
      if (parsedResponse) {
        parsedResponse = normalizeKeys(parsedResponse);
      }

    } catch (e) {
      console.error("Failed to parse AI response:", responseText);
      
      // 5. Final Fallback: Treat as general text
      parsedResponse = {
        mode: "general",
        data: {
          main: responseText || "I'm sorry, I couldn't process that request correctly."
        }
      };
    }

    return NextResponse.json(parsedResponse);

  } catch (error: any) {
    console.error("AI Assistant API Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
