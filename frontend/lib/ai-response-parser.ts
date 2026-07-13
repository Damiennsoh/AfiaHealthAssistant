/**
 * AI Response Parser
 * Extracts structured diagnosis and medication data from AI text responses
 */

export interface ParsedDiagnosis {
  primary: string;
  differentials: string[];
  severity: 'mild' | 'moderate' | 'severe' | null;
}

export interface ParsedMedication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  route: string;
  notes?: string;
}

export interface ParsedAIResponse {
  diagnosis: ParsedDiagnosis | null;
  medications: ParsedMedication[];
  hasCompleteData: boolean;
  rawText: string;
}

/**
 * Parse AI response text to extract diagnosis and medications
 */
export function parseAIResponse(content: string): ParsedAIResponse {
  const result: ParsedAIResponse = {
    diagnosis: null,
    medications: [],
    hasCompleteData: false,
    rawText: content
  };

  // Clean content for parsing
  const cleanContent = content
    .replace(/\[GENERAL_FALLBACK\]\s*/gi, '')
    .replace(/\*\*/g, '') // Remove markdown bold
    .trim();

  // Extract diagnosis
  result.diagnosis = extractDiagnosis(cleanContent);

  // Extract medications
  result.medications = extractMedications(cleanContent);

  // Check if we have complete data
  result.hasCompleteData = !!(result.diagnosis?.primary || result.medications.length > 0);

  console.log('🔍 [AI PARSER] Parsed response:', {
    hasDiagnosis: !!result.diagnosis?.primary,
    medicationCount: result.medications.length,
    hasCompleteData: result.hasCompleteData
  });

  return result;
}

/**
 * Extract diagnosis from AI response
 */
function extractDiagnosis(content: string): ParsedDiagnosis | null {
  const diagnosis: ParsedDiagnosis = {
    primary: '',
    differentials: [],
    severity: null
  };

  // Patterns to match diagnosis
  const patterns = [
    /DIAGNOSIS:\s*([^\n]+)/i,
    /\*\*DIAGNOSIS:\*\*\s*([^\n]+)/i,
    /Primary Diagnosis:\s*([^\n]+)/i,
    /Assessment Summary:\s*([^\n]+(?:\n[^\n]+)*?)(?=\n\n|\n[A-Z]|$)/i,
    /Clinical Assessment:\s*([^\n]+(?:\n[^\n]+)*?)(?=\n\n|\n[A-Z]|$)/i,
    /Impression:\s*([^\n]+)/i,
    /Suspected\s+([^.]+)/i,
    /Likely\s+([^.]+(?:Malaria|Typhoid|Pneumonia|Diabetes|Hypertension|Anemia|Gastroenteritis)[^.]*)/i,
    /This patient(?:\s+\w+)*\s+(?:has|presents with|shows signs of)\s+([^\.\n]+)/i
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      diagnosis.primary = match[1].trim();
      // Clean up and limit length
      diagnosis.primary = diagnosis.primary
        .split('\n')[0] // Take first line only
        .replace(/\*/g, '')
        .trim();
      if (diagnosis.primary.length > 100) {
        diagnosis.primary = diagnosis.primary.substring(0, 100) + '...';
      }
      break;
    }
  }

  // If no specific diagnosis pattern found, try to infer from context
  if (!diagnosis.primary) {
    const commonConditions = [
      'Malaria', 'Typhoid', 'Pneumonia', 'Diabetes', 'Hypertension',
      'Anemia', 'Gastroenteritis', 'UTI', 'Respiratory Infection',
      'Diarrhea', 'Fever', 'Headache', 'Cough'
    ];
    
    for (const condition of commonConditions) {
      const regex = new RegExp(`(${condition})(?:\s+(?:RDT\\s*\\+|positive|confirmed|suspected))?`, 'i');
      const match = content.match(regex);
      if (match) {
        diagnosis.primary = match[0];
        break;
      }
    }
  }

  // Extract severity
  const severityPatterns = [
    { pattern: /severe|critical|emergency|urgent/i, severity: 'severe' as const },
    { pattern: /moderate|mild-moderate|fair/i, severity: 'moderate' as const },
    { pattern: /mild|minor|stable|good/i, severity: 'mild' as const }
  ];

  for (const { pattern, severity } of severityPatterns) {
    if (pattern.test(content)) {
      diagnosis.severity = severity;
      break;
    }
  }

  // Extract differential diagnoses
  const diffMatch = content.match(/DIFFERENTIAL:\s*([^\n]+(?:\n[^\n]+)*?)(?=\n\n|\n[A-Z]|$)/i);
  if (diffMatch) {
    diagnosis.differentials = diffMatch[1]
      .split(/[,;\n]/)
      .map(d => d.trim())
      .filter(d => d.length > 0 && d.length < 50);
  }

  return diagnosis.primary ? diagnosis : null;
}

