"use client";

import { useState, useEffect, useCallback } from "react";
import { knowledgeDB, KnowledgeChunk } from "@/lib/knowledge-base";
import { knowledgeSearchService } from "@/lib/knowledge-search-service";
export type { KnowledgeChunk };

interface KnowledgeBaseState {
  chunks: KnowledgeChunk[];
  isLoading: boolean;
  lastUpdated: string | null;
}

interface UseKnowledgeBaseOptions {
  loadAll?: boolean;
}

export function useKnowledgeBase(options: UseKnowledgeBaseOptions = {}) {
  const { loadAll = false } = options;

  const [state, setState] = useState<KnowledgeBaseState>({
    chunks: [],
    isLoading: loadAll, // Only start loading state if we intend to load
    lastUpdated: null,
  });

  // Load knowledge base from IndexedDB on mount and subscribe to changes
  useEffect(() => {
    // Only load all chunks if explicitly requested (heavy operation!)
    if (!loadAll) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    let mounted = true;

    const loadKnowledge = async () => {
      try {
        const chunks = await knowledgeDB.getAll();
        
        if (mounted) {
          const lastChunk = chunks[0]; 
          setState({
            chunks,
            isLoading: false,
            lastUpdated: lastChunk?.dateAdded || null,
          });
        }
      } catch (error) {
        console.error("Failed to load knowledge base:", error);
        if (mounted) {
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      }
    };

    loadKnowledge();

    // Subscribe to changes
    const unsubscribe = knowledgeDB.subscribe(() => {
      loadKnowledge();
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [loadAll]);

  // Add new chunks to knowledge base
  const addChunks = useCallback(async (newChunks: Omit<KnowledgeChunk, "id" | "dateAdded">[]) => {
    const chunksWithMetadata: KnowledgeChunk[] = newChunks.map((chunk) => ({
      ...chunk,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      dateAdded: new Date().toISOString(),
      keywords: extractKeywords(chunk.content),
    }));

    try {
      await knowledgeDB.addAll(chunksWithMetadata);
      // State update happens via subscription (if loadAll is true)
      // And worker is refreshed by knowledgeDB methods
    } catch (error) {
      console.error("Failed to save chunks:", error);
    }
  }, []);

  // Remove a chunk from knowledge base
  const removeChunk = useCallback(async (id: string) => {
    try {
      await knowledgeDB.delete(id);
    } catch (error) {
      console.error("Failed to remove chunk:", error);
    }
  }, []);

  // Clear entire knowledge base
  const clearKnowledge = useCallback(async () => {
    try {
      await knowledgeDB.clear();
    } catch (error) {
      console.error("Failed to clear knowledge base:", error);
    }
  }, []);


  // Search knowledge base for relevant sections (Optimized Worker Search)
  const searchKnowledge = useCallback(async (query: string, maxResults = 5): Promise<KnowledgeChunk[]> => {
    if (!query.trim()) return [];

    try {
      // Delegate to worker service
      const results = await knowledgeSearchService.search(query, maxResults);
      return results;
    } catch (error) {
      console.error("Worker search failed:", error);
      return [];
    }
  }, []); // No dependency on state.chunks anymore!

  // Get sync status for display
  const getSyncStatus = useCallback(() => {
    if (state.isLoading) return { status: "loading", label: "Loading..." };
    // We can't know if it's empty without checking DB, but stats should be handled separately
    return { status: "online", label: "ONLINE" };
  }, [state.isLoading]);

  return {
    ...state,
    addChunks,
    removeChunk,
    clearKnowledge,
    searchKnowledge,
    getSyncStatus,
  };
}

// Helper function to extract keywords from text
function extractKeywords(text: string): string[] {
  const medicalKeywords = [
    // Common conditions
    "malaria", "typhoid", "pneumonia", "diabetes", "hypertension", "anemia",
    "diarrhea", "cough", "fever", "headache", "pain", "infection", "hiv",
    "tuberculosis", "tb", "hepatitis", "meningitis", "sepsis",
    
    // Maternal health
    "pregnancy", "prenatal", "antenatal", "delivery", "postpartum", "eclampsia",
    "preeclampsia", "bleeding", "hemorrhage", "obstetric",
    
    // Child health
    "immunization", "vaccination", "growth", "malnutrition", "ors", "zinc",
    "vitamin a", "deworming", "breastfeeding",
    
    // Medications
    "artesunate", "amodiaquine", "artemether", "lumefantrine", "coartem",
    "paracetamol", "ibuprofen", "amoxicillin", "metronidazole", "ceftriaxone",
    "azithromycin", "doxycycline", "magnesium sulfate", "insulin", "metformin",
    
    // Vitals
    "temperature", "bp", "blood pressure", "pulse", "heart rate", "respiratory",
    "spo2", "oxygen", "weight", "height", "bmi",
    
    // Procedures
    "referral", "admission", "discharge", "follow-up", "counseling",
    
    // Additional Ghana-specific terms
    "chps", "health centre", "district hospital", "regional hospital", "teaching hospital",
    "nhis", "national health insurance", "ghs", "ghana health service",
    "stg", "standard treatment guidelines", "essential medicines", "eml",
    
    // Common symptoms and presentations
    "vomiting", "nausea", "fatigue", "weakness", "dizziness", "chest pain", 
    "abdominal pain", "back pain", "joint pain", "muscle pain", "sore throat",
    "runny nose", "congestion", "shortness of breath", "difficulty breathing",
    "rash", "itching", "swelling", "redness", "burning", "numbness",
    
    // Lab and diagnostic terms
    "blood test", "lab test", "rdt", "rapid diagnostic test", "hb", "hemoglobin",
    "glucose", "blood sugar", "creatinine", "urea", "electrolytes", "lft",
    "liver function test", "rft", "renal function test", "urine test", "stool test",
    
    // Treatment terms
    "dosage", "dose", "tablet", "capsule", "syrup", "injection", "iv", "im",
    "intravenous", "intramuscular", "oral", "topical", "inhaled", "duration",
    "frequency", "times daily", "once daily", "twice daily", "three times daily",
    
    // Preventive care
    "screening", "prevention", "vaccine", "immunization", "nutrition", "diet",
    "exercise", "lifestyle", "hygiene", "sanitation", "water treatment",
    
    // Emergency terms
    "emergency", "urgent", "critical", "severe", "mild", "moderate",
    "danger signs", "warning signs", "red flags", "complications",
  ];

  const textLower = text.toLowerCase();
  const found: string[] = [];

  medicalKeywords.forEach((keyword) => {
    if (textLower.includes(keyword)) {
      found.push(keyword);
    }
  });

  return found;
}
