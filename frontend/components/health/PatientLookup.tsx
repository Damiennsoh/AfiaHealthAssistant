"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { patientDB } from "@/lib/db";
import type { Patient } from "@/lib/db";
import { toast } from "sonner";
import { Search, UserPlus, FolderOpen, CreditCard } from "lucide-react";

interface PatientLookupProps {
  onPatientSelect: (patient: Patient) => void;
  trigger?: React.ReactNode;
}

export function PatientLookup({ onPatientSelect, trigger }: PatientLookupProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const results = await patientDB.search(query);
      setSearchResults(results.slice(0, 10)); // Limit to 10 results
    } catch (error) {
      console.error("Search error:", error);
      toast.error("Failed to search patients");
    } finally {
      setLoading(false);
    }
  };

  const handlePatientClick = (patient: Patient) => {
    onPatientSelect(patient);
    setIsOpen(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleNewPatient = () => {
    setIsOpen(false);
    router.push("/patients/new");
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <Search className="h-4 w-4" />
            Find Existing Patient
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Patient Lookup
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Search Input */}
          <div className="space-y-2">
            <Label htmlFor="patientSearch">Search by Folder Number, NHIS Number, or Name</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="patientSearch"
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Enter folder number (F-00001), NHIS number, or patient name..."
                className="pl-10"
                autoFocus
              />
            </div>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="space-y-2">
              <Label>Found Patients</Label>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {searchResults.map((patient) => (
                  <Card 
                    key={patient.id} 
                    className="cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => handlePatientClick(patient)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold text-foreground">
                              {patient.name}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {patient.age}y, {patient.sex}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <FolderOpen className="h-3 w-3" />
                              <span className="font-mono">{patient.folderNumber}</span>
                            </div>
                            
                            {patient.hasNHIS && patient.nhisNumber && (
                              <div className="flex items-center gap-1">
                                <CreditCard className="h-3 w-3" />
                                <span className="font-mono">{patient.nhisNumber}</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="text-sm text-muted-foreground">
                            {patient.locality}
                          </div>
                        </div>
                        
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePatientClick(patient);
                          }}
                        >
                          Select
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* No Results */}
          {searchQuery && !loading && searchResults.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No patients found matching &quot;{searchQuery}&quot;</p>
              <Button onClick={handleNewPatient} className="gap-2">
                <UserPlus className="h-4 w-4" />
                Register New Patient
              </Button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Searching...</p>
            </div>
          )}

          {/* New Patient Button */}
          {!searchQuery && !loading && (
            <div className="text-center py-4">
              <Button onClick={handleNewPatient} variant="outline" className="gap-2">
                <UserPlus className="h-4 w-4" />
                Register New Patient
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
