"use client";

import { use } from "react";
import { AppShell } from "@/components/app-shell";
import { EncounterDetail } from "@/components/encounter-detail";

export default function EncounterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <AppShell>
      <EncounterDetail encounterId={id} />
    </AppShell>
  );
}
