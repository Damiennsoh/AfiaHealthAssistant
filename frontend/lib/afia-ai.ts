"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { classifyAIError, retryWithBackoff } from "./ai-error-handling";

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  // Don't throw at import time in dev — allow callers to handle error.
}

const AFIA_INSTRUCTION = `
# ROLE
You are "Senior Clinical Consultant" for Afia Health Assistant application. Your primary goal is to support Ghanaian healthcare workers (Nurses, Midwives, and PAs) with accurate, GHS-compliant clinical advice.

# CORE KNOWLEDGE BASE & STANDARDS
1. GHANA STANDARD TREATMENT GUIDELINES (STG): Your primary reference is Ministry of Health/GHS STG (7th Edition and subsequent updates). 
2. GHANA ESSENTIAL MEDICINES LIST (EML): Only suggest medications found in EML appropriate for facility level (CHPS, Health Centre, or District Hospital).
3. ANTI-MALARIA POLICY: Prioritize Artesunate-Amodiaquine (AA) as first-line ACT for uncomplicated malaria. Artemether-Lumefantrine (AL) is alternative for those who cannot tolerate AA.
4. NCD PROTOCOLS: Follow GHS protocols for Hypertension and Diabetes management, emphasizing lifestyle modifications and GHS-approved first-line medications (e.g., Amlodipine/Lisinopril for HTN).

# OPERATIONAL GUIDELINES
- PATIENT CONTEXT: Always analyze "Patient Folder Data" (Age, Gender, Weight, History) provided in context. Never give advice that contradicts patient's specific history (e.g., avoid NSAIDs in patients with Gastritis history).
- TRIAGE & REFERRAL: Identify "Danger Signs" immediately. If a patient presents with severe symptoms (e.g., inability to drink/breastfeed in children, altered consciousness, BP >180/110), immediately suggest "Stabilize and Refer" according to GHS National Referral Policy.
- FACILITY CONSTRAINTS: Be mindful of Ghanaian context. Suggest diagnostic tests commonly available in Health Centres (RDTs, HB, Glucose) before advanced imaging.
- COST-SENSITIVITY: Prefer medications covered by National Health Insurance Scheme (NHIS) to ensure patient adherence.

# RESPONSE STRUCTURE
1. ASSESSMENT SUMMARY: A brief clinical summary of presented case.
2. GHS RECOMMENDED ACTION: Precise steps based on Standard Treatment Guidelines.
3. PRESCRIBING INFO: Clear dosage based on GHS protocols (e.g., "Artesunate + Amodiaquine 100mg/270mg, 1 tablet daily for 3 days for weight >35kg").
4. COUNSELING & FOLLOW-UP: Culturally appropriate advice for patient (e.g., use of treated bed nets, dietary changes using local foods).
5. DANGER SIGNS: Clearly list signs for immediate return or referral.

# TONE & STYLE
Maintain a professional, supportive, and medically precise tone. Use Ghanaian medical terminology where appropriate (e.g., "RDT" for malaria testing, "ANC" for prenatal care). Avoid medical jargon when providing "Counseling Points" intended for patient.

# SAFETY DISCLAIMER
Always clarify you are an AI assistant providing clinical guidance based on GHS protocols, not a replacement for clinical judgment. If symptoms are severe or atypical, recommend immediate referral to higher-level facility.

# STRUCTURED OUTPUT (when providing diagnosis/treatment)
When analyzing patient cases, end your response with a JSON block for "Sync to Record":
\`\`\`json
{
  "primaryDiagnosis": "Main diagnosis with clinical reasoning",
  "secondaryDiagnosis": "Comorbidities or differential diagnoses (or 'None')",
  "treatmentPlan": "Detailed treatment with medications, dosages, duration",
  "clinicalNotes": "Assessment rationale and key clinical findings",
  "followUpInstructions": "Specific follow-up timeline and warning signs"
}
\`\`\`
`;

type AskOptions = {
  maxOutputTokens?: number;
  temperature?: number;
  // model order fallback can be overridden
  models?: string[];
  /** Patient/encounter context from the UI */
  context?: string;
  /** Pre-formatted GHS protocol chunks from knowledge base (client IndexedDB RAG) */
  protocolContext?: string;
  /** When set, use this as the full system instruction (e.g. for structured JSON-only output) */
  systemOverride?: string;
};

export type AfiaResponse = 
  | { success: true; data: string; model: string }
  | { success: false; error: string; errorType: string; userMessage: string; details?: any; retryable?: boolean; retryAfter?: number };

/**
 * Ask Afia (Gemini) with model fallback logic and enhanced error handling.
 * Returns { success, data, model, errorType, userMessage }.
 */
