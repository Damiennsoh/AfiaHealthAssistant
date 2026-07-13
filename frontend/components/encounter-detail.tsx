"use client";

import { useEffect, useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Thermometer,
  HeartPulse,
  Wind,
  Weight,
  Ruler,
  Activity,
  User,
  Calendar,
  CheckCircle2,
  Clock,
  BotMessageSquare,
  Trash2,
  History as HistoryIcon,
  ChevronRight,
  TrendingUp,
  ArrowLeft,
  FileText,
  Printer,
  Home,
  Stethoscope,
  Plus,
  Bot,
  Folder,
  Pencil,
} from "lucide-react";
import { encounterDB, patientDB, generateId } from "@/lib/db";
import type { Encounter, Patient } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { DrugAdministrationSection } from "@/components/health/DrugAdministrationSection";
import { LabResultsSection } from "@/components/health/LabResultsSection";
import ReferralNote from "@/components/health/ReferralNote";
import ReferralExportButton from "@/components/health/ReferralExportButton";
import type { DrugAdministration, LabResult } from "@/lib/db";
import { generateReferralFromAI, type ReferralData } from "@/lib/referral-integration";
import { EditEncounterModal } from "./edit-encounter-modal";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AfiaAuthContext";

// Vital Item Component - Mobile-first card design
const VitalItem = ({ icon: Icon, label, value, unit, color }: any) => (
  <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
      <Icon className="h-5 w-5 text-white" />
    </div>
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="text-sm font-bold text-slate-800">
        {value || "--"} <span className="text-[10px] font-normal text-slate-400">{unit}</span>
      </p>
    </div>
  </div>
);

import { BackNavigation } from "@/components/ui/back-navigation";

