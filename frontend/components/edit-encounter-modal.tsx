"use client";

import { useState, useEffect } from "react";
import { Stethoscope, Save, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { encounterDB, type Encounter } from "@/lib/db";
import { toast } from "sonner";
import { AdminAuthModal } from "./admin-auth-modal";
import { useAuth } from "@/contexts/AfiaAuthContext";
import { useSync } from "@/contexts/SyncContext";
import { Badge } from "@/components/ui/badge";

interface EditEncounterModalProps {
  encounter: Encounter | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function EditEncounterModal({
  encounter,
  isOpen,
  onClose,
  onSaved,
}: EditEncounterModalProps) {
  const { user } = useAuth();
  const { syncToCloud } = useSync();
  const [isSaving, setIsSaving] = useState(false);
  const [showAdminAuth, setShowAdminAuth] = useState(false);
  const [isAdminVerified, setIsAdminVerified] = useState(false);

  const [formData, setFormData] = useState({
    presentingComplaint: "",
    historyOfComplaint: "",
    diagnosis: "",
    treatment: "",
    notes: "",
  });

  // Load encounter data when modal opens
  useEffect(() => {
    if (encounter && isOpen) {
      setFormData({
        presentingComplaint: encounter.presentingComplaint || "",
        historyOfComplaint: encounter.historyOfComplaint || "",
        diagnosis: encounter.diagnosis || "",
        treatment: encounter.treatment || "",
        notes: encounter.notes || "",
      });
      // Reset admin verification when modal opens
      setIsAdminVerified(false);
    }
  }, [encounter, isOpen]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!encounter) return;

    // Check if encounter is completed - require admin
    if (encounter.status === "completed" && user?.role !== "clinic_admin" && user?.role !== "super_admin" && !isAdminVerified) {
      setShowAdminAuth(true);
      return;
    }

    // Check if user is admin for any edit
    if (user?.role !== "clinic_admin" && user?.role !== "super_admin" && !isAdminVerified) {
      setShowAdminAuth(true);
      return;
    }

    setIsSaving(true);

    try {
      const updatedEncounter: Encounter = {
        ...encounter,
        presentingComplaint: formData.presentingComplaint.trim(),
        historyOfComplaint: formData.historyOfComplaint.trim(),
        diagnosis: formData.diagnosis.trim(),
        treatment: formData.treatment.trim(),
        notes: formData.notes.trim(),
        updatedAt: new Date().toISOString(),
      };

      await encounterDB.save(updatedEncounter);
      
      // Proactively trigger cloud sync if online
      if (syncToCloud) {
        syncToCloud().catch((err: unknown) => console.error("Immediate sync failed:", err));
      }
      
      toast.success("Encounter updated successfully");
      onSaved();
      onClose();
    } catch (error) {
      console.error("Error saving encounter:", error);
      toast.error("Failed to save encounter changes");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdminVerified = () => {
    setIsAdminVerified(true);
    setShowAdminAuth(false);
    // Proceed with save after admin verification
    handleSave();
  };

  const isCompleted = encounter?.status === "completed";

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="space-y-3">
            <div className="flex items-center gap-2 text-primary">
              <Stethoscope className="h-5 w-5" />
              <DialogTitle className="text-lg font-semibold">
                Edit Encounter
              </DialogTitle>
            </div>
            {isCompleted && (
              <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded-md">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">
                  This encounter is marked as completed. Admin verification required for edits.
                </span>
              </div>
            )}
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Presenting Complaint - Label muted, value area distinct */}
            <div className="space-y-2">
              <Label htmlFor="presentingComplaint" className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Presenting Complaint
              </Label>
              <Textarea
                id="presentingComplaint"
                value={formData.presentingComplaint}
                onChange={(e) => handleInputChange("presentingComplaint", e.target.value)}
                placeholder="Patient's main complaint"
                className="min-h-[80px] resize-none rounded-lg bg-slate-50 border-slate-200 text-slate-900 font-medium placeholder:text-slate-400"
                disabled={isSaving}
              />
            </div>

            {/* History of Presenting Complaint */}
            <div className="space-y-2">
              <Label htmlFor="historyOfComplaint" className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                History of Presenting Complaint
              </Label>
              <Textarea
                id="historyOfComplaint"
                value={formData.historyOfComplaint}
                onChange={(e) => handleInputChange("historyOfComplaint", e.target.value)}
                placeholder="Onset, duration, aggravating/relieving factors"
                className="min-h-[100px] resize-none rounded-lg bg-slate-50 border-slate-200 text-slate-900 font-medium placeholder:text-slate-400"
                disabled={isSaving}
              />
            </div>

            {/* Diagnosis */}
            <div className="space-y-2">
              <Label htmlFor="diagnosis" className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Diagnosis / Impression
              </Label>
              <Input
                id="diagnosis"
                value={formData.diagnosis}
                onChange={(e) => handleInputChange("diagnosis", e.target.value)}
                placeholder="Clinical diagnosis or impression"
                className="h-11 rounded-lg bg-slate-50 border-slate-200 text-slate-900 font-semibold placeholder:text-slate-400"
                disabled={isSaving}
              />
            </div>

            {/* Treatment Plan */}
            <div className="space-y-2">
              <Label htmlFor="treatment" className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Treatment & Management Plan
              </Label>
              <Textarea
                id="treatment"
                value={formData.treatment}
                onChange={(e) => handleInputChange("treatment", e.target.value)}
                placeholder="Outline medications and management strategy..."
                className="min-h-[120px] resize-none rounded-lg bg-blue-50/80 border-blue-200 text-slate-900 font-semibold placeholder:text-slate-500"
                disabled={isSaving}
              />
            </div>

            {/* Additional Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes" className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Additional Notes
              </Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange("notes", e.target.value)}
                placeholder="Any additional clinical notes"
                className="min-h-[80px] resize-none rounded-lg bg-slate-50 border-slate-200 text-slate-900 font-medium placeholder:text-slate-400"
                disabled={isSaving}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1 h-11"
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                className="flex-1 h-11 bg-primary hover:bg-primary/90"
                disabled={isSaving}
              >
                {isSaving ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Save className="h-4 w-4" />
                    Save Changes
                  </span>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin Authentication Modal */}
      <AdminAuthModal
        isOpen={showAdminAuth}
        onClose={() => setShowAdminAuth(false)}
        onVerified={handleAdminVerified}
        title="Admin Authentication Required"
        description="You need admin privileges to edit encounter records. Please enter your admin password."
      />
    </>
  );
}
