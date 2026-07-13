"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, User, X } from "lucide-react";
import { patientDB, type Patient } from "@/lib/db";

interface PatientPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (patient: Patient) => void;
  title?: string;
  description?: string;
}

export function PatientPickerModal({
  isOpen,
  onClose,
  onSelect,
  title = "Select Patient",
  description = "Choose a patient to save this AI insight to their record."
}: PatientPickerModalProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Load patients when modal opens
  useEffect(() => {
    if (isOpen) {
      loadPatients();
    }
  }, [isOpen]);

  // Filter patients when search changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredPatients(patients);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = patients.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.folderNumber?.toLowerCase().includes(query) ||
        p.locality?.toLowerCase().includes(query)
    );
    setFilteredPatients(filtered);
  }, [searchQuery, patients]);

  const loadPatients = async () => {
    setIsLoading(true);
    try {
      const allPatients = await patientDB.getAll();
      // Sort by most recently updated
      const sorted = allPatients.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      setPatients(sorted);
      setFilteredPatients(sorted);
    } catch (error) {
      console.error("Failed to load patients:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (patient: Patient) => {
    onSelect(patient);
    setSearchQuery(""); // Reset for next time
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[80vh] p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="flex items-center gap-2 text-emerald-800">
            <User className="h-5 w-5" />
            {title}
          </DialogTitle>
          <p className="text-sm text-slate-500">{description}</p>
        </DialogHeader>

        {/* Search Input */}
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by name, folder number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Patient List */}
        <ScrollArea className="flex-1 max-h-[50vh]">
          <div className="px-4 pb-4 space-y-2">
            {isLoading ? (
              <div className="text-center py-8 text-slate-500">
                Loading patients...
              </div>
            ) : filteredPatients.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                {searchQuery ? "No patients match your search" : "No patients found"}
              </div>
            ) : (
              filteredPatients.map((patient) => (
                <button
                  key={patient.id}
                  onClick={() => handleSelect(patient)}
                  className="w-full text-left p-3 rounded-lg border border-slate-200 bg-white hover:bg-emerald-50 hover:border-emerald-200 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-800 group-hover:text-emerald-800">
                        {patient.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {patient.folderNumber} • {patient.age}yrs • {patient.sex}
                      </p>
                      <p className="text-xs text-slate-400">{patient.locality}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-emerald-600"
                    >
                      Select
                    </Button>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 rounded-b-lg">
          <p className="text-xs text-slate-500 text-center">
            {filteredPatients.length} patient{filteredPatients.length !== 1 ? "s" : ""} available
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PatientPickerModal;
