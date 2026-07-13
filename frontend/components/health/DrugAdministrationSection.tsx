"use client";

import { useState } from "react";
import { Plus, Trash2, Pill, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { DrugAdministration } from "@/lib/db";
import { generateId } from "@/lib/db";
import { toast } from "sonner";

interface DrugAdministrationProps {
  drugs: DrugAdministration[];
  onAddDrug: (drug: DrugAdministration) => void;
  onRemoveDrug: (drugId: string) => void;
  readOnly?: boolean;
}

export const COMMON_DRUGS = [
  // Antimalarials
  "Artesunate + Amodiaquine",
  "Artemether + Lumefantrine", 
  "Dihydroartemisinin + Piperaquine",
  "Quinine",
  "Clindamycin",
  
  // Analgesics & Antipyretics
  "Paracetamol",
  "Ibuprofen",
  "Aspirin",
  "Diclofenac",
  "Tramadol",
  "Morphine",
  
  // Antibiotics
  "Amoxicillin",
  "Amoxicillin + Clavulanic Acid",
  "Ceftriaxone",
  "Cefuroxime",
  "Azithromycin",
  "Erythromycin",
  "Doxycycline",
  "Tetracycline",
  "Gentamicin",
  "Ciprofloxacin",
  "Metronidazole",
  "Cloxacillin",
  "Penicillin",
  
  // Antihypertensives
  "Amlodipine",
  "Lisinopril",
  "Enalapril",
  "Hydrochlorothiazide",
  "Furosemide",
  "Spironolactone",
  "Propranolol",
  "Atenolol",
  
  // Antidiabetics
  "Metformin",
  "Glibenclamide",
  "Insulin",
  "Glimepiride",
  
  // Nutritional Supplements
  "Folic Acid",
  "Iron Tablets",
  "Vitamin A",
  "Zinc Sulphate",
  "Multivitamins",
  "Vitamin C",
  "Calcium",
  
  // Antihelminthics
  "Albendazole",
  "Mebendazole",
  "Ivermectin",
  "Praziquantel",
  
  // Gastrointestinal
  "ORS Solution",
  "Zinc Sulphate (for diarrhea)",
  "Omeprazole",
  "Ranitidine",
  "Metoclopramide",
  
  // Respiratory
  "Salbutamol Inhaler",
  "Beclomethasone Inhaler",
  "Theophylline",
  
  // Dermatological
  "Hydrocortisone Cream",
  "Clotrimazole Cream",
  "Miconazole Cream",
  "Calamine Lotion",
  
  // Others
  "Epinephrine",
  "Diazepam",
  "Lorazepam",
  "Warfarin",
  "Aspirin (low dose)",
  "Statins (Atorvastatin)",
  "Prednisone"
];

const ROUTES = ["oral", "IV", "IM", "SC", "topical"];
const FREQUENCIES = ["once", "twice daily", "three times daily", "every 4 hours", "every 6 hours", "every 8 hours", "every 12 hours", "weekly"];

// Drug interaction database - simplified for common interactions
const DRUG_INTERACTIONS: { [key: string]: string[] } = {
  "Warfarin": ["Aspirin", "NSAIDs", "Antibiotics"],
  "Aspirin": ["Warfarin", "NSAIDs", "Methotrexate"],
  "Ibuprofen": ["Warfarin", "Aspirin", "Methotrexate"],
  "Lisinopril": ["Potassium supplements", "NSAIDs"],
  "Amlodipine": ["Grapefruit juice", "Diltiazem"],
  "Metformin": ["Iodinated contrast", "Alcohol"],
  "Digoxin": ["Verapamil", "Amiodarone", "Quinidine"],
  "Statins": ["Grapefruit juice", "Macrolide antibiotics"],
  "Azithromycin": ["Statins", "Warfarin"],
  "Erythromycin": ["Statins", "Warfarin", "Theophylline"],
  "Metronidazole": ["Alcohol", "Warfarin"],
  "Ciprofloxacin": ["Antacids", "Iron supplements"],
  "Doxycycline": ["Antacids", "Iron supplements", "Calcium supplements"],
  "Theophylline": ["Ciprofloxacin", "Erythromycin", "Smoking"],
  "Insulin": ["Beta blockers", "Thiazide diuretics", "Corticosteroids"],
  "Oral contraceptives": ["Antibiotics", "Antifungals", "Anticonvulsants"]
};

export const checkDrugInteraction = (drugName: string, existingDrugs: DrugAdministration[]): string[] => {
  const interactions: string[] = [];
  
  existingDrugs.forEach(existingDrug => {
    const existingDrugName = existingDrug.drugName.toLowerCase();
    const newDrugName = drugName.toLowerCase();
    
    // Check if there's a known interaction
    Object.entries(DRUG_INTERACTIONS).forEach(([drug, interactingDrugs]) => {
      if (drug.toLowerCase() === newDrugName || drug.toLowerCase() === existingDrugName) {
        interactingDrugs.forEach(interactingDrug => {
          const otherDrugName = drug.toLowerCase() === newDrugName ? existingDrugName : newDrugName;
          if (interactingDrug.toLowerCase() === otherDrugName) {
            interactions.push(`${drug} + ${interactingDrug}`);
          }
        });
      }
    });
  });
  
  return [...new Set(interactions)]; // Remove duplicates
};

export function DrugAdministrationSection({ drugs, onAddDrug, onRemoveDrug, readOnly = false }: DrugAdministrationProps) {
  // Deduplicate drugs to prevent key collision errors if DB has duplicates
  const uniqueDrugs = drugs.filter((drug, index, self) => 
    index === self.findIndex((d) => d.id === drug.id)
  );

  const [showAddForm, setShowAddForm] = useState(false);
  const [isManualDrugEntry, setIsManualDrugEntry] = useState(false);
  const [newDrug, setNewDrug] = useState<Partial<DrugAdministration>>({
    drugName: "",
    dosage: "",
    frequency: "",
    route: "oral",
    startDate: new Date().toISOString().split('T')[0],
    prescribedBy: "",
    notes: ""
  });

  const handleAddDrug = () => {
    if (!newDrug.drugName || !newDrug.dosage || !newDrug.frequency || !newDrug.route || !newDrug.startDate) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Check for drug interactions
    const interactions = checkDrugInteraction(newDrug.drugName!, drugs);
    if (interactions.length > 0) {
      const interactionMessage = `Potential drug interactions detected: ${interactions.join(', ')}. Please review before proceeding.`;
      toast.warning(interactionMessage);
      
      // Still allow adding but warn the user
      if (!confirm(interactionMessage + '\n\nDo you want to continue adding this drug?')) {
        return;
      }
    }

    const drug: DrugAdministration = {
      id: generateId(),
      drugName: newDrug.drugName!,
      dosage: newDrug.dosage!,
      frequency: newDrug.frequency!,
      route: newDrug.route!,
      startDate: newDrug.startDate!,
      prescribedBy: newDrug.prescribedBy!,
      notes: newDrug.notes,
      createdAt: new Date().toISOString()
    };

    onAddDrug(drug);
    setNewDrug({
      drugName: "",
      dosage: "",
      frequency: "",
      route: "oral",
      startDate: new Date().toISOString().split('T')[0],
      prescribedBy: "",
      notes: ""
    });
    setIsManualDrugEntry(false);
    setShowAddForm(false);
    toast.success("Drug added to prescription");
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Pill className="h-5 w-5 text-primary" />
          Drug Administration
        </CardTitle>
        {!readOnly && (
          <Button
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
            className="gap-2 w-full sm:w-auto"
          >
            {showAddForm ? <Plus className="h-4 w-4 rotate-45" /> : <Plus className="h-4 w-4" />}
            {showAddForm ? "Cancel" : "Add Drug"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Drug Form */}
        {showAddForm && !readOnly && (
          <div className="grid gap-4 rounded-lg border border-border/40 bg-muted/30 p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="drugName">Drug Name *</Label>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs text-primary"
                    onClick={() => {
                      setIsManualDrugEntry(!isManualDrugEntry);
                      setNewDrug({ ...newDrug, drugName: "" });
                    }}
                  >
                    {isManualDrugEntry ? "Select from list" : "Type manually"}
                  </Button>
                </div>
                {isManualDrugEntry ? (
                  <Input
                    id="drugName"
                    placeholder="Type drug name..."
                    value={newDrug.drugName}
                    onChange={(e) => setNewDrug({ ...newDrug, drugName: e.target.value })}
                  />
                ) : (
                  <Select value={newDrug.drugName} onValueChange={(value) => setNewDrug({...newDrug, drugName: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select drug" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_DRUGS.map((drug) => (
                        <SelectItem key={drug} value={drug}>{drug}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="dosage">Dosage *</Label>
                <Input
                  id="dosage"
                  placeholder="e.g., 100mg/270mg"
                  value={newDrug.dosage}
                  onChange={(e) => setNewDrug({...newDrug, dosage: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="frequency">Frequency *</Label>
                <Select value={newDrug.frequency} onValueChange={(value) => setNewDrug({...newDrug, frequency: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map((freq) => (
                      <SelectItem key={freq} value={freq}>{freq}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="route">Route *</Label>
                <Select value={newDrug.route} onValueChange={(value) => setNewDrug({...newDrug, route: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select route" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROUTES.map((route) => (
                      <SelectItem key={route} value={route}>{route.toUpperCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={newDrug.startDate}
                  onChange={(e) => setNewDrug({...newDrug, startDate: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prescribedBy">Prescribed By *</Label>
                <Input
                  id="prescribedBy"
                  placeholder="Healthcare worker name"
                  value={newDrug.prescribedBy}
                  onChange={(e) => setNewDrug({...newDrug, prescribedBy: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional instructions or notes"
                value={newDrug.notes}
                onChange={(e) => setNewDrug({...newDrug, notes: e.target.value})}
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddDrug} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Drug
              </Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Drug List */}
        {uniqueDrugs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Pill className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No drugs administered yet</p>
            {!readOnly && <p className="text-sm">Click &quot;Add Drug&quot; to prescribe medications</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:gap-4">
            {uniqueDrugs.map((drug) => (
              <div key={drug.id} className="relative flex flex-col sm:flex-row items-start gap-3 sm:gap-4 rounded-xl border border-border/50 bg-card p-4 transition-all hover:shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30">
                  <Pill className="h-5 w-5" />
                </div>
                
                <div className="flex-1 min-w-0 w-full space-y-2">
                  <div className="flex flex-wrap items-center gap-2 pr-8 sm:pr-0">
                    <span className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[200px] sm:max-w-none">
                      {drug.drugName}
                    </span>
                    <Badge variant="outline" className="bg-slate-50 text-[10px] font-bold tracking-wider uppercase">
                      {drug.route}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-medium">
                      <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px] shrink-0">DOSAGE</span>
                      <span className="truncate">{drug.dosage}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-medium">
                      <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px] shrink-0">FREQ</span>
                      <span className="truncate">{drug.frequency}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-500 text-xs">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      <span>Started: {new Date(drug.startDate).toLocaleDateString("en-GB")}</span>
                    </div>
                    {drug.prescribedBy && (
                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-500 text-xs">
                        <span className="shrink-0 font-medium">By:</span>
                        <span className="truncate">{drug.prescribedBy}</span>
                      </div>
                    )}
                  </div>
                  
                  {drug.notes && (
                    <div className="mt-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-lg p-2.5 italic">
                      {drug.notes}
                    </div>
                  )}
                </div>
                
                {!readOnly && (
                  <div className="absolute top-4 right-4 sm:relative sm:top-0 sm:right-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemoveDrug(drug.id)}
                      className="h-8 w-8 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
