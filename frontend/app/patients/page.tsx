"use client";

import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { PatientLedger } from "@/components/patient-ledger";

export default function PatientsPage() {
  return (
    <AppShell>
      <Suspense fallback={<PageSkeleton />}>
        <PatientLedger />
      </Suspense>
    </AppShell>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="h-12 animate-pulse rounded-lg bg-muted" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={`s-${i}`} className="h-20 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
