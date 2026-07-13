"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Users,
  Stethoscope,
  BotMessageSquare,
  Activity,
  Plus,
  ArrowRight,
  Shield,
  Clock,
  CloudOff,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { patientDB, encounterDB, aiRequestDB, uploadDB, dbCleanup } from "@/lib/db";
import type { Patient, Encounter, UploadTask } from "@/lib/db";
import { PatientCard } from "@/components/patient-card";
import { DatabaseDebug } from "@/components/database-debug";
import KnowledgeDiagnostics from "@/components/KnowledgeDiagnostics";
import { useOnlineStatus } from "@/hooks/use-online-status";

export function DashboardContent() {
  const isOnline = useOnlineStatus();
  const [stats, setStats] = useState({
    patients: 0,
    encounters: 0,
    pendingAI: 0,
    todayEncounters: 0,
  });
  const [recentPatients, setRecentPatients] = useState<Patient[]>([]);
  const [recentEncounters, setRecentEncounters] = useState<Encounter[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        // Clean up any stuck tasks first
        await dbCleanup.clearStuckAIRequests();
        await dbCleanup.clearFailedUploads();
        
        const [patients, allEncounters, queuedAIRequests, processingAIRequests, uploadTasks] = await Promise.all([
          patientDB.getAll(),
          encounterDB.getAll(),
          aiRequestDB.getQueued(),
          aiRequestDB.getProcessing(),
          uploadDB.getAll(),
        ]);

        // Filter encounters to only include those for non-deleted patients
        const activePatientIds = new Set(patients.map(p => p.id));
        const encounters = allEncounters.filter(e => activePatientIds.has(e.patientId));

        const today = new Date().toISOString().split("T")[0];
        const todayEnc = encounters.filter((e: Encounter) => e.date.startsWith(today));
        
        // Count all active tasks: queued AI requests + processing AI requests + active upload tasks
        const activeUploadTasks = uploadTasks.filter((t: UploadTask) => t.status === 'pending' || t.status === 'uploading');
        const totalActiveTasks = queuedAIRequests.length + processingAIRequests.length + activeUploadTasks.length;

        setStats({
          patients: patients.length,
          encounters: encounters.length,
          pendingAI: totalActiveTasks,
          todayEncounters: todayEnc.length,
        });

        setRecentPatients(
          patients
            .sort(
              (a: Patient, b: Patient) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
            )
            .slice(0, 3)
        );

        setRecentEncounters(
          encounters
            .sort(
              (a: Encounter, b: Encounter) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
            )
            .slice(0, 5)
        );
      } catch {
        // DB not ready yet
      }
    }

    // Initial load
    loadData();
    
    // Set up real-time updates via subscriptions
    const unsubPatient = patientDB.subscribe(loadData);
    const unsubEncounter = encounterDB.subscribe(loadData);
    const unsubAI = aiRequestDB.subscribe(loadData);
    const unsubUpload = uploadDB.subscribe(loadData);
    
    return () => {
      if (unsubPatient) unsubPatient();
      if (unsubEncounter) unsubEncounter();
      if (unsubAI) unsubAI();
      if (unsubUpload) unsubUpload();
    };
  }, []);

  const statCards = [
    {
      title: "Total Patients",
      value: stats.patients,
      icon: Users,
      description: "Registered in OPD",
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      title: "Encounters",
      value: stats.encounters,
      icon: Stethoscope,
      description: `${stats.todayEncounters} today`,
      color: "text-chart-2",
      bg: "bg-chart-2/10",
    },
    {
      title: "AI Queue",
      value: stats.pendingAI,
      icon: BotMessageSquare,
      description: isOnline ? "Processing" : "Queued offline",
      color: "text-accent",
      bg: "bg-accent/10",
    },
    {
      title: "System Status",
      value: isOnline ? "Online" : "Offline",
      icon: Activity,
      description: "Data saved locally",
      color: isOnline ? "text-success" : "text-accent",
      bg: isOnline ? "bg-success/10" : "bg-accent/10",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground lg:text-3xl">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Afia Clinical Decision Support System
          </p>
        </div>
        <div className="flex gap-3">
          <Button asChild size="lg" className="gap-2">
            <Link href="/patients?action=new">
              <Plus className="h-4 w-4" />
              New Patient
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="gap-2 bg-transparent">
            <Link href="/encounters?action=new">
              <Stethoscope className="h-4 w-4" />
              New Encounter
            </Link>
          </Button>
        </div>
      </div>

      {/* Offline banner */}
      {!isOnline && (
        <Card className="border-accent/30 bg-accent/5">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
              <CloudOff className="h-5 w-5 text-accent" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">
                Offline Mode Active
              </p>
              <p className="text-xs text-muted-foreground">
                All data is being saved locally. AI requests will be queued and
                processed when connection is restored.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card
            key={stat.title}
            className="border-border/60 transition-shadow hover:shadow-md"
          >
            <CardContent className="flex items-center gap-4 p-5">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${stat.bg}`}
              >
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-muted-foreground">
                  {stat.title}
                </span>
                <span className="text-2xl font-bold text-foreground">
                  {stat.value}
                </span>
                <span className="text-[11px] text-muted-foreground/70">
                  {stat.description}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Features / Quick actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent patients */}
        <Card className="border-border/60 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">
              Recent Patients
            </CardTitle>
            <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
              <Link href="/patients">
                View all
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentPatients.length > 0 ? (
              recentPatients.map((patient) => (
                <PatientCard
                  key={patient.id}
                  patient={patient}
                  compact
                  onClick={() => {
                    window.location.href = `/patients/${patient.id}`;
                  }}
                />
              ))
            ) : (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Users className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    No patients yet
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Register your first patient to get started
                  </p>
                </div>
                <Button asChild size="sm" className="gap-2">
                  <Link href="/patients?action=new">
                    <Plus className="h-3.5 w-3.5" />
                    Register Patient
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Info */}
        <div className="space-y-4">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                Key Features
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Shield className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Privacy-First
                  </p>
                  <p className="text-xs text-muted-foreground">
                    All data stored locally on device
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-chart-2/10">
                  <CloudOff className="h-4 w-4 text-chart-2" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Offline-Ready
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Works without internet connection
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                  <Clock className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Ghana STG Aligned
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Based on Ministry of Health protocols
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="pt-6">
              {/* Lazy load AfiaChat to keep initial bundle small */}
              <div>
                <ClientAfiaChat />
              </div>
            </CardContent>
          </Card>
          <div className="mt-4">
            <DatabaseDebug minimized={true} />
          </div>
          <div className="mt-4">
            <KnowledgeDiagnostics />
          </div>
        </div>
      </div>
    </div>
  );
}

const ClientAfiaChat = dynamic(() => import("./afia-chat"), { ssr: false });
