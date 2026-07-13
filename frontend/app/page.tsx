"use client";

import { AppShell } from "@/components/app-shell";
import { DashboardContent } from "@/components/dashboard-content";

export default function Home() {
  return (
    <AppShell>
      <DashboardContent />
    </AppShell>
  );
}
