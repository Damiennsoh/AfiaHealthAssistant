import { useState, useEffect } from 'react';
import { ReferralTrigger, VitalAlert } from '@/lib/db';

// Critical keywords that indicate need for referral
const CRITICAL_KEYWORDS = [
  // Bleeding
  { keywords: ['profuse bleeding', 'heavy bleeding', 'hemorrhage', 'hemorrhaging', 'blood loss', 'bleeding heavily'], 
    reason: 'Severe bleeding requiring emergency intervention',
    vitalType: 'Clinical Presentation' },
  { keywords: ['vaginal bleeding', 'antepartum hemorrhage', 'postpartum hemorrhage', 'pph', 'aph'], 
    reason: 'Obstetric hemorrhage - emergency referral required',
    vitalType: 'Obstetric Emergency' },
  { keywords: ['bloody stool', 'blood in stool', 'hematochezia', 'melena', 'black tarry stool'], 
    reason: 'Gastrointestinal bleeding',
    vitalType: 'GI Emergency' },
  { keywords: ['hemoptysis', 'coughing blood', 'blood in sputum'], 
    reason: 'Respiratory bleeding - possible serious lung condition',
    vitalType: 'Respiratory Emergency' },
  
  // Pain
  { keywords: ['severe pain', 'excruciating pain', 'intense pain', 'unbearable pain'], 
    reason: 'Severe pain requiring advanced analgesia and evaluation',
    vitalType: 'Pain Assessment' },
  { keywords: ['chest pain', 'angina', 'crushing chest pain'], 
    reason: 'Chest pain - possible cardiac emergency',
    vitalType: 'Cardiac Emergency' },
  { keywords: ['severe abdominal pain', 'acute abdomen', 'rigid abdomen'], 
    reason: 'Acute abdomen - possible surgical emergency',
    vitalType: 'Surgical Emergency' },
  
  // Neurological
  { keywords: ['unconscious', 'unresponsive', 'coma', 'comatose', 'altered mental status', 'confusion', 'disoriented'], 
    reason: 'Altered consciousness - neurological emergency',
    vitalType: 'Neurological Emergency' },
  { keywords: ['seizure', 'convulsions', 'fitting', 'epilepticus'], 
    reason: 'Seizure activity requiring emergency management',
    vitalType: 'Neurological Emergency' },
  { keywords: ['stroke', 'hemiplegia', 'hemiparesis', 'facial droop', 'slurred speech'], 
    reason: 'Possible cerebrovascular accident (stroke)',
    vitalType: 'Neurological Emergency' },
  
  // Respiratory
  { keywords: ['severe dyspnea', 'cannot breathe', 'difficulty breathing', 'respiratory distress', 'cyanosis', 'blue lips'], 
    reason: 'Severe respiratory distress',
    vitalType: 'Respiratory Emergency' },
  
  // Pregnancy/Obstetric
  { keywords: ['severe preeclampsia', 'eclampsia', 'convulsions in pregnancy'], 
    reason: 'Hypertensive disorder of pregnancy - emergency',
    vitalType: 'Obstetric Emergency' },
  { keywords: ['prolapsed cord', 'cord prolapse', 'breech delivery complication'], 
    reason: 'Obstetric emergency requiring immediate intervention',
    vitalType: 'Obstetric Emergency' },
  { keywords: ['shoulder dystocia', 'obstructed labor', 'failure to progress'], 
    reason: 'Complicated labor requiring surgical intervention',
    vitalType: 'Obstetric Emergency' },
  
  // Trauma
  { keywords: ['head injury', 'head trauma', 'skull fracture', 'brain injury'], 
    reason: 'Head trauma requiring neurosurgical evaluation',
    vitalType: 'Trauma Emergency' },
  { keywords: ['fracture', 'broken bone', 'open fracture', 'compound fracture'], 
    reason: 'Fracture requiring orthopedic intervention',
    vitalType: 'Orthopedic Emergency' },
  { keywords: ['burns', 'severe burns', 'extensive burns', 'third degree burns'], 
    reason: 'Burns requiring specialized care',
    vitalType: 'Burn Emergency' },
  
  // Other
  { keywords: ['anaphylaxis', 'severe allergic reaction', 'difficulty swallowing', 'swelling of throat'], 
    reason: 'Severe allergic reaction - emergency',
    vitalType: 'Allergic Emergency' },
  { keywords: ['poisoning', 'overdose', 'toxic ingestion', 'snake bite', 'snakebite'], 
    reason: 'Toxicological emergency',
    vitalType: 'Toxicology Emergency' },
  { keywords: ['severe dehydration', 'shock', 'hypovolemic', 'cold extremities'], 
    reason: 'Circulatory compromise - shock state',
    vitalType: 'Shock' },
];

