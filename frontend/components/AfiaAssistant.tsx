"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Zap,
  Save,
  ShieldCheck,
  AlertCircle,
  Loader2,
  ChevronRight,
  Stethoscope,
  ArrowLeft,
  Activity,
  Info,
  Pill,
  FileText,
  Microscope,
  GraduationCap,
  ShieldAlert,
  AlertTriangle,
  ClipboardCheck,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Calendar,
  Bot
} from "lucide-react";
import Link from "next/link";
import { encounterDB, patientDB, generateId, aiRequestDB } from "@/lib/db";
import type { Encounter, Patient, DrugAdministration, AIRequest } from "@/lib/db";
import { formatKnowledgeForAI } from "@/lib/knowledge-base";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AfiaAuthContext";
import { useClinicalBrain } from "@/hooks/use-clinical-brain";
import { useKnowledgeBase } from "@/hooks/use-knowledge-base";
import { cn } from "@/lib/utils";
import { COMMON_DRUGS, checkDrugInteraction } from "@/components/health/DrugAdministrationSection";
import { CloudSyncIndicator } from "@/components/CloudSyncIndicator";
import { BackNavigation } from "@/components/ui/back-navigation";
export const ROUTES = ["oral", "IV", "IM", "SC", "topical", "inhaled", "rectal", "vaginal", "sublingual", "intranasal"];

