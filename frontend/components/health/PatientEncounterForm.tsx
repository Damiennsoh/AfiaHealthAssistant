"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner";
import { 
  ArrowLeft, 
  Bot, 
  FileText, 
  Search, 
  Activity, 
  Thermometer,
  HeartPulse,
  Wind,
  Weight,
  Ruler,
  CheckCircle2,
  Microscope,
  Stethoscope
} from "lucide-react";
import { encounterDB, generateId, patientDB } from "@/lib/db";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PatientLookup } from "./PatientLookup";
import { useVitalAlerts } from "@/hooks/use-vital-alerts";
import { useClinicalReferralAnalyzer } from "@/hooks/use-clinical-referral-analyzer";
import { VitalAlerts } from "./VitalAlerts";
import { ReferralModal } from "./ReferralModal";
import { BackNavigation } from "@/components/ui/back-navigation";
import { useSync } from "@/contexts/SyncContext";

export default function PatientEncounterForm() {
  const router = useRouter();
  const { syncToCloud } = useSync();
  const searchParams = useSearchParams();
  const preselected = searchParams.get("patientId") || "";
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(preselected);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [referralModalOpen, setReferralModalOpen] = useState(false);

  // Shared form state that persists across tabs
  const [formData, setFormData] = useState({
    vitals: {
      temperature: "",
      bloodPressureSystolic: "",
      bloodPressureDiastolic: "",
      pulse: "",
      respiratoryRate: "",
      weight: "",
      height: "",
      spO2: "",
    },
    complaint: "",
    rdt: "not_done",
    // Manual diagnosis fields
    diagnosisMode: "ai" as "ai" | "manual",
    primaryDiagnosis: "",
    secondaryDiagnosis: "",
    treatmentPlan: "",
    clinicalNotes: "",
    followUpInstructions: ""
  });

  // Handle patient selection from lookup
  const handlePatientSelect = (patient: any) => {
    setSelectedPatientId(patient.id);
    setSelectedPatient(patient);
    toast.success(`Selected: ${patient.name} (${patient.folderNumber})`);
  };

  // BMI logic with categorization
  const getBMICategory = useCallback((bmi: number) => {
    if (bmi < 18.5) return { category: 'underweight', color: 'text-blue-600', label: 'Underweight' };
    if (bmi < 25) return { category: 'normal', color: 'text-green-600', label: 'Normal Weight' };
    if (bmi < 30) return { category: 'overweight', color: 'text-amber-600', label: 'Overweight' };
    return { category: 'obese', color: 'text-red-600', label: 'Obese' };
  }, []);

  const calculateBMI = useCallback((weight: number, heightCm: number) => {
    if (!weight || !heightCm) return { value: 0.0, ...getBMICategory(0) };
    const heightM = heightCm / 100;
    const bmiValue = parseFloat((weight / (heightM * heightM)).toFixed(1));
    return { value: bmiValue, ...getBMICategory(bmiValue) };
  }, [getBMICategory]);

  // Reactive BMI calculation
  const [bmiData, setBmiData] = useState(() => 
    calculateBMI(
      parseFloat(formData.vitals.weight) || 0,
      parseFloat(formData.vitals.height) || 0
    )
  );

  useEffect(() => {
    const weight = parseFloat(formData.vitals.weight) || 0;
    const height = parseFloat(formData.vitals.height) || 0;
    setBmiData(calculateBMI(weight, height));
  }, [formData.vitals.weight, formData.vitals.height, calculateBMI]);

  // Vital alerts monitoring
  const { 
    alerts, 
    referralTriggers, 
    hasCriticalAlerts, 
    hasReferralTriggers,
    clearAlerts 
  } = useVitalAlerts(formData.vitals);

  // Clinical text referral analysis (for keywords like "profuse bleeding", "severe pain", etc.)
  const {
    clinicalTriggers,
    clinicalAlerts,
    hasClinicalReferralTriggers,
  } = useClinicalReferralAnalyzer(formData.complaint, {
    enabled: true,
    patientPregnant: false, // Could be derived from patient data if available
  });

  // Combined alerts and triggers
  const combinedAlerts = [...alerts, ...clinicalAlerts];
  const combinedTriggers = [...referralTriggers, ...clinicalTriggers];
  const hasAnyCriticalAlerts = hasCriticalAlerts || clinicalAlerts.some(a => a.severity === 'critical');
  const hasAnyReferralTriggers = hasReferralTriggers || hasClinicalReferralTriggers;

  // Handle referral trigger - open modal with auto-populated data
  const handleReferralTrigger = (triggers: any[]) => {
    if (!selectedPatient) {
      toast.error("Please select a patient first");
      return;
    }
    if (triggers.length === 0) {
      toast.error("No referral triggers detected");
      return;
    }
    setReferralModalOpen(true);
  };

  // Auto-popup referral modal when critical conditions detected
  useEffect(() => {
    if (hasAnyReferralTriggers && selectedPatient && !referralModalOpen) {
      // Auto-trigger the referral modal when critical vitals or clinical keywords are detected
      const timer = setTimeout(() => {
        toast.warning("Critical condition detected - Referral required", {
          duration: 5000,
          action: {
            label: "View Referral",
            onClick: () => setReferralModalOpen(true),
          },
        });
      }, 500); // Small delay to let user see the vital alerts first
      return () => clearTimeout(timer);
    }
  }, [hasAnyReferralTriggers, selectedPatient, referralModalOpen]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!selectedPatientId) {
      toast.error("Please select a patient or open this form with ?patientId=...");
      return;
    }

    const fd = new FormData(e.currentTarget);
    
    // Fix: Prioritize state values, fallback to FormData, then default to 0
    const weightVal = formData.vitals.weight || (fd.get("weight") as string) || "0";
    const heightVal = formData.vitals.height || (fd.get("height") as string) || "0";
    
    const weight = parseFloat(weightVal);
    const height = parseFloat(heightVal);
    
    const temp = formData.vitals.temperature || (fd.get("temp") as string) || "";
    const bp = formData.vitals.bloodPressureSystolic && formData.vitals.bloodPressureDiastolic 
      ? `${formData.vitals.bloodPressureSystolic}/${formData.vitals.bloodPressureDiastolic}`
      : (fd.get("bp") as string) || "";
    const complaint = formData.complaint || (fd.get("complaint") as string) || "";
    const rdt = formData.rdt || (fd.get("rdt") as string) || "not_done";
    const diagnosisMode = formData.diagnosisMode;
    const primaryDiagnosis = formData.primaryDiagnosis || (fd.get("primaryDiagnosis") as string) || "";
    const secondaryDiagnosis = formData.secondaryDiagnosis || (fd.get("secondaryDiagnosis") as string) || "";
    const treatmentPlan = formData.treatmentPlan || (fd.get("treatmentPlan") as string) || "";
    const clinicalNotes = formData.clinicalNotes || (fd.get("clinicalNotes") as string) || "";
    const followUpInstructions = formData.followUpInstructions || (fd.get("followUpInstructions") as string) || "";

    const now = new Date().toISOString();
    const encounter = {
      id: generateId(),
      patientId: selectedPatientId,
      date: now,
      vitals: {
        temperature: temp,
        bloodPressureSystolic: formData.vitals.bloodPressureSystolic || bp.split("/")[0] || "",
        bloodPressureDiastolic: formData.vitals.bloodPressureDiastolic || bp.split("/")[1] || "",
        pulse: formData.vitals.pulse || "",
        respiratoryRate: formData.vitals.respiratoryRate || "",
        weight: Number.isFinite(weight) ? String(weight) : formData.vitals.weight || "",
        height: Number.isFinite(height) ? String(height) : formData.vitals.height || "",
        spO2: formData.vitals.spO2 || "",
      },
      symptoms: complaint ? complaint.split(/,|;|\.|\n/).map(s=>s.trim()).filter(Boolean) : [],
      history: complaint,
      diagnosis: diagnosisMode === "manual" ? primaryDiagnosis : (rdt === "positive" ? "Suspected Malaria (RDT +)" : ""),
      treatment: diagnosisMode === "manual" ? treatmentPlan : "",
      drugs: [], // Initialize empty drugs array
      labResults: [], // Initialize empty lab results array
      notes: diagnosisMode === "manual" 
        ? `Clinical Notes: ${clinicalNotes}\nFollow-up: ${followUpInstructions}\nBMI: ${bmiData.value} (${bmiData.label}) | RDT: ${rdt}`
        : `BMI: ${bmiData.value} (${bmiData.label}) | RDT: ${rdt}`,
      status: "in-progress",
      createdAt: now,
      updatedAt: now,
      // New enhanced fields
      bmi: {
        value: bmiData.value,
        category: bmiData.category,
        label: bmiData.label,
        calculatedAt: now
      },
      vitalAlerts: alerts.length > 0 ? alerts : undefined,
      referralTriggers: referralTriggers.length > 0 ? referralTriggers : undefined,
    };

    try {
      await encounterDB.save(encounter as any);
      
      // Proactively trigger cloud sync if online
      if (syncToCloud) {
        syncToCloud().catch((err: unknown) => console.error("Immediate sync failed:", err));
      }
      
      toast.success("Encounter saved locally. Opening Afia Assistant...");
      // Navigate based on diagnosis mode
      if (diagnosisMode === "ai") {
        // navigate to AI assistant with encounter context
        router.push(`/ai-assistant?encounterId=${encounter.id}`);
      } else {
        // Navigate to encounter detail page for manual diagnosis
        router.push(`/encounters/${encounter.id}`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to save encounter");
    }
  };

  useEffect(() => {
    let mounted = true;
    patientDB.getAll().then((list) => {
      if (!mounted) return;
      setPatients(list);
    }).catch(() => {});
    return () => { mounted = false };
  }, []);

  // Fix: Automatically select patient object when ID is present and patients are loaded
  useEffect(() => {
    if (selectedPatientId && !selectedPatient && patients.length > 0) {
      const found = patients.find(p => p.id === selectedPatientId);
      if (found) {
        setSelectedPatient(found);
      }
    }
  }, [selectedPatientId, selectedPatient, patients]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-24 px-4 sm:px-0">
      {/* Header */}
      <Card className="overflow-hidden border-none shadow-xl ring-1 ring-slate-200">
        <CardHeader className="bg-emerald-600 pb-8 pt-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BackNavigation 
                fallback="/encounters" 
                size="icon" 
                variant="secondary"
                className="bg-white/10 text-white border-none backdrop-blur-md rounded-full"
              />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5 opacity-80" />
                  <h2 className="text-xl font-bold tracking-tight">New Encounter: OPD</h2>
                </div>
                <p className="text-xs font-medium opacity-90">v2.0 GHS-Compliant</p>
              </div>
            </div>
            <Badge className="bg-white/20 text-white border-none backdrop-blur-md">
              New
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="-mt-4 space-y-6 rounded-t-[24px] bg-white pt-6">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Patient selector */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-slate-700">Patient</label>
                <PatientLookup 
                  onPatientSelect={handlePatientSelect}
                  trigger={
                    <Button variant="outline" size="sm" className="gap-2 rounded-lg">
                      <Search className="h-4 w-4" />
                      Find Patient
                    </Button>
                  }
                />
              </div>
              
              {selectedPatient && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                        <span className="text-emerald-700 font-bold text-sm">
                          {selectedPatient.name?.charAt(0)?.toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-emerald-800">{selectedPatient.name}</p>
                        <p className="text-xs text-emerald-600">
                          {selectedPatient.folderNumber} • {selectedPatient.age}yrs • {selectedPatient.locality}
                          {selectedPatient.hasNHIS && ` • NHIS: ${selectedPatient.nhisNumber}`}
                        </p>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => {
                        setSelectedPatientId("");
                        setSelectedPatient(null);
                      }}
                      className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-100"
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              )}
              
              {!selectedPatient && (
                <div className="mt-2">
                  <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
                    <SelectTrigger className="h-12 text-base rounded-xl border-2 border-slate-200 focus:border-emerald-500">
                      <SelectValue placeholder="Select a patient" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {patients.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="rounded-lg">
                          {p.name} — {p.locality} ({p.age}yrs)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <Tabs defaultValue="vitals" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6 h-12 bg-slate-100 p-1">
                <TabsTrigger value="vitals" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <Activity className="h-4 w-4" /> Vitals
                </TabsTrigger>
                <TabsTrigger value="clinical" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <Stethoscope className="h-4 w-4" /> Clinical
                </TabsTrigger>
                <TabsTrigger value="labs" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <Microscope className="h-4 w-4" /> Labs / RDT
                </TabsTrigger>
              </TabsList>

              {/* Diagnosis Mode Selection */}
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <label className="text-sm font-semibold text-amber-800 mb-3 block">Diagnosis Mode</label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg bg-white border border-amber-200 hover:border-emerald-300 transition-colors">
                    <input 
                      type="radio" 
                      name="diagnosisMode" 
                      value="ai"
                      checked={formData.diagnosisMode === "ai"}
                      onChange={(e) => setFormData({ ...formData, diagnosisMode: e.target.value as "ai" | "manual" })}
                      className="text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                    />
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Bot className="h-4 w-4 text-emerald-600" />
                      AI Assistant (Online)
                    </span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg bg-white border border-amber-200 hover:border-emerald-300 transition-colors">
                    <input 
                      type="radio" 
                      name="diagnosisMode" 
                      value="manual"
                      checked={formData.diagnosisMode === "manual"}
                      onChange={(e) => setFormData({ ...formData, diagnosisMode: e.target.value as "ai" | "manual" })}
                      className="text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                    />
                    <span className="text-sm font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4 text-slate-600" />
                      Manual Diagnosis (Offline)
                    </span>
                  </label>
                </div>
                {formData.diagnosisMode === "manual" && (
                  <p className="text-xs text-amber-700 mt-3">
                    Complete the encounter without internet connection. All data will be saved locally.
                  </p>
                )}
              </div>

              {/* Section 1: Vitals - The core data for AI triage */}
              <TabsContent value="vitals" className="space-y-4">
                {/* Vital Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Temperature */}
                  <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500 shrink-0">
                      <Thermometer className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Temp</label>
                      <div className="flex items-center gap-1">
                        <input 
                          type="number" 
                          step="0.1" 
                          placeholder="37.0"
                          value={formData.vitals.temperature}
                          onChange={(e) => setFormData({
                            ...formData,
                            vitals: { ...formData.vitals, temperature: e.target.value }
                          })}
                          className="w-20 p-1 text-sm font-bold text-slate-800 border-b-2 border-slate-200 focus:border-emerald-500 outline-none bg-transparent" 
                        />
                        <span className="text-[10px] text-slate-400">°C</span>
                      </div>
                    </div>
                  </div>

                  {/* BP - Fixed proportions */}
                  <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500 shrink-0">
                      <HeartPulse className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">BP</label>
                      <div className="flex items-center gap-1">
                        <input 
                          name="bp_sys"
                          type="number"
                          placeholder="120"
                          value={formData.vitals.bloodPressureSystolic}
                          onChange={(e) => setFormData({
                            ...formData,
                            vitals: { ...formData.vitals, bloodPressureSystolic: e.target.value }
                          })}
                          className="w-12 p-1 text-sm font-bold text-slate-800 border-b-2 border-slate-200 focus:border-emerald-500 outline-none bg-transparent" 
                        />
                        <span className="text-slate-400 font-bold">/</span>
                        <input 
                          type="number"
                          placeholder="80"
                          value={formData.vitals.bloodPressureDiastolic}
                          onChange={(e) => setFormData({
                            ...formData,
                            vitals: { ...formData.vitals, bloodPressureDiastolic: e.target.value }
                          })}
                          className="w-12 p-1 text-sm font-bold text-slate-800 border-b-2 border-slate-200 focus:border-emerald-500 outline-none bg-transparent" 
                        />
                        <span className="text-[10px] text-slate-400 ml-1">mmHg</span>
                      </div>
                    </div>
                  </div>

                  {/* Pulse */}
                  <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500 shrink-0">
                      <Activity className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Pulse</label>
                      <div className="flex items-center gap-1">
                        <input 
                          type="number"
                          placeholder="72"
                          value={formData.vitals.pulse}
                          onChange={(e) => setFormData({
                            ...formData,
                            vitals: { ...formData.vitals, pulse: e.target.value }
                          })}
                          className="w-16 p-1 text-sm font-bold text-slate-800 border-b-2 border-slate-200 focus:border-emerald-500 outline-none bg-transparent" 
                        />
                        <span className="text-[10px] text-slate-400">bpm</span>
                      </div>
                    </div>
                  </div>

                  {/* Respiratory Rate */}
                  <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500 shrink-0">
                      <Wind className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Resp</label>
                      <div className="flex items-center gap-1">
                        <input 
                          name="resp"
                          type="number"
                          placeholder="18"
                          value={formData.vitals.respiratoryRate}
                          onChange={(e) => setFormData({
                            ...formData,
                            vitals: { ...formData.vitals, respiratoryRate: e.target.value }
                          })}
                          className="w-12 p-1 text-sm font-bold text-slate-800 border-b-2 border-slate-200 focus:border-emerald-500 outline-none bg-transparent" 
                        />
                        <span className="text-[10px] text-slate-400">/min</span>
                      </div>
                    </div>
                  </div>

                  {/* Weight */}
                  <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500 shrink-0">
                      <Weight className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Weight</label>
                      <div className="flex items-center gap-1">
                        <input 
                          type="number" 
                          step="0.1"
                          placeholder="0"
                          value={formData.vitals.weight}
                          onChange={(e) => setFormData({
                            ...formData,
                            vitals: { ...formData.vitals, weight: e.target.value }
                          })}
                          className="w-16 p-1 text-sm font-bold text-slate-800 border-b-2 border-slate-200 focus:border-emerald-500 outline-none bg-transparent" 
                        />
                        <span className="text-[10px] text-slate-400">kg</span>
                      </div>
                    </div>
                  </div>

                  {/* Height */}
                  <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-500 shrink-0">
                      <Ruler className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Height</label>
                      <div className="flex items-center gap-1">
                        <input 
                          name="height"
                          type="number"
                          placeholder="0"
                          value={formData.vitals.height}
                          onChange={(e) => setFormData({
                            ...formData,
                            vitals: { ...formData.vitals, height: e.target.value }
                          })}
                          className="w-16 p-1 text-sm font-bold text-slate-800 border-b-2 border-slate-200 focus:border-emerald-500 outline-none bg-transparent" 
                        />
                        <span className="text-[10px] text-slate-400">cm</span>
                      </div>
                    </div>
                  </div>

                  {/* SpO2 - Full width */}
                  <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:col-span-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500 shrink-0">
                      <CheckCircle2 className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">SpO2</label>
                      <div className="flex items-center gap-1">
                        <input 
                          name="spo2"
                          type="number"
                          placeholder="98"
                          value={formData.vitals.spO2}
                          onChange={(e) => setFormData({
                            ...formData,
                            vitals: { ...formData.vitals, spO2: e.target.value }
                          })}
                          className="w-16 p-1 text-sm font-bold text-slate-800 border-b-2 border-slate-200 focus:border-emerald-500 outline-none bg-transparent" 
                        />
                        <span className="text-[10px] text-slate-400">%</span>
                      </div>
                    </div>
                  </div>

                  {/* BMI - Auto-calculated */}
                  {(formData.vitals.weight && formData.vitals.height) && (
                    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:col-span-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500 shrink-0">
                        <Activity className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">BMI</label>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-slate-800">{bmiData.value}</span>
                          <span className={`text-xs font-medium px-2 py-1 rounded-full bg-opacity-10 ${bmiData.color.replace('text-', 'bg-')}`}>
                            {bmiData.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Vital Alerts Section */}
              {(hasAnyCriticalAlerts || hasAnyReferralTriggers) && (
                <div className="space-y-4">
                  <VitalAlerts
                    alerts={combinedAlerts}
                    referralTriggers={combinedTriggers}
                    onClearAlerts={clearAlerts}
                    onTriggerReferral={handleReferralTrigger}
                  />
                </div>
              )}

              {/* Section 2: Clinical Narrative */}
              <TabsContent value="clinical" className="space-y-4">
                <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                    <Stethoscope className="inline h-3 w-3 mr-1" />
                    Presenting Complaint
                  </label>
                  <textarea 
                    rows={4} 
                    placeholder="e.g. Fever and chills for 3 days..."
                    value={formData.complaint}
                    onChange={(e) => setFormData({ ...formData, complaint: e.target.value })}
                    className="w-full p-3 rounded-lg border-2 border-slate-200 focus:border-emerald-500 outline-none text-sm" 
                  />
                </div>
                
                {/* Vitals Summary Card */}
                {Object.values(formData.vitals).some(v => v) && (
                  <div className="rounded-xl bg-emerald-50 p-4 border border-emerald-100">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-3">Current Vitals Summary</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      {formData.vitals.temperature && (
                        <div className="flex items-center gap-1">
                          <Thermometer className="h-3 w-3 text-orange-500" />
                          <span className="text-slate-600">{formData.vitals.temperature}°C</span>
                        </div>
                      )}
                      {formData.vitals.bloodPressureSystolic && formData.vitals.bloodPressureDiastolic && (
                        <div className="flex items-center gap-1">
                          <HeartPulse className="h-3 w-3 text-rose-500" />
                          <span className="text-slate-600">{formData.vitals.bloodPressureSystolic}/{formData.vitals.bloodPressureDiastolic}</span>
                        </div>
                      )}
                      {formData.vitals.pulse && (
                        <div className="flex items-center gap-1">
                          <Activity className="h-3 w-3 text-blue-500" />
                          <span className="text-slate-600">{formData.vitals.pulse}bpm</span>
                        </div>
                      )}
                      {formData.vitals.weight && (
                        <div className="flex items-center gap-1">
                          <Weight className="h-3 w-3 text-indigo-500" />
                          <span className="text-slate-600">{formData.vitals.weight}kg</span>
                        </div>
                      )}
                      {formData.vitals.height && (
                        <div className="flex items-center gap-1">
                          <Ruler className="h-3 w-3 text-slate-500" />
                          <span className="text-slate-600">{formData.vitals.height}cm</span>
                        </div>
                      )}
                      {formData.vitals.spO2 && (
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-cyan-500" />
                          <span className="text-slate-600">{formData.vitals.spO2}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Section 3: Diagnostic Data */}
              <TabsContent value="labs" className="space-y-4">
                {/* RDT Protocol Card */}
                <div className="rounded-xl bg-amber-50 p-4 border border-amber-200">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800 mb-3">Malaria Protocol (RDT)</p>
                  <div className="flex flex-wrap gap-3">
                    <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg bg-white border border-amber-200 hover:border-amber-400 transition-colors">
                      <input 
                        type="radio" 
                        name="rdt" 
                        value="positive" 
                        checked={formData.rdt === "positive"}
                        onChange={(e) => setFormData({ ...formData, rdt: e.target.value })}
                        className="text-emerald-600 h-4 w-4"
                      /> 
                      <span className="text-sm font-medium">Positive</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg bg-white border border-amber-200 hover:border-amber-400 transition-colors">
                      <input 
                        type="radio" 
                        name="rdt" 
                        value="negative" 
                        checked={formData.rdt === "negative"}
                        onChange={(e) => setFormData({ ...formData, rdt: e.target.value })}
                        className="text-emerald-600 h-4 w-4"
                      /> 
                      <span className="text-sm font-medium">Negative</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg bg-white border border-amber-200 hover:border-amber-400 transition-colors">
                      <input 
                        type="radio" 
                        name="rdt" 
                        value="not_done" 
                        checked={formData.rdt === "not_done"}
                        onChange={(e) => setFormData({ ...formData, rdt: e.target.value })}
                        className="text-emerald-600 h-4 w-4"
                      /> 
                      <span className="text-sm font-medium">Not Done</span>
                    </label>
                  </div>
                </div>
                
                {/* Manual Diagnosis Section */}
                {formData.diagnosisMode === "manual" && (
                  <div className="space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="text-sm font-bold text-blue-800 mb-3">Manual Diagnosis</h4>
                    
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-blue-700">Primary Diagnosis *</label>
                        <input 
                          type="text"
                          name="primaryDiagnosis"
                          placeholder="e.g. Uncomplicated Malaria, Typhoid Fever"
                          value={formData.primaryDiagnosis}
                          onChange={(e) => setFormData({ ...formData, primaryDiagnosis: e.target.value })}
                          className="w-full p-3 rounded-lg border border-blue-200 focus:border-blue-500 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-blue-700">Secondary Diagnosis (Optional)</label>
                        <input 
                          type="text"
                          name="secondaryDiagnosis"
                          placeholder="e.g. Dehydration, Anemia"
                          value={formData.secondaryDiagnosis}
                          onChange={(e) => setFormData({ ...formData, secondaryDiagnosis: e.target.value })}
                          className="w-full p-3 rounded-lg border border-blue-200 focus:border-blue-500 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-blue-700">Treatment Plan *</label>
                        <textarea 
                          name="treatmentPlan"
                          rows={3}
                          placeholder="Medications, dosages, and duration..."
                          value={formData.treatmentPlan}
                          onChange={(e) => setFormData({ ...formData, treatmentPlan: e.target.value })}
                          className="w-full p-3 rounded-lg border border-blue-200 focus:border-blue-500 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-blue-700">Clinical Notes</label>
                        <textarea 
                          name="clinicalNotes"
                          rows={4}
                          placeholder="Detailed clinical assessment and findings..."
                          value={formData.clinicalNotes}
                          onChange={(e) => setFormData({ ...formData, clinicalNotes: e.target.value })}
                          className="w-full p-3 rounded-lg border border-blue-200 focus:border-blue-500 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-blue-700">Follow-up Instructions</label>
                        <textarea 
                          name="followUpInstructions"
                          rows={2}
                          placeholder="Return for follow-up in... Warning signs..."
                          value={formData.followUpInstructions}
                          onChange={(e) => setFormData({ ...formData, followUpInstructions: e.target.value })}
                          className="w-full p-3 rounded-lg border border-blue-200 focus:border-blue-500 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Show clinical summary for reference */}
                {formData.complaint && (
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-xs font-bold text-green-800 mb-1">Clinical Notes</p>
                    <p className="text-xs text-green-700">{formData.complaint}</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <Button 
              type="submit" 
              className="w-full gap-2 rounded-xl h-14 font-bold bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100 text-base"
            >
              {formData.diagnosisMode === "ai" ? (
                <>
                  <Bot className="h-5 w-5" />
                  Analyze with Afia Assistant
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  Save Manual Diagnosis
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Referral Modal - Auto-popup for critical conditions */}
      <ReferralModal
        isOpen={referralModalOpen}
        onClose={() => setReferralModalOpen(false)}
        patient={selectedPatient}
        triggers={combinedTriggers}
        alerts={combinedAlerts}
        encounterData={{
          complaint: formData.complaint,
          history: formData.complaint,
          vitals: formData.vitals,
          treatment: formData.treatmentPlan,
          diagnosis: formData.primaryDiagnosis,
        }}
      />
    </div>
  );
}
