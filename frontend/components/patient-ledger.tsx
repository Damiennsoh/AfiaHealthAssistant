"use client";

import React from "react"

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Filter,
  UserPlus,
  X,
  ChevronDown,
  Calendar,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { patientDB, generateId, formatNHIS, generateFolderNumber } from "@/lib/db";
import { LocalitySelector } from "./health/LocalitySelector";
import type { Patient } from "@/lib/db";
import { PatientCard, PatientCardSkeleton } from "@/components/patient-card";
import { toast } from "sonner";
import { GHANA_REGIONS } from "@/components/health/LocalitySelector";
import Link from "next/link";
import { PatientLookup } from "@/components/health/PatientLookup";
import { FileArchive } from "lucide-react";
import DataUtility from "@/components/data-backup";

// Communities will be dynamically populated from patient data

export function PatientLedger() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [filterLocality, setFilterLocality] = useState<string>("all");
  const [filterRegion, setFilterRegion] = useState<string>("all");
  
  // Advanced filters state
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [filterGender, setFilterGender] = useState<"all" | "male" | "female">("all");
  const [filterTimeFrame, setFilterTimeFrame] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>("all");
  
  const [isFormOpen, setIsFormOpen] = useState(
    searchParams.get("action") === "new"
  );
  const [isDataUtilityOpen, setIsDataUtilityOpen] = useState(false);

  // Form state
  const [folderNumber, setFolderNumber] = useState<string>("");
  const [formData, setFormData] = useState({
    name: "",
    nhisNumber: "",
    hasNHIS: true,
    age: "",
    sex: "male" as "male" | "female",
    region: "",
    community: "",
    phone: "",
  });

  // Generate folder number when dialog opens
  useEffect(() => {
    if (isFormOpen) {
      generateFolderNumber().then(setFolderNumber);
    }
  }, [isFormOpen]);

  const loadPatients = useCallback(async () => {
    try {
      const data = await patientDB.getAll();
      setPatients(
        data.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      );
    } catch {
      // DB not ready
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPatients();
    
    // Subscribe to real-time updates
    const unsubscribe = patientDB.subscribe(loadPatients);
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [loadPatients]);

  // Get unique registration years from patient data (for filter dropdown)
  const registrationYears = React.useMemo(() => {
    const years = new Set<string>();
    patients.forEach((p) => {
      if (p.createdAt) {
        years.add(new Date(p.createdAt).getFullYear().toString());
      }
    });
    return Array.from(years).sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
  }, [patients]);

  const MONTHS = [
    { value: "01", label: "Jan" }, { value: "02", label: "Feb" }, { value: "03", label: "Mar" },
    { value: "04", label: "Apr" }, { value: "05", label: "May" }, { value: "06", label: "Jun" },
    { value: "07", label: "Jul" }, { value: "08", label: "Aug" }, { value: "09", label: "Sep" },
    { value: "10", label: "Oct" }, { value: "11", label: "Nov" }, { value: "12", label: "Dec" },
  ];

  // Get unique communities from patient data for filter dropdown
  const uniqueCommunities = React.useMemo(() => {
    const communities = new Set<string>();
    patients.forEach(p => {
      if (p.community && p.community.trim()) {
        communities.add(p.community.trim());
      }
    });
    return Array.from(communities).sort();
  }, [patients]);

  const filteredPatients = React.useMemo(() => {
    return patients.filter((p) => {
      const matchesSearch =
        !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.nhisNumber && p.nhisNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
        p.folderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.region?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.community?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.phone && p.phone.includes(searchQuery));

      const matchesLocality =
        filterLocality === "all" || p.locality === filterLocality;

      const matchesRegion =
        filterRegion === "all" || p.region === filterRegion;

      const matchesGender = 
        filterGender === "all" || p.sex === filterGender;

      const matchesTimeFrame = (() => {
        if (filterTimeFrame === "all") return true;
        
        const d = p.createdAt ? new Date(p.createdAt) : null;
        if (!d) return false;
        
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        if (filterTimeFrame === "today") {
          return d >= startOfToday;
        }
        
        if (filterTimeFrame === "this-week") {
          const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
          startOfWeek.setHours(0, 0, 0, 0);
          return d >= startOfWeek;
        }

        if (filterTimeFrame === "past-week") {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            return d >= oneWeekAgo;
        }
        
        if (filterTimeFrame === "this-month") {
          return d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear();
        }

        // Check if it's a specific year (e.g., "year-2024")
        if (filterTimeFrame.startsWith("year-")) {
            const year = parseInt(filterTimeFrame.replace("year-", ""));
            const monthMatch = filterMonth !== "all" 
              ? d.getMonth() === parseInt(filterMonth) - 1 // JS months are 0-based
              : true;
            return d.getFullYear() === year && monthMatch;
        }

        // Check if it's a specific month of current year (e.g., "month-0") for Jan
        if (filterTimeFrame.startsWith("month-")) {
            const month = parseInt(filterTimeFrame.replace("month-", ""));
            return d.getMonth() === month && d.getFullYear() === new Date().getFullYear();
        }
        
        return true;
      })();

      return matchesSearch && matchesLocality && matchesRegion && matchesGender && matchesTimeFrame;
    });
  }, [patients, searchQuery, filterLocality, filterRegion, filterGender, filterTimeFrame, filterMonth]);

  // Reset expansion when filters change
  useEffect(() => {
    setIsExpanded(false);
  }, [searchQuery, filterLocality, filterRegion, filterGender, filterTimeFrame, filterMonth]);

  // Pagination / Expansion Logic
  const displayedPatients = isExpanded ? filteredPatients : filteredPatients.slice(0, 5);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.age || !formData.region || !formData.community) {
      toast.error("Please fill in required fields (Name, Age, Region, Community)");
      return;
    }

    // NHIS number validation (8 digits) - only if hasNHIS is true
    if (formData.hasNHIS && formData.nhisNumber && !/^\d{8}$/.test(formData.nhisNumber)) {
      toast.error("NHIS number must be 8 digits (e.g., 57684276)");
      return;
    }

    const now = new Date().toISOString();
    
    const patient: Patient = {
      id: generateId(),
      folderNumber: folderNumber,
      name: formData.name.trim(),
      nhisNumber: formData.hasNHIS ? formData.nhisNumber.trim() : undefined,
      hasNHIS: formData.hasNHIS,
      age: parseInt(formData.age),
      sex: formData.sex,
      region: formData.region,
      community: formData.community.trim(),
      locality: `${formData.community}, ${formData.region}`,
      phone: formData.phone.trim(),
      createdAt: now,
      updatedAt: now,
    };

    try {
      await patientDB.save(patient);
      toast.success("Patient registered successfully", {
        description: `${patient.name} has been added to the OPD ledger`,
      });
      setIsFormOpen(false);
      setFormData({
        name: "",
        nhisNumber: "",
        hasNHIS: true,
        age: "",
        sex: "male",
        region: "",
        community: "",
        phone: "",
      });
      // Generate new folder number for next patient
      generateFolderNumber().then(setFolderNumber);
      loadPatients();
    } catch {
      toast.error("Failed to save patient");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Patient Ledger
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            OPD Registry &mdash; {patients.length} patients registered
          </p>
        </div>
        <div className="flex gap-3">
          <PatientLookup 
            onPatientSelect={(patient) => {
              toast.success(`Found patient: ${patient.name} (${patient.folderNumber})`);
              router.push(`/patients/${patient.id}`);
            }}
          />
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2 bg-transparent" 
            onClick={() => setIsDataUtilityOpen(true)}
          >
            <FileArchive className="h-4 w-4" />
            <span className="hidden sm:inline">Backup</span>
          </Button>
          <Link href="/patients/new">
            <Button size="sm" className="gap-2">
              <UserPlus className="h-4 w-4" />
              Register Patient
            </Button>
          </Link>
        </div>
      </div>

      {/* Search and filter */}
      <Card className="border-border/60">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, folder number, NHIS number, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="h-4 w-4" />
                  <span className="hidden sm:inline">Filters</span>
                  {(filterGender !== "all" || filterTimeFrame !== "all" || filterRegion !== "all" || filterLocality !== "all") && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                      {[
                        filterGender !== "all", 
                        filterTimeFrame !== "all", 
                        filterRegion !== "all", 
                        filterLocality !== "all"
                      ].filter(Boolean).length}
                    </Badge>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Filter Patients</DialogTitle>
                </DialogHeader>
                <div className="grid gap-6 py-4">
                  {/* Gender Filter */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Gender</Label>
                    <RadioGroup 
                      value={filterGender} 
                      onValueChange={(v) => setFilterGender(v as any)}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="all" id="g-all" />
                        <Label htmlFor="g-all">All</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="male" id="g-male" />
                        <Label htmlFor="g-male">Male</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="female" id="g-female" />
                        <Label htmlFor="g-female">Female</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Timeframe Filter */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Registration Period</Label>
                    <div className="flex gap-2">
                      <Select value={filterTimeFrame} onValueChange={(v) => {
                        setFilterTimeFrame(v);
                        if (!v.startsWith("year-")) setFilterMonth("all");
                      }}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select period" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Time</SelectItem>
                          <SelectItem value="today">Today</SelectItem>
                          <SelectItem value="this-week">This Week</SelectItem>
                          <SelectItem value="past-week">Past 7 Days</SelectItem>
                          <SelectItem value="this-month">This Month</SelectItem>
                          {registrationYears.map(year => (
                             <SelectItem key={year} value={`year-${year}`}>Year {year}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {filterTimeFrame.startsWith("year-") && (
                        <Select value={filterMonth} onValueChange={setFilterMonth}>
                          <SelectTrigger className="w-[110px]">
                            <SelectValue placeholder="Month" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Months</SelectItem>
                            {MONTHS.map((m) => (
                              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>

                  {/* Region Filter */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Region</Label>
                    <Select value={filterRegion} onValueChange={setFilterRegion}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Regions" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Regions</SelectItem>
                        {GHANA_REGIONS.map((region) => (
                          <SelectItem key={region} value={region}>
                            {region}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Locality Filter */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Community</Label>
                    <Select value={filterLocality} onValueChange={setFilterLocality}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Communities" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Communities</SelectItem>
                        {uniqueCommunities.length > 0 ? (
                          uniqueCommunities.map((community: string) => (
                            <SelectItem key={community} value={community}>
                              {community}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-communities" disabled>
                            No communities registered yet
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => {
                    setFilterGender("all");
                    setFilterTimeFrame("all");
                    setFilterRegion("all");
                    setFilterLocality("all");
                  }}>
                    Reset Filters
                  </Button>
                  <Button onClick={() => setIsFilterDialogOpen(false)}>Done</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Results count */}
      {(searchQuery || filterTimeFrame !== "all" || filterMonth !== "all" || filterRegion !== "all" || filterLocality !== "all" || filterGender !== "all") && (
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary">{filteredPatients.length} results</Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery("");
              setFilterLocality("all");
              setFilterRegion("all");
              setFilterTimeFrame("all");
              setFilterMonth("all");
              setFilterGender("all");
            }}
            className="h-6 gap-1 text-xs"
          >
            <X className="h-3 w-3" />
            Clear
          </Button>
        </div>
      )}

      {/* Patient list */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <PatientCardSkeleton key={`skeleton-${i}`} />
          ))
        ) : displayedPatients.length > 0 ? (
          <>
            {displayedPatients.map((patient) => (
              <PatientCard
                key={patient.id}
                patient={patient}
                onClick={() => router.push(`/patients/${patient.id}`)}
              />
            ))}
            
            {/* View All Button */}
            {!isExpanded && filteredPatients.length > 5 && (
              <Button 
                variant="outline" 
                className="w-full mt-4 bg-muted/20 hover:bg-muted/40 text-muted-foreground"
                onClick={() => setIsExpanded(true)}
              >
                <ChevronDown className="mr-2 h-4 w-4" />
                View All ({filteredPatients.length - 5} more)
              </Button>
            )}
          </>
        ) : (
          <Card className="border-dashed border-border">
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <UserPlus className="h-7 w-7 text-muted-foreground" />
              </div>
              <div>
                <p className="text-base font-semibold text-foreground">
                  {(searchQuery || filterTimeFrame !== "all" || filterRegion !== "all" || filterLocality !== "all" || filterGender !== "all")
                    ? "No patients found"
                    : "No patients registered"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {(searchQuery || filterTimeFrame !== "all" || filterRegion !== "all" || filterLocality !== "all" || filterGender !== "all")
                    ? "Try adjusting your search or filters"
                    : "Register your first patient to get started with clinical records"}
                </p>
              </div>
              {!searchQuery && filterTimeFrame === "all" && filterRegion === "all" && filterLocality === "all" && filterGender === "all" && (
                <Link href="/patients/new">
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Register First Patient
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Registration Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader className="border-b border-emerald-100 bg-emerald-50 pb-4">
            <DialogTitle className="flex items-center gap-2 text-lg text-emerald-800">
              <UserPlus className="h-5 w-5 text-primary" />
              New Patient Registration
              <span className="text-xs bg-emerald-600 text-white px-2 py-1 rounded-full">
                GHS
              </span>
              {folderNumber && (
                <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded-full ml-auto">
                  Folder: {folderNumber}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6 pt-4">
            {/* Patient Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Full Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Enter patient's full name"
                  className="w-full"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nhisNumber">
                  NHIS Number {formData.hasNHIS && <span className="text-red-500">*</span>}
                </Label>
                <div className="flex items-center space-x-2 mb-2">
                  <input
                    type="checkbox"
                    id="hasNHIS"
                    checked={formData.hasNHIS}
                    onChange={(e) =>
                      setFormData({ ...formData, hasNHIS: e.target.checked })
                    }
                    className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <Label htmlFor="hasNHIS" className="text-sm text-gray-700">
                    Patient has NHIS insurance
                  </Label>
                </div>
                <Input
                  id="nhisNumber"
                  type="text"
                  value={formData.nhisNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, nhisNumber: e.target.value })
                  }
                  placeholder="e.g., 57684276"
                  maxLength={8}
                  className="w-full font-mono"
                  required={formData.hasNHIS}
                  disabled={!formData.hasNHIS}
                />
                <p className="text-xs text-slate-500">
                  8-digit NHIS number (e.g., 57684276)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="age">
                  Age <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="age"
                  type="number"
                  value={formData.age}
                  onChange={(e) =>
                    setFormData({ ...formData, age: e.target.value })
                  }
                  placeholder="Enter age in years"
                  min="0"
                  max="120"
                  className="w-full"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sex">
                  Gender <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.sex}
                  onValueChange={(value) =>
                    setFormData({ ...formData, sex: value as "male" | "female" })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="Enter phone number (optional)"
                  className="w-full"
                />
              </div>
            </div>

            {/* Locality Information */}
            <div className="border-t border-slate-200 pt-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">
                Locality Information
              </h3>
              <LocalitySelector
                value={{
                  region: formData.region,
                  community: formData.community,
                }}
                onChange={(locality) =>
                  setFormData({
                    ...formData,
                    region: locality.region,
                    community: locality.community,
                  })
                }
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-6 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsFormOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Register Patient
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {/* Data Management Dialog */}
      <Dialog open={isDataUtilityOpen} onOpenChange={setIsDataUtilityOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <FileArchive className="h-5 w-5 text-emerald-600" />
              Data Management
            </DialogTitle>
          </DialogHeader>
          <DataUtility />
        </DialogContent>
      </Dialog>
    </div>
  );
}
