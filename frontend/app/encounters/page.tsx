"use client";

import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { EncounterList } from "@/components/encounter-list";

export default function EncountersPage() {
  return (
    <AppShell>
      <Suspense fallback={<PageSkeleton />}>
        <EncounterList />
      </Suspense>
    </AppShell>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={`s-${i}`} className="h-20 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
