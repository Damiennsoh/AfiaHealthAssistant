import React from "react";
import DataUtility from "@/components/data-backup";
import { AppShell } from "@/components/app-shell";
import { BackNavigation } from "@/components/ui/back-navigation";

export const metadata = {
  title: "Data Management - Afia Health",
  description: "Backup and restore patient data for sync or export GHS reports",
};

export default function DataPage() {
  return (
    <AppShell>
      <div className="container mx-auto max-w-4xl py-6 px-4">
        <div className="flex items-center gap-4 mb-6">
          <BackNavigation fallback="/patients" showQuickNav={true} />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Data Management</h1>
            <p className="text-sm text-slate-500">Backup for sync or export for GHS reporting</p>
          </div>
        </div>
        <DataUtility />
      </div>
    </AppShell>
  );
}
