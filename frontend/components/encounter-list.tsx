"use client";

import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Plus,
  Stethoscope,
  Clock,
  CheckCircle2,
  Calendar,
  User,
  Filter,
  X,
  Search,
  ChevronDown,
  MapPin,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { encounterDB, patientDB } from "@/lib/db";
import type { Encounter, Patient } from "@/lib/db";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

import { BackNavigation } from "@/components/ui/back-navigation";

export function EncounterList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [patients, setPatients] = useState<Record<string, Patient>>({});
  const [loading, setLoading] = useState(true);
  
  // Advanced Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [filterGender, setFilterGender] = useState<"all" | "male" | "female">("all");
  const [filterTimeFrame, setFilterTimeFrame] = useState<string>("all");
  const [filterRegion, setFilterRegion] = useState<string>("all");
  const [filterCommunity, setFilterCommunity] = useState<string>("all");

  const ENCOUNTER_YEARS = useMemo(() => {
    return [...new Set(encounters.map((e) => new Date(e.date || e.createdAt).getFullYear().toString()))]
      .sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
  }, [encounters]);

  // Derived filter options from patient database
  const uniqueRegions = useMemo(() => {
    const regions = new Set<string>();
    Object.values(patients).forEach(p => {
      if (p.region) regions.add(p.region);
    });
    return Array.from(regions).sort();
  }, [patients]);

  const uniqueCommunities = useMemo(() => {
    const communities = new Set<string>();
    Object.values(patients).forEach(p => {
      if (p.community) communities.add(p.community);
    });
    return Array.from(communities).sort();
  }, [patients]);

  const filteredEncounters = useMemo(() => {
    return encounters.filter((enc) => {
      const patient = patients[enc.patientId];
      if (!patient) return false;

      // 1. Search Query (Name, Folder, NHIS, Phone)
      const query = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        patient.name.toLowerCase().includes(query) ||
        patient.folderNumber.toLowerCase().includes(query) ||
        (patient.nhisNumber && patient.nhisNumber.toLowerCase().includes(query)) ||
        (patient.phone && patient.phone.includes(query));

      // 2. Gender Filter
      const matchesGender = filterGender === "all" || patient.sex === filterGender;

      // 3. Region Filter
      const matchesRegion = filterRegion === "all" || patient.region === filterRegion;

      // 4. Community Filter
      const matchesCommunity = filterCommunity === "all" || patient.community === filterCommunity;

      // 5. Timeframe Filter
      const matchesTimeFrame = (() => {
        if (filterTimeFrame === "all") return true;

        const d = new Date(enc.date || enc.createdAt);
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (filterTimeFrame === "today") {
          return d >= startOfToday;
        }

        if (filterTimeFrame === "this-week") {
          // Current week (Monday to Sunday)
          const day = now.getDay() || 7; // Get current day number, make Sunday 7
          if (day !== 1) now.setHours(-24 * (day - 1)); // Set to Monday
          now.setHours(0, 0, 0, 0);
          return d >= now;
        }

        if (filterTimeFrame === "past-week") {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            oneWeekAgo.setHours(0, 0, 0, 0);
            return d >= oneWeekAgo;
        }

        if (filterTimeFrame === "this-month") {
          return d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear();
        }

        if (filterTimeFrame.startsWith("year-")) {
            const year = parseInt(filterTimeFrame.replace("year-", ""));
            return d.getFullYear() === year;
        }

        return true;
      })();

      return matchesSearch && matchesGender && matchesRegion && matchesCommunity && matchesTimeFrame;
    });
  }, [encounters, patients, searchQuery, filterGender, filterRegion, filterCommunity, filterTimeFrame]);

  // Reset expansion when filters change
  useEffect(() => {
    setIsExpanded(false);
  }, [searchQuery, filterGender, filterRegion, filterCommunity, filterTimeFrame]);


  useEffect(() => {
    async function load() {
      try {
        const [enc, pats] = await Promise.all([
          encounterDB.getAll(),
          patientDB.getAll(),
        ]);
        setEncounters(
          enc.sort(
            (a, b) =>
              new Date(b.date || b.createdAt).getTime() -
              new Date(a.date || a.createdAt).getTime()
          )
        );
        const patMap: Record<string, Patient> = {};
        pats.forEach((p) => {
          patMap[p.id] = p;
        });
        setPatients(patMap);
      } catch {
        // DB not ready
      } finally {
        setLoading(false);
      }
    }
    
    // Initial load
    load();
    
    // Subscribe to changes
    const unsubEncounter = encounterDB.subscribe(load);
    const unsubPatient = patientDB.subscribe(load);
    
    return () => {
      if (unsubEncounter) unsubEncounter();
      if (unsubPatient) unsubPatient();
    };
  }, []);

  useEffect(() => {
    if (searchParams.get("action") === "new") {
      const patientId = searchParams.get("patientId") || "";
      router.push(`/encounters/new${patientId ? `?patientId=${patientId}` : ""}`);
    }
  }, [searchParams, router]);

  const inProgressEncounters = useMemo(() => filteredEncounters.filter((e) => e.status === "in-progress"), [filteredEncounters]);
  const completedEncounters = useMemo(() => filteredEncounters.filter((e) => e.status === "completed"), [filteredEncounters]);

  const displayedAll = isExpanded ? filteredEncounters : filteredEncounters.slice(0, 5);
  const displayedInProgress = isExpanded ? inProgressEncounters : inProgressEncounters.slice(0, 5);
  const displayedCompleted = isExpanded ? completedEncounters : completedEncounters.slice(0, 5);

  const activeFiltersCount = [
    filterGender !== "all",
    filterTimeFrame !== "all",
    filterRegion !== "all",
    filterCommunity !== "all",
  ].filter(Boolean).length;

  const resetFilters = () => {
    setFilterGender("all");
    setFilterTimeFrame("all");
    setFilterRegion("all");
    setFilterCommunity("all");
  };

  const EncounterItem = ({ enc }: { enc: Encounter }) => {
    const patient = patients[enc.patientId];
    return (
      <Link
        href={`/encounters/${enc.id}`}
        className="group relative flex items-center gap-3 sm:gap-4 rounded-xl border border-border/60 bg-card p-3 sm:p-4 transition-all hover:border-primary/30 hover:shadow-sm overflow-hidden"
      >
        {/* Status Bar */}
        <div 
          className={`absolute left-0 top-0 bottom-0 w-1 ${
            enc.status === "completed" ? "bg-emerald-500" : "bg-amber-500"
          }`} 
        />
        
        <div
          className={`flex h-9 w-9 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full ${
            enc.status === "completed" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
          }`}
        >
          {enc.status === "completed" ? (
            <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
          ) : (
            <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
          )}
        </div>
        <div className="flex-1 space-y-0.5 sm:space-y-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs sm:text-sm font-semibold text-foreground truncate">
              {enc.diagnosis || "Undiagnosed Encounter"}
            </span>
            <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
              {new Date(enc.date || enc.createdAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
              })}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-3 text-[10px] sm:text-xs text-muted-foreground">
            {patient && (
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="flex items-center gap-1 truncate font-medium text-slate-700 dark:text-slate-300">
                  <User className="h-3 w-3 shrink-0" />
                  {patient.name}
                </span>
                <span className="text-muted-foreground/50 shrink-0">•</span>
                <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded shrink-0">{patient.folderNumber}</span>
              </div>
            )}
            {patient?.community && (
               <span className="flex items-center gap-1 truncate sm:ml-auto opacity-80">
                 <MapPin className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0" />
                 {patient.community}
               </span>
            )}
          </div>
        </div>
      </Link>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <BackNavigation 
            fallback="/" 
            showQuickNav={true} 
            forceQuickNavMobile={true}
            size="icon"
            className="shrink-0"
          />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Clinical Encounters
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage patient visits and history
            </p>
          </div>
        </div>
        <Button asChild size="sm" className="gap-2 shadow-sm">
          <Link href="/encounters/new">
            <Plus className="h-4 w-4" />
            New Encounter
          </Link>
        </Button>
      </div>

      {/* Search and Filter Bar */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-4 pt-2 -mx-1 px-1">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, folder, NHIS, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-background/50"
          />
        </div>
        
        <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2 bg-background/50 relative">
              <Filter className="h-4 w-4" />
              Filters
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="h-5 w-5 rounded-full px-0 flex items-center justify-center text-[10px] bg-primary/10 text-primary ml-0.5">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Filter Encounters</DialogTitle>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              {/* Gender Filter */}
              <div className="space-y-3">
                <Label>Gender</Label>
                <RadioGroup 
                  value={filterGender} 
                  onValueChange={(v: "all" | "male" | "female") => setFilterGender(v)}
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
                <Label>Timeframe</Label>
                <Select value={filterTimeFrame} onValueChange={setFilterTimeFrame}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select timeframe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="this-week">This Week (Mon-Sun)</SelectItem>
                    <SelectItem value="past-week">Past 7 Days</SelectItem>
                    <SelectItem value="this-month">This Month</SelectItem>
                    {ENCOUNTER_YEARS.map(year => (
                      <SelectItem key={year} value={`year-${year}`}>Year {year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Location Filters */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Label>Region</Label>
                  <Select value={filterRegion} onValueChange={setFilterRegion}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any Region" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any Region</SelectItem>
                      {uniqueRegions.map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label>Community</Label>
                  <Select value={filterCommunity} onValueChange={setFilterCommunity}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any Community" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any Community</SelectItem>
                      {uniqueCommunities.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" onClick={resetFilters} className="mr-auto">
                Reset Filters
              </Button>
              <DialogClose asChild>
                <Button>Apply Filters</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="all">
            All <span className="ml-1 text-xs opacity-70">({filteredEncounters.length})</span>
          </TabsTrigger>
          <TabsTrigger value="in-progress">
            In Progress <span className="ml-1 text-xs opacity-70">({inProgressEncounters.length})</span>
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed <span className="ml-1 text-xs opacity-70">({completedEncounters.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4 space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={`skel-${i}`} className="h-20 animate-pulse rounded-xl bg-muted" />
            ))
          ) : displayedAll.length > 0 ? (
            <>
              {displayedAll.map((enc) => <EncounterItem key={enc.id} enc={enc} />)}
              {filteredEncounters.length > 5 && (
                <Button 
                  variant="ghost" 
                  className="w-full text-muted-foreground hover:text-foreground"
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="mr-2 h-4 w-4" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="mr-2 h-4 w-4" />
                      View All ({filteredEncounters.length - 5} more)
                    </>
                  )}
                </Button>
              )}
            </>
          ) : (
            <EmptyEncounters />
          )}
        </TabsContent>

        <TabsContent value="in-progress" className="mt-4 space-y-3">
          {displayedInProgress.length > 0 ? (
             <>
             {displayedInProgress.map((enc) => <EncounterItem key={enc.id} enc={enc} />)}
             {inProgressEncounters.length > 5 && (
               <Button 
                 variant="ghost" 
                 className="w-full text-muted-foreground hover:text-foreground"
                 onClick={() => setIsExpanded(!isExpanded)}
               >
                 {isExpanded ? (
                   <>
                     <ChevronUp className="mr-2 h-4 w-4" />
                     Show Less
                   </>
                 ) : (
                   <>
                     <ChevronDown className="mr-2 h-4 w-4" />
                     View All ({inProgressEncounters.length - 5} more)
                   </>
                 )}
               </Button>
             )}
           </>
          ) : (
            <EmptyEncounters message="No encounters in progress" />
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4 space-y-3">
          {displayedCompleted.length > 0 ? (
             <>
             {displayedCompleted.map((enc) => <EncounterItem key={enc.id} enc={enc} />)}
             {completedEncounters.length > 5 && (
               <Button 
                 variant="ghost" 
                 className="w-full text-muted-foreground hover:text-foreground"
                 onClick={() => setIsExpanded(!isExpanded)}
               >
                 {isExpanded ? (
                   <>
                     <ChevronUp className="mr-2 h-4 w-4" />
                     Show Less
                   </>
                 ) : (
                   <>
                     <ChevronDown className="mr-2 h-4 w-4" />
                     View All ({completedEncounters.length - 5} more)
                   </>
                 )}
               </Button>
             )}
           </>
          ) : (
            <EmptyEncounters message="No completed encounters" />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyEncounters({ message = "No encounters found" }) {
  return (
    <Card className="border-dashed border-border/60 bg-transparent shadow-none">
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/50">
          <Stethoscope className="h-7 w-7 text-muted-foreground" />
        </div>
        <div>
          <p className="text-base font-semibold text-foreground">{message}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try adjusting your filters or create a new encounter
          </p>
        </div>
        <Button asChild variant="outline" className="gap-2">
          <Link href="/encounters/new">
            <Plus className="h-4 w-4" />
            New Encounter
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
