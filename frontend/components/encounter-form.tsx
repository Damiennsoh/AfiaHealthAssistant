"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Thermometer,
  HeartPulse,
  Wind,
  Weight,
  Ruler,
  Activity,
  Save,
  CheckCircle2,
  User,
  Stethoscope,
  Bot,
  FileText,
  Clipboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { patientDB, encounterDB, generateId } from "@/lib/db";
import type { Patient, Encounter } from "@/lib/db";
import { toast } from "sonner";

const COMMON_SYMPTOMS = [
  "Fever",
  "Headache",
  "Cough",
  "Body pains",
  "Diarrhea",
  "Vomiting",
  "Abdominal pain",
  "Chest pain",
  "Fatigue",
  "Loss of appetite",
  "Dizziness",
  "Difficulty breathing",
  "Joint pain",
  "Skin rash",
  "Chills/rigors",
  "Sore throat",
  "Frequent urination",
  "Swelling",
  "Bleeding",
  "Convulsions",
];

export function EncounterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedPatientId = searchParams.get("patientId") || "";

  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState(preselectedPatientId);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);

  const [vitals, setVitals] = useState({
    temperature: "",
    bloodPressureSystolic: "",
    bloodPressureDiastolic: "",
    pulse: "",
    respiratoryRate: "",
    weight: "",
    height: "",
    spO2: "",
  });

  const [history, setHistory] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [treatment, setTreatment] = useState("");
  const [notes, setNotes] = useState("");
  
  // Manual diagnosis state
  const [diagnosisMode, setDiagnosisMode] = useState<"ai" | "manual">("ai");
  const [secondaryDiagnosis, setSecondaryDiagnosis] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [followUpInstructions, setFollowUpInstructions] = useState("");

  useEffect(() => {
    patientDB.getAll().then(setPatients).catch(() => {});
  }, []);

  const toggleSymptom = (symptom: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(symptom)
        ? prev.filter((s) => s !== symptom)
        : [...prev, symptom]
    );
  };

  const handleSave = async (status: "in-progress" | "completed") => {
    if (!selectedPatientId) {
      toast.error("Please select a patient");
      return;
    }

    const now = new Date().toISOString();
    
    // Build notes based on diagnosis mode
    let encounterNotes = notes;
    if (diagnosisMode === "manual") {
      const manualNotes = [];
      if (clinicalNotes) manualNotes.push(`Clinical Notes: ${clinicalNotes}`);
      if (followUpInstructions) manualNotes.push(`Follow-up: ${followUpInstructions}`);
      if (manualNotes.length > 0) {
        encounterNotes = manualNotes.join("\n") + (notes ? `\n${notes}` : "");
      }
    }
    
    const encounter: Encounter = {
      id: generateId(),
      patientId: selectedPatientId,
      date: now,
      vitals,
      symptoms: selectedSymptoms,
      history,
      diagnosis: diagnosisMode === "manual" ? diagnosis : diagnosis,
      treatment: diagnosisMode === "manual" ? treatment : treatment,
      drugs: [],
      labResults: [],
      notes: encounterNotes,
      status,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await encounterDB.save(encounter);
      toast.success(
        status === "completed"
          ? "Encounter saved and completed"
          : "Encounter saved as draft",
        {
          description: "Clinical record has been stored locally",
        }
      );
      router.push(diagnosisMode === "ai" ? `/ai-assistant?encounterId=${encounter.id}` : `/encounters/${encounter.id}`);
    } catch {
      toast.error("Failed to save encounter");
    }
  };

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        className="gap-2"
        onClick={() => router.push("/encounters")}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Encounters
      </Button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          New Clinical Encounter
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Record vitals, symptoms, and clinical findings
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main form column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Patient Selection */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4 text-primary" />
                Patient
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Select a patient" />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        {p.name} &mdash; {p.locality} ({p.age}yrs)
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPatient && (
                <div className="mt-3 flex items-center gap-3 rounded-lg bg-primary/5 p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {selectedPatient.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                  </div>
                  <div className="text-sm">
                    <p className="font-medium text-foreground">{selectedPatient.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedPatient.age}yrs, {selectedPatient.sex}, {selectedPatient.locality}
                      {selectedPatient.nhisNumber && ` | NHIS: ${selectedPatient.nhisNumber}`}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Vitals */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-chart-2" />
                Vital Signs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm">
                    <Thermometer className="h-3.5 w-3.5 text-destructive" />
                    Temperature (C)
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 37.5"
                    value={vitals.temperature}
                    onChange={(e) => setVitals({ ...vitals, temperature: e.target.value })}
                    className="h-12 text-base"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm">
                    <HeartPulse className="h-3.5 w-3.5 text-destructive" />
                    Blood Pressure (mmHg)
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="Systolic"
                      value={vitals.bloodPressureSystolic}
                      onChange={(e) =>
                        setVitals({ ...vitals, bloodPressureSystolic: e.target.value })
                      }
                      className="h-12 text-base"
                    />
                    <span className="text-muted-foreground">/</span>
                    <Input
                      type="number"
                      placeholder="Diastolic"
                      value={vitals.bloodPressureDiastolic}
                      onChange={(e) =>
                        setVitals({ ...vitals, bloodPressureDiastolic: e.target.value })
                      }
                      className="h-12 text-base"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm">
                    <HeartPulse className="h-3.5 w-3.5 text-primary" />
                    Pulse (bpm)
                  </Label>
                  <Input
                    type="number"
                    placeholder="e.g. 72"
                    value={vitals.pulse}
                    onChange={(e) => setVitals({ ...vitals, pulse: e.target.value })}
                    className="h-12 text-base"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm">
                    <Wind className="h-3.5 w-3.5 text-chart-2" />
                    Respiratory Rate (breaths/min)
                  </Label>
                  <Input
                    type="number"
                    placeholder="e.g. 18"
                    value={vitals.respiratoryRate}
                    onChange={(e) =>
                      setVitals({ ...vitals, respiratoryRate: e.target.value })
                    }
                    className="h-12 text-base"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm">
                    <Weight className="h-3.5 w-3.5 text-accent" />
                    Weight (kg)
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 65.5"
                    value={vitals.weight}
                    onChange={(e) => setVitals({ ...vitals, weight: e.target.value })}
                    className="h-12 text-base"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm">
                    <Ruler className="h-3.5 w-3.5 text-accent" />
                    Height (cm)
                  </Label>
                  <Input
                    type="number"
                    placeholder="e.g. 170"
                    value={vitals.height}
                    onChange={(e) => setVitals({ ...vitals, height: e.target.value })}
                    className="h-12 text-base"
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label className="flex items-center gap-2 text-sm">
                    <Activity className="h-3.5 w-3.5 text-success" />
                    SpO2 (%)
                  </Label>
                  <Input
                    type="number"
                    placeholder="e.g. 98"
                    value={vitals.spO2}
                    onChange={(e) => setVitals({ ...vitals, spO2: e.target.value })}
                    className="h-12 text-base"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Symptoms */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Stethoscope className="h-4 w-4 text-accent" />
                Presenting Symptoms
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {COMMON_SYMPTOMS.map((symptom) => (
                  <button
                    key={symptom}
                    type="button"
                    onClick={() => toggleSymptom(symptom)}
                    className={`rounded-full px-4 py-2.5 text-sm font-medium transition-all ${
                      selectedSymptoms.includes(symptom)
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {symptom}
                  </button>
                ))}
              </div>
              {selectedSymptoms.length > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {selectedSymptoms.length} symptom{selectedSymptoms.length > 1 ? "s" : ""} selected
                </p>
              )}
            </CardContent>
          </Card>

          {/* History and Diagnosis */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Clinical Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">History of Presenting Complaint</Label>
                <Textarea
                  placeholder="Describe the patient's history, duration of symptoms, severity..."
                  value={history}
                  onChange={(e) => setHistory(e.target.value)}
                  rows={4}
                  className="text-base"
                />
              </div>

              {/* Diagnosis & Treatment */}
              <div className="space-y-4">
                <Card className="border-border/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Clipboard className="h-4 w-4 text-chart-1" />
                      Diagnosis & Treatment
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Diagnosis Mode Selection */}
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <Label className="text-sm font-medium text-amber-800 mb-2 block">Diagnosis Mode</Label>
                      <div className="flex gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="radio" 
                            name="diagnosisMode" 
                            value="ai"
                            checked={diagnosisMode === "ai"}
                            onChange={(e) => setDiagnosisMode(e.target.value as "ai" | "manual")}
                            className="text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="text-sm">
                            <Bot className="inline h-3 w-3 mr-1" />
                            AI Assistant
                          </span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="radio" 
                            name="diagnosisMode" 
                            value="manual"
                            checked={diagnosisMode === "manual"}
                            onChange={(e) => setDiagnosisMode(e.target.value as "ai" | "manual")}
                            className="text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="text-sm">
                            <FileText className="inline h-3 w-3 mr-1" />
                            Manual
                          </span>
                        </label>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Primary Diagnosis</Label>
                      <Input
                        placeholder="e.g. Uncomplicated Malaria, URTI"
                        value={diagnosis}
                        onChange={(e) => setDiagnosis(e.target.value)}
                        className="text-base"
                      />
                    </div>
                    
                    {diagnosisMode === "manual" && (
                      <>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Secondary Diagnosis (Optional)</Label>
                          <Input
                            placeholder="e.g. Dehydration, Anemia"
                            value={secondaryDiagnosis}
                            onChange={(e) => setSecondaryDiagnosis(e.target.value)}
                            className="text-base"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Treatment Plan</Label>
                          <Textarea
                            placeholder="Medications, dosages, and duration..."
                            value={treatment}
                            onChange={(e) => setTreatment(e.target.value)}
                            rows={3}
                            className="text-base"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Clinical Assessment</Label>
                          <Textarea
                            placeholder="Detailed clinical findings and assessment..."
                            value={clinicalNotes}
                            onChange={(e) => setClinicalNotes(e.target.value)}
                            rows={3}
                            className="text-base"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Follow-up Instructions</Label>
                          <Textarea
                            placeholder="Return for follow-up in... Warning signs..."
                            value={followUpInstructions}
                            onChange={(e) => setFollowUpInstructions(e.target.value)}
                            rows={2}
                            className="text-base"
                          />
                        </div>
                      </>
                    )}
                    
                    {diagnosisMode === "ai" && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs text-blue-700">
                          <Bot className="inline h-3 w-3 mr-1" />
                          AI Assistant will help with diagnosis and treatment recommendations.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Additional Notes</Label>
                <Textarea
                  placeholder="Any other observations, referrals, follow-up needed..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="text-base"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="border-border/60 lg:sticky lg:top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Save Encounter</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full gap-2"
                size="lg"
                onClick={() => handleSave("completed")}
              >
                <CheckCircle2 className="h-4 w-4" />
                Save & Complete
              </Button>
              <Button
                variant="outline"
                className="w-full gap-2 bg-transparent"
                size="lg"
                onClick={() => handleSave("in-progress")}
              >
                <Save className="h-4 w-4" />
                Save as Draft
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Data is stored locally on this device
              </p>
            </CardContent>
          </Card>

          {/* Quick reference */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Normal Ranges (Adult)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Temperature</span>
                <span className="font-mono">36.1 - 37.2 C</span>
              </div>
              <div className="flex justify-between">
                <span>Blood Pressure</span>
                <span className="font-mono">120/80 mmHg</span>
              </div>
              <div className="flex justify-between">
                <span>Pulse</span>
                <span className="font-mono">60 - 100 bpm</span>
              </div>
              <div className="flex justify-between">
                <span>Resp. Rate</span>
                <span className="font-mono">12 - 20 /min</span>
              </div>
              <div className="flex justify-between">
                <span>SpO2</span>
                <span className="font-mono">95 - 100 %</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