/**
 * Extract medications from AI response
 */
function extractMedications(content: string): ParsedMedication[] {
  const medications: ParsedMedication[] = [];

  // Split content into sections to find treatment/medication sections
  const sections = content.split(/\n\n|\n(?=[A-Z])/);
  
  for (const section of sections) {
    // Look for medication patterns
    const medPatterns = [
      // Pattern: Drug name followed by dosage
      /([A-Z][a-zA-Z\s]+(?:Amoxicillin|Paracetamol|Ibuprofen|Artemether|Lumefantrine|Coartem|Zinc|ORS|Vitamin\s*A|Ceftriaxone|Azithromycin|Doxycycline|Metronidazole|Amlodipine|Lisinopril|Glibenclamide|Metformin|Insulin)[a-zA-Z\s]*)\s+(\d+(?:\.\d+)?\s*(?:mg|g|ml|IU|tablet|tablets|capsule|capsules|amp|amps))[^.]*?(?:(\d+\s*(?:times?\/day|daily|twice|thrice|bid|tid|qid|hs|prn))|(?:for?\s+(\d+\s*(?:days?|weeks?|months?))))?/gi,
      
      // Pattern: Bullet points with medications
      /(?:•|-|\d+\.)\s*([A-Z][a-zA-Z\s]+)\s+(\d+(?:\.\d+)?\s*(?:mg|g|ml))[^.]*?(twice daily|three times|daily|every|for \d+ days)?/gi,
      
      // Pattern: Common drug names with context
      /\b(Paracetamol|Amoxicillin|Ibuprofen|Artemether|Lumefantrine|Coartem|ACT|Zinc|ORS|Vitamin\s*A|Ceftriaxone|Azithromycin|Doxycycline|Metronidazole|Amlodipine|Lisinopril|Glibenclamide|Metformin|Insulin|Chloroquine|Quinine|Artesunate)\b[^.]*?(\d+(?:\.\d+)?\s*(?:mg|g|ml|tablet))[^.]*?(daily|twice|three times|for \d+ days|as needed)?/gi
    ];

    for (const pattern of medPatterns) {
      let match;
      while ((match = pattern.exec(section)) !== null) {
        const med = parseMedicationMatch(match, section);
        if (med && !medications.find(m => m.name === med.name)) {
          medications.push(med);
        }
      }
    }
  }

  // Also look for structured medication lists in treatment sections
  const treatmentSection = content.match(/(?:TREATMENT|PRESCRIBING|Medications|Drugs).*?(?:\n|$)((?:\n?[•\-\d].*$)+)/mi);
  if (treatmentSection) {
    const lines = treatmentSection[1].split('\n').filter(l => l.trim());
    for (const line of lines) {
      const med = parseMedicationLine(line);
      if (med && !medications.find(m => m.name === med.name)) {
        medications.push(med);
      }
    }
  }

  return medications;
}

/**
 * Parse a single medication from regex match
 */
