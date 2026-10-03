"use client";

import React from "react";
import { useAuth } from "@/contexts/AfiaAuthContext";
import { Database, ShieldCheck } from "lucide-react";

/**
 * GuestSandboxBanner
 *
 * Professional, unobtrusive environment indicator displayed when the session
 * is operating within the isolated evaluation sandbox (guest@afia.health).
 * Complies with enterprise clinical software standards (e.g. Cerner / Epic sandbox).
 */
export default function GuestSandboxBanner() {
  const { isGuestMode } = useAuth();

  if (!isGuestMode) return null;

  return (
    <aside
      role="status"
      aria-live="polite"
      className="sticky top-0 z-[9999] w-full bg-slate-900/95 backdrop-blur-md text-slate-200 border-b border-amber-500/30 px-4 py-2 text-xs shadow-sm"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center justify-center w-5 h-5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 flex-shrink-0">
            <Database className="w-3 h-3" />
          </div>
          <p className="text-slate-300 text-xs truncate sm:text-clip">
            <span className="font-semibold text-amber-400 tracking-wider text-[11px] mr-2 uppercase">
              Isolated Evaluation Sandbox
            </span>
            Clinical encounters &amp; records created in this session are stored locally on this terminal and isolated from production facility data.
          </p>
        </div>
        <div className="hidden md:flex items-center gap-1.5 text-[11px] text-slate-400 font-medium flex-shrink-0">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Local Storage Only • Cloud Sync Paused</span>
        </div>
      </div>
    </aside>
  );
}
