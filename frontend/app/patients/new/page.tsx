"use client";

import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import NewPatientForm from "@/components/health/NewPatientForm";

export default function NewPatientPage() {
  return (
    <AppShell>
      <Suspense fallback={<PageSkeleton />}>
        <NewPatientForm />
      </Suspense>
    </AppShell>
  );
}

function PageSkeleton() {
  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="h-96 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