function parseMedicationMatch(match: RegExpExecArray, context: string): ParsedMedication | null {
  const fullMatch = match[0];
  
  // Extract drug name (usually the first part with capital letters)
  let name = '';
  const nameMatch = fullMatch.match(/^([A-Z][a-zA-Z\s]+?)(?:\s+\d)/);
  if (nameMatch) {
    name = nameMatch[1].trim();
  } else {
    // Try to find drug name from common list
    const commonDrugs = ['Paracetamol', 'Amoxicillin', 'Ibuprofen', 'Artemether', 'Lumefantrine', 'Coartem', 'Zinc', 'ORS', 'Vitamin A', 'Ceftriaxone', 'Azithromycin', 'Doxycycline', 'Metronidazole', 'Amlodipine', 'Lisinopril', 'Glibenclamide', 'Metformin', 'Insulin'];
    for (const drug of commonDrugs) {
      if (fullMatch.toLowerCase().includes(drug.toLowerCase())) {
        name = drug;
        break;
      }
    }
  }

  if (!name) return null;

  // Extract dosage
  const dosageMatch = fullMatch.match(/(\d+(?:\.\d+)?\s*(?:mg|g|ml|IU|tablet|tablets|capsule|capsules|amp|amps))/i);
  const dosage = dosageMatch ? dosageMatch[1] : '';

  // Extract frequency
  let frequency = '';
  const freqPatterns = [
    { pattern: /twice\s+daily|2\s*times\s*(?:a\s*)?day|bid/i, freq: 'Twice daily' },
    { pattern: /three\s*times|3\s*times|tid/i, freq: 'Three times daily' },
    { pattern: /four\s*times|4\s*times|qid/i, freq: 'Four times daily' },
    { pattern: /daily|once\s+daily|every\s+day|od|hs/i, freq: 'Once daily' },
    { pattern: /every\s+(\d+\s*)?hours?|q\d+h/i, freq: 'As scheduled' },
    { pattern: /as\s+needed|prn|when\s+needed/i, freq: 'As needed' }
  ];
  
  for (const { pattern, freq } of freqPatterns) {
    if (pattern.test(fullMatch)) {
      frequency = freq;
      break;
    }
  }

  // Extract duration
  let duration = '';
  const durationMatch = fullMatch.match(/(?:for?\s+)?(\d+\s*(?:days?|weeks?|months?|doses?))/i);
  if (durationMatch) {
    duration = durationMatch[1];
  }

  // Determine route
  let route = 'Oral';
  if (/iv|intravenous|injection|inj/i.test(fullMatch)) route = 'IV/Injection';
  else if (/im|intramuscular/i.test(fullMatch)) route = 'IM';
  else if (/sc|subcutaneous/i.test(fullMatch)) route = 'Subcutaneous';
  else if (/topical|cream|ointment/i.test(fullMatch)) route = 'Topical';
  else if (/eye|ear|nasal/i.test(fullMatch)) route = 'Local';

  // Extract notes if present
  let notes = '';
  const notesMatch = fullMatch.match(/\(([^)]+)\)|Note:\s*([^\n]+)/i);
  if (notesMatch) {
    notes = notesMatch[1] || notesMatch[2] || '';
  }

  return {
    name,
    dosage,
    frequency: frequency || 'As directed',
    duration: duration || '5 days',
    route,
    notes
  };
}

/**
 * Parse medication from a single line of text
 */
function parseMedicationLine(line: string): ParsedMedication | null {
  // Remove bullet points and numbers
  const cleanLine = line.replace(/^[•\-\d.\s]+/, '').trim();
  
  if (!cleanLine || cleanLine.length < 5) return null;

  // Try to extract drug name (capitalized words at start)
  const nameMatch = cleanLine.match(/^([A-Z][a-zA-Z\s]+?)(?:\s+\d|\s*\(|\s*-\s)/);
  if (!nameMatch) return null;

  const name = nameMatch[1].trim();
  
  // Extract dosage
  const dosageMatch = cleanLine.match(/(\d+(?:\.\d+)?\s*(?:mg|g|ml|IU|tablet|capsule|amp))/i);
  
  // Extract frequency
  let frequency = '';
  const freqMatch = cleanLine.match(/(twice daily|three times|four times|daily|once|every\s+\d+\s*hours?|as needed|prn)/i);
  if (freqMatch) frequency = freqMatch[1];

  // Extract duration
  const durationMatch = cleanLine.match(/(?:for\s+)?(\d+\s*(?:days?|weeks?|months?))/i);
  
  // Extract route
  let route = 'Oral';
  if (/iv|injection|inj/i.test(cleanLine)) route = 'IV/Injection';
  else if (/im/i.test(cleanLine)) route = 'IM';
  else if (/topical/i.test(cleanLine)) route = 'Topical';

  return {
    name,
    dosage: dosageMatch ? dosageMatch[1] : '',
    frequency: frequency || 'As directed',
    duration: durationMatch ? durationMatch[1] : '5 days',
    route,
    notes: ''
  };
}

/**
 * Check if AI response has actionable data
 */
export function hasActionableData(content: string): boolean {
  const parsed = parseAIResponse(content);
  return parsed.hasCompleteData;
}

/**
 * Format medications for display in apply buttons
 */
export function formatMedicationList(medications: ParsedMedication[]): string {
  if (medications.length === 0) return '';
  if (medications.length === 1) return medications[0].name;
  return `${medications[0].name} + ${medications.length - 1} more`;
}
