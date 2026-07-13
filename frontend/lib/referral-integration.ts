// Example integration data structure for AI-generated referrals
// This would be returned by the Senior Clinical Consultant AI when it identifies need for referral

export interface ReferralData {
  referringFacility: string;
  receivingFacility: string;
  patientName: string;
  age: string;
  gender: string;
  nhisNumber?: string;
  history: string;
  vitals: {
    bp: string;
    temp: string;
    pulse: string;
    weight: string;
  };
  treatmentGiven: string;
  reason: string;
  officerName: string;
}

// Example AI response structure for referral cases
export const EXAMPLE_AI_REFERRAL_RESPONSE = {
  assessment: "Patient presents with severe malaria complications requiring higher-level care",
  requiresReferral: true,
  referralData: {
    referringFacility: "Kumasi CHPS Compound",
    receivingFacility: "Kumasi Regional Hospital",
    patientName: "Ama Mensah",
    age: "28",
    gender: "Female",
    nhisNumber: "NHIS123456789",
    history: "Patient presented with 3-day history of fever, headache, and body aches. RDT positive for malaria. Developed confusion and inability to oral intake this morning. GCS 12/15.",
    vitals: {
      bp: "90/60",
      temp: "39.2°C",
      pulse: "125",
      weight: "62kg"
    },
    treatmentGiven: "IV Artesunate 120mg given at 08:00 AM. Paracetamol 1g IV for fever. Normal saline 500ml IV ongoing.",
    reason: "Severe malaria with altered consciousness - requires inpatient monitoring and specialist care",
    officerName: "Nurse Kwame Asante"
  } as ReferralData
};

// Integration example for AI Assistant
export function generateReferralFromAI(aiResponse: any): ReferralData | null {
  if (!aiResponse.requiresReferral || !aiResponse.referralData) {
    return null;
  }
  
  return {
    ...aiResponse.referralData,
    officerName: aiResponse.referralData.officerName || "Health Officer on Duty"
  };
}