export async function askAfia(
  userQuery: string,
  imageBase64?: string,
  opts: AskOptions = {}
): Promise<AfiaResponse> {
  if (!API_KEY) {
    return { 
      success: false, 
      error: 'GEMINI_API_KEY not set',
      errorType: 'api_key' as const,
      userMessage: 'AI service is not configured. Please contact your administrator to set up the API key.'
    };
  }

  const genAI = new GoogleGenerativeAI(API_KEY as string);

  // Build system instruction: override for structured output, otherwise default + protocol + context
  let systemInstruction: string;
  if (opts.systemOverride) {
    systemInstruction = opts.systemOverride;
    if (opts.protocolContext) {
      systemInstruction += "\n\n" + opts.protocolContext;
    }
    if (opts.context) {
      systemInstruction += "\n\n=== PATIENT CONTEXT ===\n" + opts.context;
    }
  } else {
    systemInstruction = AFIA_INSTRUCTION;
    if (opts.protocolContext) {
      systemInstruction += "\n\n" + opts.protocolContext;
      systemInstruction += "\n\nCITATION: When using the above protocols, cite the protocol section (e.g., \"According to [PROTOCOL 1]...\").";
    } else {
      systemInstruction += "\n\n=== NO GHS PROTOCOLS PROVIDED ===\n";
      systemInstruction += "No matching protocols were retrieved from the knowledge base. Use your general medical knowledge (based on standard medical texts and guidelines) to answer. You MUST preface your response with: [GENERAL_FALLBACK] This is general medical information not found in official GHS STG. Include the SAFETY DISCLAIMER as specified above.";
    }
    if (opts.context) {
      systemInstruction += "\n\n=== PATIENT CONTEXT ===\n" + opts.context;
    }
  }

  // Preferred model order (newest first). Adjust as new models arrive.
  const preferredModels = opts.models ?? [
    "gemini-2.5-flash",
    "gemini-2.5-pro", 
    "gemini-2.1",
  ];

  const inputParts: any[] = [userQuery];
  if (imageBase64) {
    // Extract mime type if present in data URL, otherwise default to image/png
    const mimeMatch = imageBase64.match(/^data:([^;]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
    
    inputParts.push({
      inlineData: {
        data: imageBase64.replace(/^data:\w+\/\w+;base64,/, ""),
        mimeType: mimeType,
      },
    });
  }

  let lastError: any;

  // Try models in order until one succeeds
  for (const modelName of preferredModels) {
    try {
      const result = await retryWithBackoff(async () => {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction,
          generationConfig: {
            temperature: opts.temperature ?? 0.0,
            maxOutputTokens: opts.maxOutputTokens ?? 4096,
          },
        });

        const generation = await model.generateContent(inputParts);
        const response = await generation.response;
        const text = response.text();

        return { success: true as const, data: text, model: modelName };
      }, 1, 2000); // 1 retry with 2s base delay to avoid rate limits

      return result;
    } catch (err: any) {
      lastError = err;
      const classifiedError = classifyAIError(err);
      
      // Log the error with model info
      console.warn(`Gemini model ${modelName} failed:`, {
        error: classifiedError,
        model: modelName,
        userQuery: userQuery.substring(0, 100) + (userQuery.length > 100 ? '...' : '')
      });

      // If it's an API key error, don't try other models
      if (classifiedError.type === 'api_key') {
        return {
          success: false,
          error: classifiedError.message,
          errorType: classifiedError.type,
          userMessage: classifiedError.userMessage,
          details: classifiedError.details
        };
      }

      // If it's a rate limit error, wait longer before retrying
      if (classifiedError.type === 'rate_limit') {
        console.log(`Rate limit hit on ${modelName}, waiting ${classifiedError.retryAfter}s...`);
        await new Promise(resolve => setTimeout(resolve, (classifiedError.retryAfter || 60) * 1000));
      }

      // Continue to next model for other error types
      continue;
    }
  }

  // All models failed, return the last classified error
  const finalError = classifyAIError(lastError);
  return {
    success: false,
    error: finalError.message,
    errorType: finalError.type,
    userMessage: finalError.userMessage,
    retryable: finalError.retryable,
    retryAfter: finalError.retryAfter,
    details: finalError.details
  };
}

/**
 * Convenience wrapper that returns only text or throws for server-side usage.
 */
export async function askAfiaOrThrow(prompt: string, imageBase64?: string) {
  const res = await askAfia(prompt, imageBase64);
  if (!res.success) {
    const errorRes = res as any;
    throw new Error(errorRes.error || "Afia request failed");
  }
  const successRes = res as any;
  return { text: successRes.data, model: successRes.model };
}
