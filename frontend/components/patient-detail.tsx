"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AfiaAuthContext";
import { EditPatientModal } from "./edit-patient-modal";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  CreditCard,
  MapPin,
  Phone,
  Stethoscope,
  Trash2,
  User,
  Plus,
  Clock,
  CheckCircle2,
  Folder,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BackNavigation } from "@/components/ui/back-navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { patientDB, encounterDB } from "@/lib/db";
import type { Patient, Encounter } from "@/lib/db";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

export function PatientDetail({ patientId }: { patientId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { canDeletePatient } = usePermissions();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);

  // Fetch patient data
  const loadData = useCallback(async () => {
    try {
      const [p, enc] = await Promise.all([
        patientDB.getById(patientId),
        encounterDB.getByPatient(patientId),
      ]);
      setPatient(p);
      setEncounters(
        (enc || []).sort(
          (a, b) =>
            new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime()
        )
      );
    } catch {
      toast.error("Failed to load patient data");
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async () => {
    try {
      await patientDB.softDelete(patientId, user?.id);
      toast.success("Patient record deleted");
      router.push("/patients");
    } catch {
      toast.error("Failed to delete patient");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-48 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <p className="text-lg font-semibold text-foreground">
          Patient not found
        </p>
        <Button asChild variant="outline">
          <Link href="/patients">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Ledger
          </Link>
        </Button>
      </div>
    );
  }

  const initials = patient.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="space-y-6">
      {/* Optimized navigation */}
      <BackNavigation 
        fallback="/patients" 
        label="Back to Patient Ledger"
        showQuickNav={true}
        className="mb-4"
      />

      {/* Patient info card */}
      <Card className="border-border/60">
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
                {initials}
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-foreground">
                    {patient.name}
                  </h1>
                  <Badge variant="secondary">
                    {patient.sex === "male" ? "Male" : "Female"}
                  </Badge>
                  {patient.folderNumber && (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                      <Folder className="h-3 w-3 mr-1" />
                      {patient.folderNumber}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    {patient.age} years old
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    {patient.locality}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CreditCard className="h-4 w-4" />
                    {patient.nhisNumber || "No NHIS"}
                  </span>
                  {patient.phone && (
                    <span className="flex items-center gap-1.5">
                      <Phone className="h-4 w-4" />
                      {patient.phone}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground/60">
                  Registered:{" "}
                  {new Date(patient.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                asChild
                size="sm"
                className="gap-2"
              >
                <Link href={`/encounters?action=new&patientId=${patientId}`}>
                  <Plus className="h-4 w-4" />
                  New Encounter
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setShowEditModal(true)}
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
              {canDeletePatient() && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive bg-transparent">
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Patient Record</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete {patient.name}&apos;s record
                        and all associated encounters. This action cannot be
                        undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Encounters */}
      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-semibold">
            Clinical Encounters ({encounters.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {encounters.length > 0 ? (
            encounters.map((enc) => (
              <Link
                key={enc.id}
                href={`/encounters/${enc.id}`}
                className="flex items-center gap-4 rounded-xl border border-border/60 p-4 transition-all hover:border-primary/30 hover:shadow-sm"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-chart-2/10">
                  <Stethoscope className="h-5 w-5 text-chart-2" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground truncate max-w-full">
                      {enc.diagnosis || "Encounter"}
                    </span>
                    <Badge
                      variant={
                        enc.status === "completed" ? "secondary" : "outline"
                      }
                      className="text-[10px]"
                    >
                      {enc.status === "completed" ? (
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                      ) : (
                        <Clock className="mr-1 h-3 w-3" />
                      )}
                      {enc.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(enc.date).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                    {enc.symptoms.length > 0 &&
                      ` - ${enc.symptoms.slice(0, 3).join(", ")}`}
                  </p>
                </div>
              </Link>
            ))
          ) : (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Stethoscope className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                No encounters recorded yet
              </p>
              <Button asChild size="sm" className="gap-2">
                <Link href={`/encounters?action=new&patientId=${patientId}`}>
                  <Plus className="h-3.5 w-3.5" />
                  Record First Encounter
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Edit Patient Modal */}
      <EditPatientModal
        patient={patient}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSaved={loadData}
      />
    </div>
  );
}