export function useClinicalReferralAnalyzer(
  clinicalText: string,
  options: {
    enabled?: boolean;
    patientPregnant?: boolean;
  } = {}
) {
  const { enabled = true, patientPregnant = false } = options;
  
  const [clinicalTriggers, setClinicalTriggers] = useState<ReferralTrigger[]>([]);
  const [clinicalAlerts, setClinicalAlerts] = useState<VitalAlert[]>([]);

  useEffect(() => {
    if (!enabled || !clinicalText || clinicalText.length < 10) {
      setClinicalTriggers([]);
      setClinicalAlerts([]);
      return;
    }

    const text = clinicalText.toLowerCase();
    const newTriggers: ReferralTrigger[] = [];
    const newAlerts: VitalAlert[] = [];

    CRITICAL_KEYWORDS.forEach((pattern) => {
      // Skip obstetric patterns if patient is not pregnant
      if (pattern.vitalType === 'Obstetric Emergency' && !patientPregnant) {
        return;
      }

      const found = pattern.keywords.some(keyword => text.includes(keyword.toLowerCase()));
      
      if (found) {
        const trigger: ReferralTrigger = {
          reason: pattern.reason,
          vitalType: pattern.vitalType,
          threshold: 'Clinical keyword detection',
          actualValue: 'Based on presenting complaint',
          triggeredAt: new Date().toISOString()
        };
        
        const alert: VitalAlert = {
          type: 'clinical_critical',
          severity: 'critical',
          message: pattern.reason,
          value: pattern.vitalType
        };

        // Avoid duplicates
        if (!newTriggers.some(t => t.reason === pattern.reason)) {
          newTriggers.push(trigger);
          newAlerts.push(alert);
        }
      }
    });

    setClinicalTriggers(newTriggers);
    setClinicalAlerts(newAlerts);
  }, [clinicalText, enabled, patientPregnant]);

  const hasClinicalReferralTriggers = clinicalTriggers.length > 0;

  return {
    clinicalTriggers,
    clinicalAlerts,
    hasClinicalReferralTriggers,
    clearClinicalAlerts: () => {
      setClinicalTriggers([]);
      setClinicalAlerts([]);
    }
  };
}

// Helper function to check if text contains critical referral keywords (for one-off checks)
export function containsCriticalReferralKeywords(text: string): {
  hasCriticalKeywords: boolean;
  detectedKeywords: string[];
  reasons: string[];
} {
  if (!text || text.length < 5) {
    return { hasCriticalKeywords: false, detectedKeywords: [], reasons: [] };
  }

  const lowerText = text.toLowerCase();
  const detected: string[] = [];
  const reasons: string[] = [];

  CRITICAL_KEYWORDS.forEach((pattern) => {
    const found = pattern.keywords.some(keyword => {
      const match = lowerText.includes(keyword.toLowerCase());
      if (match && !detected.includes(keyword)) {
        detected.push(keyword);
      }
      return match;
    });
    
    if (found && !reasons.includes(pattern.reason)) {
      reasons.push(pattern.reason);
    }
  });

  return {
    hasCriticalKeywords: detected.length > 0,
    detectedKeywords: detected,
    reasons
  };
}