// Section configuration with color-coded styles to match target UI
const sectionConfig = {
  diagnosis: { label: "DIAGNOSIS", icon: Stethoscope, bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-900", badge: "bg-rose-100 text-rose-700" },
  treatment: { label: "TREATMENT PLAN", icon: Pill, bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-900", badge: "bg-emerald-100 text-emerald-700" },
  investigations: { label: "INVESTIGATIONS", icon: Microscope, bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-900", badge: "bg-blue-100 text-blue-700" },
  rationale: { label: "CLINICAL RATIONALE", icon: GraduationCap, bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-900", badge: "bg-amber-100 text-amber-700" },
};

// Text sanitization helper
const cleanText = (text: string) => text.replace(/[#*_~`]/g, "").replace(/\n{3,}/g, "\n\n").trim();

export interface StructuredClinicalResponse {
  diagnosis: string;
  differentialDiagnosis?: string[];
  treatment: string;
  structuredDrugs: Array<{
    drugName: string;
    dosage: string;
    frequency: string;
    route: string;
    duration: string;
    notes?: string;
  }>;
  clinicalNotes: string;
  followUpInstructions: string;
  isDisclaimer: boolean;
}

/**
 * Stage 1: Search Query Builder (Retrieval)
 * Optimized for finding the right protocol in GHS STG.
 * Uses ONLY diagnosis/complaint + top symptoms to avoid noisy vector search.
 */
function buildRetrievalQuery(userInput: string, encounter: Encounter | null): string {
  const parts: string[] = [];
  
  // Use user input if provided (from text input)
  if (userInput?.trim()) {
    parts.push(userInput.trim());
  }
  
  if (encounter) {
    // Priority: Diagnosis is the strongest signal
    if (encounter.diagnosis) {
      parts.push(encounter.diagnosis);
    }
    // Secondary: Presenting complaint
    if (encounter.presentingComplaint) {
      parts.push(encounter.presentingComplaint);
    }
    // Tertiary: Top 2 symptoms only (to avoid noise)
    if (encounter.symptoms?.length) {
      parts.push(...encounter.symptoms.slice(0, 2));
    }
  }
  
  // Join with spaces and remove duplicates
  const query = parts.filter(Boolean).join(" ");
  console.log('[RETRIEVAL] Clean search query:', query);
  return query || "General consultation";
}

function buildEncounterContext(encounter: Encounter | null, patient: Patient | null): string {
  if (!encounter) return "";
  
  // Format weight with clear label for dosing calculations
  const weight = encounter.vitals?.weight && parseFloat(encounter.vitals.weight) > 0 
    ? `${encounter.vitals.weight} kg` 
    : "NOT RECORDED";
  
  const lines: string[] = [
    `=== CRITICAL PATIENT VITALS ===`,
    `WEIGHT: ${weight} (Use for dosing)`,
    `TEMPERATURE: ${encounter.vitals?.temperature ?? "—"}°C`,
    `BLOOD PRESSURE: ${encounter.vitals?.bloodPressureSystolic ?? "—"}/${encounter.vitals?.bloodPressureDiastolic ?? "—"} mmHg`,
    `PULSE: ${encounter.vitals?.pulse ?? "—"} bpm`,
    `AGE: ${patient?.age ?? "?"} years`,
    `SEX: ${patient?.sex ?? "Unknown"}`,
    ``,
    `=== CLINICAL CONTEXT ===`,
    `Presenting Complaint: ${encounter.presentingComplaint || "—"}`,
    `Symptoms: ${(encounter.symptoms ?? []).join(", ") || "None reported"}`,
    `History: ${encounter.history || "—"}`,
    encounter.historyOfComplaint ? `History of Complaint: ${encounter.historyOfComplaint}` : "",
    encounter.notes ? `Notes: ${encounter.notes}` : "",
  ];
  
  return lines.filter(Boolean).join("\n");
}

/** Build a default query for "analyze this case" when opening the hub from an encounter */
function buildDefaultQuery(encounter: Encounter): string {
  // Stage 1: Clean retrieval query - use diagnosis or presenting complaint
  if (encounter.diagnosis) return encounter.diagnosis;
  if (encounter.presentingComplaint) return encounter.presentingComplaint;
  if (encounter.symptoms?.length) return encounter.symptoms.slice(0, 2).join(" ");
  return "General consultation";
}

export function AfiaAssistant() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const encounterId = searchParams.get("encounterId");

  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [input, setInput] = useState("");
  const [isLocalMatch, setIsLocalMatch] = useState(false);
  const [isVerifiedProtocol, setIsVerifiedProtocol] = useState(false); // True only for direct GHS protocol matches
  const [structuredResponse, setStructuredResponse] = useState<StructuredClinicalResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [protocolContextText, setProtocolContextText] = useState("None"); // Add state for protocol context
  const [error, setError] = useState<string | null>(null);
  const autoSentForEncounterRef = useRef<string | null>(null);

  // Patient picker state for granular section saves
  const [isPatientPickerOpen, setIsPatientPickerOpen] = useState(false);
  const [pendingSection, setPendingSection] = useState<{content: string, section: string} | null>(null);
  
  // Drug Administration State
  const [editedDrugs, setEditedDrugs] = useState<DrugAdministration[]>([]);
  const [editingDrugId, setEditingDrugId] = useState<string | null>(null);
  const [showAddDrugForm, setShowAddDrugForm] = useState(false);
  
  // Drug Search & Interaction State
  const [drugSearchTerm, setDrugSearchTerm] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [drugInteractions, setDrugInteractions] = useState<string[]>([]);
  
  const [newDrug, setNewDrug] = useState<Partial<DrugAdministration>>({
    drugName: "",
    dosage: "",
    frequency: "",
    route: "oral",
    startDate: new Date().toISOString().split('T')[0],
  });

  const { getClinicalContext, isReady: brainReady } = useClinicalBrain();
  const { searchKnowledge, isLoading: kbLoading } = useKnowledgeBase();

  // Check interactions when new drug name changes
  useEffect(() => {
    if (newDrug.drugName) {
      const interactions = checkDrugInteraction(newDrug.drugName, editedDrugs);
      setDrugInteractions(interactions);
    } else {
      setDrugInteractions([]);
    }
  }, [newDrug.drugName, editedDrugs]);

  // Promote a differential diagnosis to primary
  const promoteDiagnosis = (diagnosis: string) => {
    if (!structuredResponse) return;
    setStructuredResponse({
      ...structuredResponse,
      diagnosis: diagnosis,
    });
    toast.success("Primary diagnosis updated");
  };

  // Filter drugs for auto-complete
  const filteredDrugs = drugSearchTerm 
    ? COMMON_DRUGS.filter(drug => drug.toLowerCase().includes(drugSearchTerm.toLowerCase()))
    : [];

  const handleDrugInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewDrug({ ...newDrug, drugName: value });
    setDrugSearchTerm(value);
    setShowSuggestions(true);
  };

  const handleSelectSuggestion = (drugName: string) => {
    setNewDrug({ ...newDrug, drugName });
    setDrugSearchTerm(drugName);
    setShowSuggestions(false);
  };

  // Initialize editedDrugs when structuredResponse changes
  useEffect(() => {
    if (structuredResponse?.structuredDrugs) {
      const initialDrugs = structuredResponse.structuredDrugs.map(d => ({
        id: generateId(),
        drugName: d.drugName,
        dosage: d.dosage,
        frequency: d.frequency,
        route: d.route,
        startDate: new Date().toISOString().split('T')[0],
        prescribedBy: "AI Assistant",
        notes: d.notes,
        createdAt: new Date().toISOString()
      }));
      setEditedDrugs(initialDrugs);
    }
  }, [structuredResponse]);

  // Run structured analysis (shared by form submit and auto-send)
  const runAnalysis = useCallback(
    async (query: string) => {
      if (!query.trim() || !encounterId) return;

      setError(null);
      setStructuredResponse(null);
      setIsLoading(true);

      let enhancedPrompt = "";
      let encounterContext = "";

      try {
        // ==================== STAGE 1: RETRIEVAL (Find Protocol) ====================
        // Build CLEAN search query (diagnosis/complaint only) for accurate search
        const retrievalQuery = buildRetrievalQuery(query, encounter);
        let hasMatch = false;
        let isTrueProtocolMatch = false; // Distinguish true matches from aggressive fallback
        let protocolContextText = "None";

        console.log('[STAGE 1] Starting protocol retrieval for:', retrievalQuery);

        // PRIORITY 1: Local Keyword Search (Fast, Deterministic)
        console.log('[STAGE 1] Attempting keyword search...');
        const keywordProtocols = await searchKnowledge(retrievalQuery, 5);
        
        if (keywordProtocols.length > 0) {
          hasMatch = true;
          isTrueProtocolMatch = true;
          protocolContextText = formatKnowledgeForAI(keywordProtocols).trim();
          console.log('[STAGE 1] ✓ Protocol found via keyword search:', keywordProtocols.length, 'chunks');
        } else {
          console.log('[STAGE 1] Keyword search returned empty, trying vector search...');
          
          // PRIORITY 2: Vector Search (Semantic, requires Worker)
          try {
            console.log('[STAGE 1] Attempting vector search...');
            // Add timeout to prevent hanging if worker is slow/broken
            const context = await Promise.race([
              getClinicalContext(retrievalQuery),
              new Promise<string>((_, reject) =>
                setTimeout(() => reject(new Error("Vector search timeout")), 8000)
              ),
            ]);
            
            if (context && context.trim().length > 0) {
              hasMatch = true;
              isTrueProtocolMatch = true;
              protocolContextText = context.trim();
              console.log('[STAGE 1] ✓ Protocol found via vector search, length:', context.length);
            } else {
              console.log('[STAGE 1] ⚠ Vector search returned empty');
            }
          } catch (ctxErr: any) {
            console.warn('[STAGE 1] ⚠ Vector search failed:', ctxErr.message);
            // Continue to fallback
          }
        }
        
        // AGGRESSIVE FALLBACK: If still no match, try searching for common conditions and vital-driven cues
        if (!hasMatch && encounter) {
          console.log('[STAGE 1] → Trying aggressive fallback for common conditions...');
          
          const aggressiveQueries: string[] = [];
          const diag = (encounter.diagnosis || "").toLowerCase();
          const symptomsText = (encounter.symptoms || []).map(s => s.toLowerCase()).join(" ");
          const complaintText = (encounter.presentingComplaint || '').toLowerCase();

          // Vitals-driven signals
          const sys = parseFloat((encounter.vitals?.bloodPressureSystolic as any) || '');
          const dia = parseFloat((encounter.vitals?.bloodPressureDiastolic as any) || '');
          const lowBP = !isNaN(sys) && !isNaN(dia) && (sys < 90 || dia < 60);

          if (diag.includes('malaria') || symptomsText.includes('fever')) {
            aggressiveQueries.push('malaria', 'plasmodium', 'artesunate amodiaquine', 'artemether lumefantrine');
          }
          if (diag.includes('tuberculosis') || diag.includes('tb')) {
            aggressiveQueries.push('tuberculosis', 'anti-tuberculosis', 'rifampicin', 'isoniazid');
          }
          if (diag.includes('asthma')) {
            aggressiveQueries.push('asthma', 'salbutamol', 'corticosteroid');
          }
          if (diag.includes('pneumonia')) {
            aggressiveQueries.push('pneumonia', 'amoxicillin', 'antibiotics');
          }
          if (diag.includes('diabetes')) {
            aggressiveQueries.push('diabetes', 'metformin', 'insulin', 'glycaemia');
          }
          if (diag.includes('hypertension') || symptomsText.includes('bp')) {
            aggressiveQueries.push('hypertension', 'blood pressure', 'amlodipine');
          }

          // Maternal and nutrition cues
          if (diagnosisOrTextContains(complaintText + ' ' + symptomsText + ' ' + diag, ['pregnan','antenatal','anc'])) {
            aggressiveQueries.push('pregnancy', 'antenatal care', 'anemia in pregnancy', 'hypertension in pregnancy', 'pre-eclampsia');
          }
          if (lowBP) {
            aggressiveQueries.push('hypotension', 'shock management', 'dehydration management');
          }
          if (diagnosisOrTextContains(complaintText + ' ' + symptomsText, ['weakness','fatigue'])) {
            aggressiveQueries.push('anemia', 'malnutrition', 'underweight', 'low bmi');
          }
          
          for (const aggressiveQuery of aggressiveQueries) {
            if (hasMatch) break;
            console.log('[STAGE 1] Trying aggressive query:', aggressiveQuery);
            const aggressiveResults = await searchKnowledge(aggressiveQuery, 3);
            if (aggressiveResults.length > 0) {
              hasMatch = true;
              protocolContextText = formatKnowledgeForAI(aggressiveResults).trim();
              console.log('[STAGE 1] ✓ Protocol found via aggressive search:', aggressiveQuery);
              break;
            }
          }
        }

        setIsLocalMatch(hasMatch);
        setIsVerifiedProtocol(isTrueProtocolMatch);
        setProtocolContextText(protocolContextText);

        // ==================== STAGE 2: REASONING (Apply to Patient) ====================
        // Build FULL encounter context for LLM reasoning (vitals, labs, demographics)
        encounterContext = buildEncounterContext(encounter, patient);
        console.log('[STAGE 2] Built encounter context for LLM reasoning');

        console.log('[PIPELINE SUMMARY]', {
          retrievalQuery,
          hasProtocol: hasMatch,
          protocolLength: protocolContextText.length,
          contextLength: encounterContext.length
        });

        enhancedPrompt = `
SYSTEM: You are the Afia Clinical AI. Follow the TWO-STAGE pipeline below.

=== PATIENT DATA (CRITICAL - USE FOR DOSING) ===
${encounterContext || 'No patient data available.'}

=== STAGE 1: PROTOCOL RETRIEVAL (Already Completed) ===
The system has searched the national standard treatment guidelines using a targeted query.

PROTOCOLS RETRIEVED:
${protocolContextText !== "None" ? protocolContextText : "[NO PROTOCOL FOUND - Use general medical knowledge only]"}

=== STAGE 2: CLINICAL REASONING (Your Task) ===
You must apply the retrieved protocol to the SPECIFIC PATIENT above.

CRITICAL INSTRUCTIONS:
1. FALLBACK MANDATE: If NO PROTOCOLS were retrieved (above shows "NO PROTOCOL FOUND"), you MUST generate a comprehensive clinical plan using GENERAL MEDICAL KNOWLEDGE. DO NOT return empty fields.
2. CITATION RULE (STRICT): Only cite the specific national guidelines if actual protocol data was provided above (e.g., "According to GHS STG 7th Edition" for Ghana or "According to EDLIZ 8th Edition" for Zimbabwe). If no protocols found, cite as "General medical knowledge" or "Based on standard clinical practice"
3. ADAPT the protocol to the patient's age, weight, vitals, and labs shown in PATIENT DATA section
4. Example: If protocol says "AS-AQ" but patient is 8kg infant, calculate pediatric dose based on weight in PATIENT DATA
5. DO NOT hallucinate national protocols. If none were provided, be honest that you're using general knowledge
6. DOSAGE SAFETY RULE: If patient weight shows as "NOT RECORDED" or "⚠️ CRITICAL WARNING" above, you MUST:
   - State clearly that dosages are estimates only
   - Advise verifying patient weight before administration
   - Calculate based on typical adult weight (70kg) only if absolutely necessary, with clear disclaimer

USER QUERY: ${query.trim()}

FORMATTING RULES:
- NO Markdown (no *, #, \`)
- Use plain, professional medical English
- Clear sections: DIAGNOSIS, TREATMENT PLAN, RATIONALE

OUTPUT: Return ONLY a valid JSON object:
{
  "differentialDiagnosis": ["Alternative diagnosis 1", "Alternative diagnosis 2"],
  "diagnosis": "Brief formal diagnosis",
  "treatment": "Overall treatment summary string",
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
  "isDisclaimer": ${!isTrueProtocolMatch}
}

Note: Set isDisclaimer to true ONLY if no national protocols were retrieved. If using general knowledge, be honest about it in your citations.`.trim();

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            structuredOnly: true,
            prompt: enhancedPrompt,
            context: encounterContext || undefined,
          }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(
            (errBody as { userMessage?: string }).userMessage ||
              (errBody as { error?: string }).error ||
              `Request failed: ${res.status}`
          );
        }

        const data = (await res.json()) as StructuredClinicalResponse;
        if (
          typeof data.diagnosis === "string" &&
          typeof data.treatment === "string" &&
          typeof data.clinicalNotes === "string" &&
          typeof data.isDisclaimer === "boolean"
        ) {
          setStructuredResponse(data);
        } else {
          setStructuredResponse({
            diagnosis: (data as any).diagnosis ?? "Clinical Assessment Pending",
            differentialDiagnosis: (data as any).differentialDiagnosis ?? [],
            treatment: (data as any).treatment ?? String(data),
            structuredDrugs: (data as any).structuredDrugs ?? [],
            clinicalNotes: (data as any).clinicalNotes ?? (data as any).historyNote ?? "",
            followUpInstructions: (data as any).followUpInstructions ?? "",
            isDisclaimer: (data as any).isDisclaimer ?? !hasMatch,
          });
        }
      } catch (err: any) {
        console.error("[AfiaAssistant] Analysis failed:", err);
        setError(err?.message ?? "Something went wrong");
        
        // Final Safety Net: If AI completely fails (e.g. network/server error), 
        // provide a safe, generic fallback based on the presenting complaint.
        // We do NOT want "Pending" to persist.
        const complaint = encounter?.presentingComplaint || "General Consultation";
        
        // --- OFFLINE QUEUE LOGIC ---
        // If the error suggests network failure, queue the request for later
        const isNetworkError = err?.message?.includes('fetch') || err?.message?.includes('network') || !navigator.onLine;
        
        if (isNetworkError && encounterId && patient) {
          try {
            const queueId = generateId();
            const queueItem: AIRequest = {
              id: queueId,
              type: 'diagnosis',
              encounterId: encounterId,
              patientId: patient.id,
              payload: JSON.stringify({
                 prompt: enhancedPrompt,
                 context: encounterContext,
                 query: query
              }),
              status: 'queued',
              createdAt: new Date().toISOString(),
              response: null,
              completedAt: null
            };
            await aiRequestDB.save(queueItem);
            toast.warning("Offline: Request queued for background processing", {
              description: "We'll analyze this case automatically when connection returns."
            });
          } catch (qErr) {
            console.error("Failed to queue offline request:", qErr);
          }
        }

        const safeFallback: StructuredClinicalResponse = {
          diagnosis: "Assessment Unavailable (Network/Service Error)",
          differentialDiagnosis: [],
          treatment: "Unable to generate AI treatment plan. Please proceed with standard clinical assessment and facility protocols. Ensure vitals are stable.",
          structuredDrugs: [],
          clinicalNotes: `AI Service Error: ${err?.message || "Unknown error"}. \n\nGeneral guidance: Assess for danger signs. If patient is unstable, refer immediately.`,
          followUpInstructions: "Retry AI analysis when network is stable.",
          isDisclaimer: true
        };
        
        setStructuredResponse(safeFallback);
        // Don't show error toast if we queued it, just the warning above
        if (!isNetworkError) {
           toast.error("AI Service Unavailable - Showing Safety Fallback");
        }
      } finally {
        setIsLoading(false);
      }
    },
    [encounterId, encounter, patient, getClinicalContext, searchKnowledge]
  );

  // Load encounter and patient when encounterId is present
  useEffect(() => {
    if (!encounterId) return;
    let cancelled = false;
    (async () => {
      const enc = await encounterDB.getById(encounterId);
      if (cancelled) return;
      setEncounter(enc ?? null);
      if (enc) {
        const p = await patientDB.getById(enc.patientId);
        if (!cancelled) setPatient(p ?? null);
      }
    })();
    return () => { cancelled = true; };
  }, [encounterId]);

  // Auto-send once when encounter is loaded and KB is done loading to prioritize KB over embeddings
  useEffect(() => {
    if (!encounterId || !encounter || autoSentForEncounterRef.current === encounterId) return;
    if (kbLoading) return;
    autoSentForEncounterRef.current = encounterId;
    const query = buildDefaultQuery(encounter);
    runAnalysis(query);
  }, [encounterId, encounter, runAnalysis, kbLoading]);

  const handleClinicalAsk = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim()) return;
      runAnalysis(input.trim());
    },
    [input, runAnalysis]
  );

  function diagnosisOrTextContains(text: string, needles: string[]) {
    const t = text.toLowerCase();
    return needles.some(n => t.includes(n));
  }
  const syncToRecord = useCallback(async () => {
    if (!structuredResponse || !encounterId) return;

    setIsSyncing(true);
    try {
      const enc = await encounterDB.getById(encounterId);
      if (!enc) {
        toast.error("Encounter not found");
        return;
      }

      enc.diagnosis = structuredResponse.diagnosis;
      enc.treatment = structuredResponse.treatment;
      // Note: NOT marking as completed - allow clinician to manually complete later
      enc.updatedAt = new Date().toISOString();
      
      // Save AI structured data
      enc.aiDiagnosisData = {
        primaryDiagnosis: structuredResponse.diagnosis,
        secondaryDiagnosis: "",
        treatmentPlan: structuredResponse.treatment,
        clinicalNotes: structuredResponse.clinicalNotes,
        followUpInstructions: structuredResponse.followUpInstructions,
        appliedAt: new Date().toISOString(),
        confidence: 1,
      };
      
      // Save Drugs
      if (editedDrugs.length > 0) {
        const existingIds = new Set((enc.drugs || []).map(d => d.id));
        const newUniqueDrugs = editedDrugs.filter(d => !existingIds.has(d.id));
        
        enc.drugs = [
          ...(enc.drugs || []),
          ...newUniqueDrugs
        ];
      }
      
      const combinedNotes = [
        structuredResponse.clinicalNotes,
        structuredResponse.followUpInstructions
      ].filter(Boolean).join("\n\n");

      if (combinedNotes) {
        enc.notes = (enc.notes ?? "").trim()
          ? `${enc.notes.trim()}\n${combinedNotes}`
          : combinedNotes;
      }

      await encounterDB.save(enc);
      toast.success("AI recommendations saved to encounter");
      
      // Force hard navigation to ensure page reload and data sync
      window.location.href = `/encounters/${encounterId}`;
    } catch (err) {
      toast.error("Failed to save recommendations");
    } finally {
      setIsSyncing(false);
    }
  }, [structuredResponse, encounterId, editedDrugs]);

  const handleAddDrug = () => {
    if (!newDrug.drugName || !newDrug.dosage) {
      toast.error("Drug name and dosage are required");
      return;
    }
    
    const drug: DrugAdministration = {
      id: generateId(),
      drugName: newDrug.drugName,
      dosage: newDrug.dosage,
      frequency: newDrug.frequency || "Once daily",
      route: newDrug.route || "oral",
      startDate: newDrug.startDate || new Date().toISOString().split('T')[0],
      prescribedBy: user?.full_name || "Clinician",
      notes: newDrug.notes,
      createdAt: new Date().toISOString()
    };
    
    setEditedDrugs([...editedDrugs, drug]);
    setNewDrug({
      drugName: "",
      dosage: "",
      frequency: "",
      route: "oral",
      startDate: new Date().toISOString().split('T')[0],
    });
    setDrugSearchTerm("");
    setShowAddDrugForm(false);
    toast.success("Drug added");
  };

  const handleUpdateDrug = (id: string, updates: Partial<DrugAdministration>) => {
    setEditedDrugs(editedDrugs.map(d => d.id === id ? { ...d, ...updates } : d));
  };

  const handleRemoveDrug = (id: string) => {
    setEditedDrugs(editedDrugs.filter(d => d.id !== id));
  };

  if (!encounterId) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-slate-600">Open this page from an encounter to use the Clinical Hub.</p>
        <Link href="/encounters">
          <Button variant="outline">View encounters</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans">
      {/* Header */}
      <div className="p-4 bg-white border-b flex flex-col sm:flex-row items-start sm:items-center justify-between sticky top-0 z-10 shadow-sm gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <BackNavigation 
            fallback={encounterId ? `/encounters/${encounterId}` : "/encounters"} 
            showQuickNav={true} 
            forceQuickNavMobile={true}
            size="icon"
            className="shrink-0"
          />
          <div className="flex-1 sm:flex-none">
            <h1 className="font-black text-slate-900 flex flex-wrap items-center gap-2 text-sm uppercase tracking-tight">
              AfiaAssistant <Badge className="bg-emerald-100 text-emerald-700 whitespace-nowrap">CLINICAL HUB</Badge>
              <CloudSyncIndicator className="ml-2" />
            </h1>
            <p className="text-[11px] text-slate-500 font-medium truncate max-w-[200px] sm:max-w-none">
              Patient: {patient?.name} • Weight: <span className="text-emerald-700 font-bold">{encounter?.vitals?.weight && parseFloat(encounter.vitals.weight) > 0 ? `${encounter.vitals.weight}kg` : "N/A"}</span>
            </p>
          </div>
        </div>
      </div>

      {structuredResponse && (
          <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
            {/* 1. DIAGNOSIS CARD (Promotable) */}
            <Card className="border-l-4 border-l-rose-500 shadow-sm overflow-hidden">
              <CardHeader className="bg-rose-50/50 pb-2">
                <CardTitle className="flex items-center justify-between text-base text-rose-900">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="h-5 w-5 text-rose-600" />
                    AI DIFFERENTIAL DIAGNOSIS
                  </div>
                  <Badge variant="outline" className="bg-white text-rose-700 border-rose-200">
                    Confidence: High
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="p-3 bg-white border rounded-lg shadow-sm">
                  <p className="text-lg font-bold text-slate-800">{structuredResponse.diagnosis}</p>
                </div>
                
                {/* Differential Diagnosis Promotion */}
                {structuredResponse.differentialDiagnosis && structuredResponse.differentialDiagnosis.length > 0 && (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Differential Diagnosis (Tap to Promote)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {structuredResponse.differentialDiagnosis.map((diag, idx) => (
                        <Badge 
                          key={idx} 
                          variant="outline" 
                          className="bg-white hover:bg-rose-50 cursor-pointer border-rose-200 text-slate-700 py-1.5 transition-all active:scale-95"
                          onClick={() => promoteDiagnosis(diag)}
                        >
                          {diag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-2 rounded mt-2">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  Tap a differential diagnosis to make it primary. Tap &quot;Accept &amp; Sync&quot; to save to encounter.
                </div>
              </CardContent>
            </Card>

            {/* 2. INTEGRATED TREATMENT CARD (Editable Drugs) */}
            <Card className="border-l-4 border-l-emerald-500 shadow-sm overflow-hidden">
              <CardHeader className="bg-emerald-50/50 pb-2">
                <CardTitle className="flex items-center justify-between text-base text-emerald-900">
                  <div className="flex items-center gap-2">
                    <Pill className="h-5 w-5 text-emerald-600" />
                    TREATMENT PLAN
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-7 text-xs border-emerald-200 text-emerald-700 bg-white hover:bg-emerald-50"
                    onClick={() => setShowAddDrugForm(!showAddDrugForm)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Manual Add
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {/* Drug List */}
                <div className="space-y-3">
                  {editedDrugs.map((drug) => (
                    <div key={drug.id} className="relative group">
                      {editingDrugId === drug.id ? (
                        <div className="p-3 border rounded-lg bg-slate-50 space-y-3 animate-in fade-in zoom-in-95">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="sm:col-span-2">
                              <Label className="text-xs">Drug Name</Label>
                              <Input 
                                value={drug.drugName} 
                                onChange={(e) => handleUpdateDrug(drug.id, { drugName: e.target.value })}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Dosage</Label>
                              <Input 
                                value={drug.dosage} 
                                onChange={(e) => handleUpdateDrug(drug.id, { dosage: e.target.value })}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Frequency</Label>
                              <Input 
                                value={drug.frequency} 
                                onChange={(e) => handleUpdateDrug(drug.id, { frequency: e.target.value })}
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingDrugId(null)}>
                              <Check className="h-4 w-4 text-emerald-600" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between p-3 border rounded-lg bg-white hover:border-emerald-200 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                              <Pill className="h-4 w-4 text-emerald-700" />
                            </div>
                            <div>
                              <h4 className="font-bold text-sm text-slate-900">{drug.drugName}</h4>
                              <p className="text-xs text-slate-600">
                                {drug.dosage} • {drug.frequency} • {drug.route}
                              </p>
                              {drug.notes && (
                                <p className="text-[10px] text-slate-400 mt-1 italic">{drug.notes}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-8 w-8 p-0 text-slate-400 hover:text-slate-900"
                              onClick={() => setEditingDrugId(drug.id)}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"
                              onClick={() => handleRemoveDrug(drug.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add Manual Drug Form */}
                {showAddDrugForm && (
                  <div className="p-4 border border-dashed border-emerald-300 rounded-lg bg-emerald-50/30 animate-in slide-in-from-top-2 relative">
                    <h4 className="text-xs font-bold text-emerald-800 uppercase mb-3">Add New Drug</h4>
                    <div className="space-y-3">
                      <div className="relative">
                        <Label className="text-xs">Drug Name</Label>
                        <Input 
                          placeholder="Search or type..."
                          value={newDrug.drugName}
                          onChange={handleDrugInputChange}
                          onFocus={() => setShowSuggestions(true)}
                          className={cn("bg-white", drugInteractions.length > 0 && "border-amber-500 focus-visible:ring-amber-500")}
                        />
                        
                        {/* Suggestions Dropdown */}
                        {showSuggestions && drugSearchTerm && filteredDrugs.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                            {filteredDrugs.map((drug) => (
                              <div
                                key={drug}
                                className="px-3 py-2 text-sm hover:bg-emerald-50 cursor-pointer text-slate-700 border-b last:border-0"
                                onClick={() => handleSelectSuggestion(drug)}
                              >
                                {drug}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Interaction Warning */}
                      {drugInteractions.length > 0 && (
                        <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 flex gap-2 items-start animate-in fade-in">
                          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                          <div>
                            <span className="font-bold block mb-1">Drug Interaction Warning:</span>
                            <ul className="list-disc list-inside space-y-0.5 opacity-90">
                              {drugInteractions.map((interaction, idx) => (
                                <li key={idx}>{interaction}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Dosage</Label>
                          <Input 
                            placeholder="e.g. 500mg"
                            value={newDrug.dosage}
                            onChange={(e) => setNewDrug({...newDrug, dosage: e.target.value})}
                            className="bg-white"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Frequency</Label>
                          <Input 
                            placeholder="e.g. TID"
                            value={newDrug.frequency}
                            onChange={(e) => setNewDrug({...newDrug, frequency: e.target.value})}
                            className="bg-white"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleAddDrug}>
                          {drugInteractions.length > 0 ? "Add Anyway" : "Add Drug"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowAddDrugForm(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 3. MERGED PLAN & DISPOSITION */}
            <Card className="border-l-4 border-l-blue-500 shadow-sm">
              <CardHeader className="bg-blue-50/50 pb-2">
                <CardTitle className="flex items-center gap-2 text-base text-blue-900">
                  <ClipboardCheck className="h-5 w-5 text-blue-600" />
                  PLAN & DISPOSITION
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase">Clinical Notes & Rationale</Label>
                  <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-700 leading-relaxed">
                    {structuredResponse.clinicalNotes}
                  </div>
                </div>
                {structuredResponse.followUpInstructions && (
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500 uppercase">Follow-up & Instructions</Label>
                    <div className="flex gap-3 p-3 bg-blue-50/50 border border-blue-100 rounded-lg">
                      <Calendar className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                      <p className="text-sm text-blue-800">{structuredResponse.followUpInstructions}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Disclaimer Footer */}
            <div className="pb-8">
               {structuredResponse.isDisclaimer ? (
                 <div className="flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs leading-relaxed">
                   <AlertTriangle className="h-4 w-4 shrink-0" />
                   <p>
                     <strong>Guidance Only:</strong> No specific national protocol was found for this exact presentation. 
                     This advice is based on general medical knowledge. Please verify all dosages and treatments.
                   </p>
                 </div>
               ) : (
                 <div className="flex gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs leading-relaxed">
                   <ShieldCheck className="h-4 w-4 shrink-0" />
                   <p>
                     <strong>Verified Protocol:</strong> This guidance is based on national standard treatment guidelines for {user?.country_code === 'ZW' ? 'Zimbabwe (EDLIZ)' : 'Ghana (GHS STG)'}.
                   </p>
                 </div>
               )}
            </div>
          </div>
        )}

        {/* Action Bar */}
        {structuredResponse && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-20">
            <Button 
              className="w-full h-12 text-base font-bold bg-slate-900 hover:bg-slate-800 shadow-lg"
              onClick={syncToRecord}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Syncing to Record...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-5 w-5" />
                  Accept & Sync to Encounter
                </>
              )}
            </Button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-4">
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-4 border-slate-100 border-t-emerald-500 animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Bot className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="font-bold text-slate-900">Analyzing Clinical Data...</h3>
              <p className="text-sm text-slate-500">
                Checking GHS Protocols & Patient Vitals
              </p>
            </div>
          </div>
        )}

        {/* Empty State / Initial View */}
        {!structuredResponse && !isLoading && (
          <div className="flex-1 p-4 flex flex-col items-center justify-center text-center space-y-6">
            <div className="h-20 w-20 bg-emerald-50 rounded-full flex items-center justify-center mb-2">
              <Stethoscope className="h-10 w-10 text-emerald-600" />
            </div>
            <div className="space-y-2 max-w-xs mx-auto">
              <h2 className="text-xl font-bold text-slate-900">Clinical Assistant</h2>
              <p className="text-sm text-slate-500">
                AI-powered decision support based on GHS Standard Treatment Guidelines.
              </p>
            </div>
            
            <div className="w-full max-w-md space-y-4">
               {/* Quick Action Chips */}
               <div className="flex flex-wrap justify-center gap-2">
                 <Badge variant="outline" className="px-3 py-1.5 bg-white cursor-pointer hover:bg-slate-50" onClick={() => runAnalysis("Malaria protocol")}>Malaria</Badge>
                 <Badge variant="outline" className="px-3 py-1.5 bg-white cursor-pointer hover:bg-slate-50" onClick={() => runAnalysis("Upper Respiratory Tract Infection")}>URTI</Badge>
                 <Badge variant="outline" className="px-3 py-1.5 bg-white cursor-pointer hover:bg-slate-50" onClick={() => runAnalysis("Hypertension management")}>Hypertension</Badge>
                 <Badge variant="outline" className="px-3 py-1.5 bg-white cursor-pointer hover:bg-slate-50" onClick={() => runAnalysis("Diarrhea in children")}>Diarrhea</Badge>
               </div>

               <div className="relative">
                 <Textarea 
                   placeholder="Describe symptoms or ask a clinical question..." 
                   className="min-h-[120px] p-4 text-base shadow-sm resize-none border-slate-200 focus:border-emerald-500 focus:ring-emerald-500"
                   value={input}
                   onChange={(e) => setInput(e.target.value)}
                 />
                 <Button 
                   size="sm" 
                   className="absolute bottom-3 right-3 bg-emerald-600 hover:bg-emerald-700"
                   onClick={(e) => handleClinicalAsk(e)}
                   disabled={!input.trim()}
                 >
                   <Zap className="h-4 w-4 mr-1" />
                   Analyze
                 </Button>
               </div>
            </div>
          </div>
        )}
    </div>
  );
}
