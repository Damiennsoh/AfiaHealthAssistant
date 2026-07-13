"use client";

import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import PatientEncounterForm from "@/components/health/PatientEncounterForm";

export default function NewEncounterPage() {
  return (
    <AppShell>
      <Suspense fallback={<PageSkeleton />}>
        <PatientEncounterForm />
      </Suspense>
    </AppShell>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-32 animate-pulse rounded bg-muted" />
      <div className="h-8 w-64 animate-pulse rounded bg-muted" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={`s-${i}`} className="h-48 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
      </div>
    </div>
  );
}