export function EncounterDetail({ encounterId }: { encounterId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [history, setHistory] = useState<Encounter[]>([]);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [activeTab, setActiveTab] = useState("details");
  const [showEditModal, setShowEditModal] = useState(false);

  // Drug and lab results handlers
  const handleAddDrug = async (drug: DrugAdministration) => {
    if (!encounter) return;
    
    const updatedEncounter = {
      ...encounter,
      drugs: [...(encounter.drugs || []), drug],
      updatedAt: new Date().toISOString()
    };
    
    await encounterDB.save(updatedEncounter);
    setEncounter(updatedEncounter);
    toast.success("Medication added", {
      description: `${drug.drugName} ${drug.dosage} has been recorded`,
    });
  };

  const handleRemoveDrug = async (drugId: string) => {
    if (!encounter) return;
    
    const drugToRemove = encounter.drugs?.find(d => d.id === drugId);
    
    const updatedEncounter = {
      ...encounter,
      drugs: encounter.drugs?.filter(d => d.id !== drugId) || [],
      updatedAt: new Date().toISOString()
    };
    
    await encounterDB.save(updatedEncounter);
    setEncounter(updatedEncounter);
    toast.success("Medication removed", {
      description: drugToRemove ? `${drugToRemove.drugName} has been removed` : "Medication removed",
    });
  };

  const handleAddLabResult = async (result: LabResult) => {
    if (!encounter) return;
    
    const updatedEncounter = {
      ...encounter,
      labResults: [...(encounter.labResults || []), result],
      updatedAt: new Date().toISOString()
    };
    
    await encounterDB.save(updatedEncounter);
    setEncounter(updatedEncounter);
    toast.success("Lab result added", {
      description: `${result.testType}: ${result.result} ${result.unit}`,
    });
  };

  const handleRemoveLabResult = async (resultId: string) => {
    if (!encounter) return;
    
    const resultToRemove = encounter.labResults?.find(r => r.id === resultId);
    
    const updatedEncounter = {
      ...encounter,
      labResults: encounter.labResults?.filter(r => r.id !== resultId) || [],
      updatedAt: new Date().toISOString()
    };
    
    await encounterDB.save(updatedEncounter);
    setEncounter(updatedEncounter);
    toast.success("Lab result removed", {
      description: resultToRemove ? `${resultToRemove.testType} has been removed` : "Lab result removed",
    });
  };

  const handleComplete = async () => {
    if (!encounter) return;
    
    // Validate that diagnosis and treatment are present before completing
    const hasDiagnosis = encounter.diagnosis && encounter.diagnosis.trim() !== "";
    const hasTreatment = encounter.treatment && encounter.treatment.trim() !== "";
    const hasDrugs = encounter.drugs && encounter.drugs.length > 0;
    
    if (!hasDiagnosis) {
      toast.error("Please add a diagnosis before marking as complete", {
        description: "Use AI Assistant to get diagnosis recommendations"
      });
      return;
    }
    
    if (!hasTreatment && !hasDrugs) {
      toast.error("Please add treatment plan or medications before marking as complete", {
        description: "Use AI Assistant to get treatment recommendations"
      });
      return;
    }
    
    const updated = { 
      ...encounter, 
      status: "completed" as const, 
      updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString()
    };
    
    await encounterDB.save(updated);
    setEncounter(updated);
    
    toast.success("Encounter marked as complete", {
      description: hasDiagnosis && (hasTreatment || hasDrugs) 
        ? "Diagnosis and treatment recorded" 
        : "Encounter completed"
    });
    
    console.log('✅ [ENCOUNTER] Encounter completed:', {
      id: encounter.id,
      diagnosis: encounter.diagnosis,
      treatment: encounter.treatment,
      drugs: encounter.drugs?.length || 0
    });
  };

  const handleDelete = async () => {
    if (!encounter) return;
    await encounterDB.softDelete(encounterId, user?.id);
    toast.success("Encounter deleted");
    router.push("/encounters");
  };

  // Fetch encounter data
  const loadData = useCallback(async () => {
    try {
      const currentEnc = await encounterDB.getById(encounterId);
      if (currentEnc) {
        setEncounter(currentEnc);
        const [pat, allEncounters] = await Promise.all([
          patientDB.getById(currentEnc.patientId),
          encounterDB.getAll()
        ]);
        setPatient(pat || null);
        // Filter encounters for THIS patient only, excluding current one
        setHistory(
          allEncounters
            .filter(e => e.patientId === currentEnc.patientId && e.id !== encounterId)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        );
        
        // Load referral data if exists
        if ((currentEnc as any).referralData) {
          setReferralData((currentEnc as any).referralData);
        }
      }
      setLoading(false);
    } catch (error) {
      console.error("Failed to load encounter:", error);
      setLoading(false);
    }
  }, [encounterId]);

  useEffect(() => {
    loadData();
    
    // Subscribe to changes to handle background sync updates
    const unsubEncounter = encounterDB.subscribe(() => {
      console.log("Encounter updated in background, reloading...");
      loadData();
    });
    
    return () => {
      if (unsubEncounter) unsubEncounter();
    };
  }, [loadData]);

  // Handle AI apply URL parameter
  useEffect(() => {
    const applyParam = searchParams.get('apply');
    if (!applyParam || !encounter) return;

    async function applyAIData() {
      if (!applyParam || !encounter) return;
      
      try {
        const { type, structuredData, data, confidence, conflictResolution } = JSON.parse(decodeURIComponent(applyParam));
        
        console.log('🎯 [ENCOUNTER] Applying AI data:', type);
        console.log('🎯 [ENCOUNTER] Structured data:', structuredData);
        console.log('🎯 [ENCOUNTER] Confidence:', confidence);
        console.log('🎯 [ENCOUNTER] Conflict resolution:', conflictResolution);

        const updatedEncounter = { ...encounter };
        let appliedCount = 0;
        let conflictWarnings: string[] = [];
        
        // Support both new structured format and legacy format
        const aiData = structuredData || data;
        const primaryDiagnosis = structuredData?.primaryDiagnosis || data?.primary || '';
        const medications = structuredData?.medications || data?.medications || [];

        // Check for conflicts before applying
        if (conflictResolution?.hasExistingData) {
          if (type === 'diagnosis' || type === 'both') {
            if (conflictResolution.existingDiagnosis && primaryDiagnosis) {
              const similarity = getStringSimilarity(conflictResolution.existingDiagnosis, primaryDiagnosis);
              if (similarity > 0.8) {
                conflictWarnings.push('Similar diagnosis already exists');
              } else {
                conflictWarnings.push('Different diagnosis from existing manual entry');
              }
            }
          }
          
          if (type === 'drugs' || type === 'both') {
            if (conflictResolution.existingDrugs > 0) {
              conflictWarnings.push(`${conflictResolution.existingDrugs} existing drugs will be updated`);
            }
          }
        }

        // Show warnings if conflicts detected
        if (conflictWarnings.length > 0) {
          const proceed = confirm(`Potential conflicts detected:\n${conflictWarnings.join('\n')}\n\nDo you want to proceed?`);
          if (!proceed) {
            toast.info('Application cancelled by user');
            return;
          }
        }

        // Apply diagnosis with confidence tracking
        if ((type === 'diagnosis' || type === 'both') && primaryDiagnosis) {
          // Create unified diagnosis structure
          const unifiedDiagnosis = {
            id: generateId(),
            type: 'primary' as const,
            diagnosis: primaryDiagnosis,
            source: 'ai' as const,
            confidence: confidence || 0.8,
            createdAt: new Date().toISOString()
          };
          
          // Map AI findings to all relevant fields
          updatedEncounter.presentingComplaint = primaryDiagnosis; // Main complaint
          updatedEncounter.historyOfComplaint = structuredData?.clinicalNotes || ''; // Clinical notes as history
          updatedEncounter.diagnosis = primaryDiagnosis; // Keep for backward compatibility
          updatedEncounter.unifiedDiagnoses = [
            ...(updatedEncounter.unifiedDiagnoses || []),
            unifiedDiagnosis
          ];
          
          // Store all structured AI diagnosis data
          if (structuredData) {
            updatedEncounter.aiDiagnosisData = {
              primaryDiagnosis: structuredData.primaryDiagnosis,
              secondaryDiagnosis: structuredData.secondaryDiagnosis,
              treatmentPlan: structuredData.treatmentPlan,
              clinicalNotes: structuredData.clinicalNotes,
              followUpInstructions: structuredData.followUpInstructions,
              appliedAt: new Date().toISOString(),
              confidence: confidence || 0.8
            };
          }
          
          appliedCount++;
          console.log('✅ [ENCOUNTER] Applied diagnosis:', primaryDiagnosis);
        }

        // Apply medications with enhanced data
        if ((type === 'drugs' || type === 'both') && medications.length > 0) {
          for (const med of medications) {
            const drug: DrugAdministration = {
              id: generateId(),
              drugName: med.name,
              dosage: med.dosage,
              frequency: med.frequency,
              route: med.route,
              startDate: new Date().toISOString(),
              prescribedBy: 'AI Assistant',
              notes: `Duration: ${med.duration} | Confidence: ${Math.round((confidence || 0.8) * 100)}%`,
              createdAt: new Date().toISOString()
            };
            
            updatedEncounter.drugs = [...(updatedEncounter.drugs || []), drug];
            appliedCount++;
          }
          console.log('✅ [ENCOUNTER] Applied', medications.length, 'medications');
        }

        // Save updated encounter
        if (appliedCount > 0) {
          await encounterDB.save(updatedEncounter);
          setEncounter(updatedEncounter);
          
          toast.success('AI recommendations applied!', {
            description: `Applied ${appliedCount} item(s) with ${Math.round((confidence || 0.8) * 100)}% confidence`
          });

          // Clear URL parameter
          router.replace(`/encounters/${encounterId}`);
        }
      } catch (err) {
        console.error('❌ [ENCOUNTER] Failed to apply AI data:', err);
        toast.error('Failed to apply AI recommendations');
      }
    }

    // Helper function to calculate similarity between two strings
    function getStringSimilarity(str1: string, str2: string): number {
      const longer = str1.length > str2.length ? str1 : str2;
      const shorter = str1.length > str2.length ? str2 : str1;
      
      if (longer.length === 0) return 1.0;
      
      let editDistance = 0;
      for (let i = 0; i < shorter.length; i++) {
        if (str1[i] !== str2[i]) editDistance++;
      }
      return (longer.length - editDistance) / longer.length;
    }
  }, [searchParams, encounter, encounterId, router]);

  if (!encounter) {
    return (
      <div className="text-center py-10 px-4">
        <p className="text-muted-foreground">Encounter not found</p>
        <Button variant="outline" className="mt-2" onClick={() => router.push("/encounters")}>
          Back to Encounters
        </Button>
      </div>
    );
  }

  const v = encounter.vitals;

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-24 px-4 sm:px-0">
      {/* Mobile-first Navigation Bar */}
      <div className="flex items-center justify-between py-3">
        <BackNavigation 
          fallback="/encounters" 
          showQuickNav={true} 
          forceQuickNavMobile={true}
          size="icon"
          className="shrink-0"
        />

        {/* Quick Navigation Icons - Remaining buttons from original implementation if any */}
        <div className="flex flex-wrap items-center justify-end gap-1">
          {/* New Patient */}
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl hover:bg-slate-100 group relative"
          >
            <Link href="/patients?action=new" title="New Patient">
              <Plus className="h-5 w-5 text-slate-500 group-hover:text-emerald-600" />
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                New Patient
              </span>
            </Link>
          </Button>

          {/* AI Clinical Hub */}
          {encounterId && (
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-xl hover:bg-slate-100 group relative"
            >
              <Link href={`/ai-assistant?encounterId=${encounterId}`} title="AI Clinical Hub">
                <Bot className="h-5 w-5 text-slate-500 group-hover:text-emerald-600" />
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  AI Hub
                </span>
              </Link>
            </Button>
          )}

          {/* Patient Ledger */}
          {patient?.id && (
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-xl hover:bg-slate-100 group relative"
            >
              <Link href={`/patients/${patient.id}`} title="Patient Ledger">
                <Folder className="h-5 w-5 text-slate-500 group-hover:text-emerald-600" />
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  Ledger
                </span>
              </Link>
            </Button>
          )}

          {/* Delete */}
          {(user?.role === 'clinic_admin' || user?.role === 'super_admin') && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-10 w-10 rounded-xl hover:bg-rose-50 group relative"
                >
                  <Trash2 className="h-5 w-5 text-slate-400 group-hover:text-rose-500" />
                  <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    Delete
                  </span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Encounter</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this clinical encounter. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <Card className="overflow-hidden border-none shadow-xl ring-1 ring-slate-200">
        {/* Header */}
        <CardHeader className="bg-emerald-600 pb-8 pt-6 text-white">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 opacity-80" />
                <h2 className="text-xl font-bold tracking-tight">{patient?.name || "Unknown Patient"}</h2>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium opacity-90">
                <span>{patient?.age}Y • {patient?.sex}</span>
                {patient?.folderNumber && (
                  <span className="flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded">
                    <Folder className="h-3 w-3" />
                    {patient.folderNumber}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(encounter.date).toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
            </div>
            <Badge className="bg-white/20 text-white border-none backdrop-blur-md capitalize">
              {encounter.status}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="-mt-4 space-y-6 rounded-t-[24px] bg-white pt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="details" className="gap-2">
                <Activity className="h-4 w-4" /> Current
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <HistoryIcon className="h-4 w-4" /> History ({history.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-6">
              {/* Vitals Grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <VitalItem 
                  icon={Thermometer} 
                  label="Temp" 
                  value={v.temperature} 
                  unit="°C" 
                  color="bg-orange-500" 
                />
                <VitalItem 
                  icon={HeartPulse} 
                  label="BP" 
                  value={v.bloodPressureSystolic && v.bloodPressureDiastolic ? `${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}` : ""} 
                  unit="mmHg" 
                  color="bg-rose-500" 
                />
                <VitalItem 
                  icon={Activity} 
                  label="Pulse" 
                  value={v.pulse} 
                  unit="bpm" 
                  color="bg-blue-500" 
                />
                <VitalItem 
                  icon={Wind} 
                  label="Resp" 
                  value={v.respiratoryRate} 
                  unit="/min" 
                  color="bg-teal-500" 
                />
                <VitalItem 
                  icon={Weight} 
                  label="Weight" 
                  value={v.weight} 
                  unit="kg" 
                  color="bg-indigo-500" 
                />
                <VitalItem 
                  icon={Ruler} 
                  label="Height" 
                  value={v.height} 
                  unit="cm" 
                  color="bg-slate-500" 
                />
              </div>

              <div className="h-px bg-slate-100" />

              {/* Clinical Info - Mobile-first: labels muted, values high-contrast for quick scan */}
              <div className="space-y-4">
                {/* Presenting Complaints: presentingComplaint or symptoms */}
                {(encounter.presentingComplaint || (encounter.symptoms && encounter.symptoms.length > 0)) && (
                  <div className="border-l-2 border-emerald-500 pl-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Presenting Complaints</h4>
                    <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5">
                      {encounter.presentingComplaint ? (
                        <p className="text-sm font-semibold text-slate-900 leading-relaxed">{encounter.presentingComplaint}</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {encounter.symptoms!.map((s: string) => (
                            <Badge key={s} variant="secondary" className="bg-white text-slate-900 border-slate-300 text-sm font-semibold shadow-sm">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* History of Presenting Complaint: historyOfComplaint or history */}
                {(encounter.historyOfComplaint || encounter.history) && (
                  <div className="border-l-2 border-slate-300 pl-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">History of Presenting Complaint</h4>
                    <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5">
                      <p className="text-sm font-medium text-slate-900 leading-relaxed whitespace-pre-wrap">
                        {encounter.historyOfComplaint || encounter.history}
                      </p>
                    </div>
                  </div>
                )}

                {/* Primary Diagnosis - with AI/Manual source indicator */}
                {encounter.diagnosis && (
                  <div className="rounded-xl bg-emerald-50 p-4 border border-emerald-200">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Primary Diagnosis</h4>
                      {encounter.aiDiagnosisData ? (
                        <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50">
                          From AI
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] border-slate-300 text-slate-600 bg-white">
                          Manual
                        </Badge>
                      )}
                    </div>
                    <div className="rounded-lg bg-white border border-emerald-200 px-3 py-2.5">
                      <p className="text-base font-bold text-slate-900">{encounter.diagnosis}</p>
                    </div>
                  </div>
                )}

                {/* Treatment & Management Plan */}
                {encounter.treatment && (
                  <div className="rounded-xl bg-blue-50 p-4 border border-blue-200">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Treatment & Management Plan</h4>
                    <div className="rounded-lg bg-white border border-blue-200 px-3 py-2.5">
                      <p className="text-sm font-semibold text-slate-900 leading-relaxed whitespace-pre-wrap">
                        {encounter.treatment}
                      </p>
                    </div>
                  </div>
                )}

                {/* Backwards compatibility: show notes if no treatment */}
                {!encounter.treatment && encounter.notes && (
                  <div className="rounded-xl bg-amber-50 p-4 border border-amber-200">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Legacy Notes</h4>
                    <div className="rounded-lg bg-white border border-amber-200 px-3 py-2.5">
                      <p className="text-sm font-semibold text-slate-900 leading-relaxed whitespace-pre-wrap">
                        {encounter.notes}
                      </p>
                    </div>
                  </div>
                )}

                {/* Additional Notes (when treatment exists - notes are supplementary) */}
                {encounter.treatment && encounter.notes && (
                  <div className="border-l-2 border-slate-300 pl-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Additional Notes</h4>
                    <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5">
                      <p className="text-sm font-medium text-slate-900 leading-relaxed whitespace-pre-wrap">{encounter.notes}</p>
                    </div>
                  </div>
                )}

                {/* Manual Diagnosis Details */}
                {encounter.notes && encounter.notes.includes('Clinical Notes:') && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="h-4 w-4 text-blue-600" />
                      <h4 className="text-sm font-semibold text-blue-800">Manual Diagnosis Details</h4>
                    </div>
                    {(() => {
                      const notesMatch = encounter.notes.match(/Clinical Notes: ([\s\S]*?)(?=\nFollow-up:|$)/);
                      const followUpMatch = encounter.notes.match(/Follow-up: ([\s\S]*?)(?=\nBMI:|$)/);
                      
                      return (
                        <div className="space-y-3">
                          {notesMatch && notesMatch[1] && (
                            <div>
                              <h5 className="text-xs font-semibold text-blue-700 mb-1">Clinical Assessment</h5>
                              <p className="text-sm text-blue-900 leading-relaxed">{notesMatch[1].trim()}</p>
                            </div>
                          )}
                          
                          {followUpMatch && followUpMatch[1] && (
                            <div>
                              <h5 className="text-xs font-semibold text-blue-700 mb-1">Follow-up Instructions</h5>
                              <p className="text-sm text-blue-900 leading-relaxed">{followUpMatch[1].trim()}</p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Drug Administration */}
              <DrugAdministrationSection 
                drugs={encounter.drugs || []}
                onAddDrug={handleAddDrug}
                onRemoveDrug={handleRemoveDrug}
                readOnly={encounter.status === "completed"}
              />

              {/* Lab Results */}
              <LabResultsSection 
                labResults={encounter.labResults || []}
                onAddLabResult={handleAddLabResult}
                onRemoveLabResult={handleRemoveLabResult}
                readOnly={encounter.status === "completed"}
              />

              {/* Action Buttons */}
              <div className="space-y-3 pt-4">
                {encounter.status === "in-progress" && (
                  <Button 
                    onClick={handleComplete}
                    className="w-full gap-2 rounded-xl h-14 font-bold bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100"
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    Mark Complete
                  </Button>
                )}
                
                <Button 
                  asChild
                  variant="outline" 
                  className="w-full gap-2 rounded-xl h-12 font-medium"
                >
                  <Link href={`/ai-assistant?encounterId=${encounterId}`}>
                    <BotMessageSquare className="h-5 w-5" />
                    Request AI Consult
                  </Link>
                </Button>

                <Button 
                  variant="outline" 
                  className="w-full gap-2 rounded-xl h-12 font-medium"
                  onClick={() => setShowEditModal(true)}
                >
                  <Pencil className="h-5 w-5" />
                  Edit Encounter
                </Button>

                {referralData && (
                  <Button 
                    variant="outline" 
                    className="w-full gap-2 rounded-xl h-12 font-medium"
                    onClick={() => window.print()}
                  >
                    <Printer className="h-5 w-5" />
                    Print Referral
                  </Button>
                )}

                <Button 
                  asChild
                  variant="ghost" 
                  className="w-full gap-2 rounded-xl h-12 font-medium"
                >
                  <Link href={`/patients/${patient?.id}`}>
                    <User className="h-5 w-5" />
                    View Patient Profile
                  </Link>
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              {history.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <HistoryIcon className="h-10 w-10 mx-auto opacity-20 mb-2" />
                  <p className="text-sm">No previous encounters found.</p>
                </div>
              ) : (
                <div className="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-slate-100">
                  {history.map((prev) => (
                    <div key={prev.id} className="relative flex items-start gap-4 pl-10">
                      <div className="absolute left-0 mt-1 flex h-10 w-10 items-center justify-center rounded-full border bg-white shadow-sm">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      </div>
                      <div className="flex-1 rounded-2xl border bg-white p-4 shadow-sm hover:border-emerald-200 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">
                            {new Date(prev.createdAt).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                            <TrendingUp className="h-3 w-3" /> 
                            BP: {prev.vitals?.bloodPressureSystolic && prev.vitals?.bloodPressureDiastolic 
                              ? `${prev.vitals.bloodPressureSystolic}/${prev.vitals.bloodPressureDiastolic}` 
                              : 'N/A'}
                          </div>
                        </div>
                        <h5 className="text-sm font-bold text-slate-800 mb-1">{prev.diagnosis || "No diagnosis recorded"}</h5>
                        <p className="text-xs text-slate-500 line-clamp-2">{prev.treatment || "No treatment recorded"}</p>
                        {prev.drugs && prev.drugs.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {prev.drugs.map((drug, idx) => (
                              <Badge key={idx} variant="outline" className="text-[10px]">
                                {drug.drugName}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      {/* Edit Encounter Modal */}
      <EditEncounterModal
        encounter={encounter}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSaved={loadData}
      />
    </div>
  );
}
