"use client";

import { useState, useEffect } from "react";
import { X, User, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { patientDB, type Patient } from "@/lib/db";
import { toast } from "sonner";
import { AdminAuthModal } from "./admin-auth-modal";
import { useAuth } from "@/contexts/AfiaAuthContext";
import { useSync } from "@/contexts/SyncContext";

interface EditPatientModalProps {
  patient: Patient | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function EditPatientModal({
  patient,
  isOpen,
  onClose,
  onSaved,
}: EditPatientModalProps) {
  const { user } = useAuth();
  const { syncToCloud } = useSync();
  const [isSaving, setIsSaving] = useState(false);
  const [showAdminAuth, setShowAdminAuth] = useState(false);
  const [isAdminVerified, setIsAdminVerified] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    age: "",
    sex: "male" as "male" | "female",
    phone: "",
    region: "",
    community: "",
    nhisNumber: "",
    hasNHIS: true,
  });

  // Load patient data when modal opens
  useEffect(() => {
    if (patient && isOpen) {
      setFormData({
        name: patient.name,
        age: patient.age.toString(),
        sex: patient.sex,
        phone: patient.phone || "",
        region: patient.region || "",
        community: patient.community || "",
        nhisNumber: patient.nhisNumber || "",
        hasNHIS: patient.hasNHIS,
      });
      // Reset admin verification when modal opens
      setIsAdminVerified(false);
    }
  }, [patient, isOpen]);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!patient) return;

    // Check if user is admin or admin verified
    if (user?.role !== "clinic_admin" && user?.role !== "super_admin" && !isAdminVerified) {
      setShowAdminAuth(true);
      return;
    }

    // Validation
    if (!formData.name.trim()) {
      toast.error("Patient name is required");
      return;
    }
    if (!formData.age || parseInt(formData.age) <= 0) {
      toast.error("Valid age is required");
      return;
    }

    setIsSaving(true);

    try {
      const updatedPatient: Patient = {
        ...patient,
        name: formData.name.trim(),
        age: parseInt(formData.age),
        sex: formData.sex,
        phone: formData.phone.trim(),
        region: formData.region,
        community: formData.community.trim(),
        locality: `${formData.community}, ${formData.region}`,
        nhisNumber: formData.hasNHIS ? formData.nhisNumber.trim() : undefined,
        hasNHIS: formData.hasNHIS,
        updatedAt: new Date().toISOString(),
      };

      await patientDB.save(updatedPatient);
      
      // Proactively trigger cloud sync if online
      if (syncToCloud) {
        syncToCloud().catch((err: unknown) => console.error("Immediate sync failed:", err));
      }
      
      toast.success("Patient information updated successfully");
      onSaved();
      onClose();
    } catch (error) {
      console.error("Error saving patient:", error);
      toast.error("Failed to save patient changes");
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

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="space-y-3">
            <div className="flex items-center gap-2 text-primary">
              <User className="h-5 w-5" />
              <DialogTitle className="text-lg font-semibold">
                Edit Patient
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">
                Patient Name *
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="Enter patient name"
                className="h-11"
                disabled={isSaving}
              />
            </div>

            {/* Age and Sex */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="age" className="text-sm font-medium">
                  Age (years) *
                </Label>
                <Input
                  id="age"
                  type="number"
                  value={formData.age}
                  onChange={(e) => handleInputChange("age", e.target.value)}
                  placeholder="Age"
                  className="h-11"
                  disabled={isSaving}
                  min="0"
                  max="120"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Sex *</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleInputChange("sex", "male")}
                    disabled={isSaving}
                    className={`flex-1 h-11 rounded-md border text-sm font-medium transition-colors ${
                      formData.sex === "male"
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    Male
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInputChange("sex", "female")}
                    disabled={isSaving}
                    className={`flex-1 h-11 rounded-md border text-sm font-medium transition-colors ${
                      formData.sex === "female"
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    Female
                  </button>
                </div>
              </div>
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium">
                Phone Number
              </Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                placeholder="Enter phone number"
                className="h-11"
                disabled={isSaving}
              />
            </div>

            {/* Region and Community */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="region" className="text-sm font-medium">
                  Region
                </Label>
                <Input
                  id="region"
                  value={formData.region}
                  onChange={(e) => handleInputChange("region", e.target.value)}
                  placeholder="Region"
                  className="h-11"
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="community" className="text-sm font-medium">
                  Community
                </Label>
                <Input
                  id="community"
                  value={formData.community}
                  onChange={(e) => handleInputChange("community", e.target.value)}
                  placeholder="Community"
                  className="h-11"
                  disabled={isSaving}
                />
              </div>
            </div>

            {/* NHIS */}
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="hasNHIS"
                  checked={formData.hasNHIS}
                  onChange={(e) => handleInputChange("hasNHIS", e.target.checked)}
                  disabled={isSaving}
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <Label htmlFor="hasNHIS" className="text-sm font-medium">
                  Has NHIS
                </Label>
              </div>
              
              {formData.hasNHIS && (
                <div className="space-y-2">
                  <Label htmlFor="nhisNumber" className="text-sm font-medium">
                    NHIS Number
                  </Label>
                  <Input
                    id="nhisNumber"
                    value={formData.nhisNumber}
                    onChange={(e) => handleInputChange("nhisNumber", e.target.value)}
                    placeholder="Enter NHIS number"
                    className="h-11"
                    disabled={isSaving}
                  />
                </div>
              )}
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
        description="You need admin privileges to edit patient records. Please enter your admin password."
      />
    </>
  );
}
