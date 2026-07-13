"use client";

import React, { useState } from "react";
import { ExternalLink, BookOpen, ChevronDown, ChevronUp, Shield, FileText, AlertTriangle, Beaker } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KnowledgeChunk } from "@/hooks/use-knowledge-base";

interface SourceCitationProps {
  chunk: KnowledgeChunk;
  className?: string;
  expanded?: boolean;
}

export function SourceCitation({ chunk, className, expanded: defaultExpanded = false }: SourceCitationProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div
      className={cn(
        "rounded-xl border border-emerald-200 bg-emerald-50/50 overflow-hidden",
        className
      )}
    >
      {/* Header - Always visible */}
      <div className="flex items-start gap-3 p-3 sm:p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
          <Shield className="h-5 w-5 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
              <BookOpen className="h-3 w-3" />
              GHS STG SOURCE
            </span>
            {chunk.isAuthority && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                <Shield className="h-3 w-3" />
                AUTHORITY
              </span>
            )}
            <span className="text-[10px] text-emerald-600 font-medium">
              Reference Protocol
            </span>
          </div>
          <h4 className="mt-1 text-sm font-bold text-slate-800 leading-tight">
            {chunk.section}
          </h4>
        </div>
      </div>

      {/* Expandable Content */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          isExpanded ? "max-h-96" : "max-h-0"
        )}
      >
        <div className="px-3 sm:px-4 pb-3 sm:pb-4">
          <div className="rounded-lg bg-white border border-emerald-100 p-3">
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed italic">
              &ldquo;{chunk.content}&rdquo;
            </p>
          </div>
        </div>
      </div>

      {/* Footer - Source info and toggle */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-t border-emerald-100 bg-emerald-50/30">
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          <FileText className="h-3 w-3" />
          <span className="truncate max-w-[150px] sm:max-w-[200px]">{chunk.source}</span>
          <span className="text-slate-300">|</span>
          <span>{new Date(chunk.dateAdded).toLocaleDateString()}</span>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              <span className="hidden sm:inline">Show less</span>
              <span className="sm:hidden">Less</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              <span className="hidden sm:inline">View protocol</span>
              <span className="sm:hidden">View</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

interface SourceCitationListProps {
  chunks: KnowledgeChunk[];
  className?: string;
  isGeneralFallback?: boolean;
}

export function SourceCitationList({ chunks, className, isGeneralFallback = false }: SourceCitationListProps) {
  if (chunks.length === 0 && !isGeneralFallback) return null;

  // If it's a general fallback (no GHS match), show the amber warning
  if (isGeneralFallback || chunks.length === 0) {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 overflow-hidden">
          <div className="flex items-start gap-3 p-3 sm:p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100">
              <Beaker className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  <AlertTriangle className="h-3 w-3" />
                  GENERAL INFORMATION
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                No matching GHS STG protocol found. This response is based on general medical knowledge and clinical interpretation. Please verify with authoritative sources when available.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
        <Shield className="h-3 w-3" />
        Referenced from GHS STG 7th Edition
      </div>
      {chunks.map((chunk) => (
        <SourceCitation key={chunk.id} chunk={chunk} />
      ))}
    </div>
  );
}

// Compact badge for showing verification status
interface GHSVerificationBadgeProps {
  status: "verified" | "pending" | "empty";
  className?: string;
}

export function GHSVerificationBadge({ status, className }: GHSVerificationBadgeProps) {
  const config = {
    verified: {
      bg: "bg-emerald-600",
      text: "text-white",
      dot: "bg-emerald-300",
      label: "VERIFIED GHS STG 7TH ED",
      icon: Shield,
    },
    pending: {
      bg: "bg-amber-500",
      text: "text-white",
      dot: "bg-amber-200",
      label: "SYNCING...",
      icon: BookOpen,
    },
    empty: {
      bg: "bg-slate-400",
      text: "text-white",
      dot: "bg-slate-200",
      label: "NO GHS DATA",
      icon: FileText,
    },
  };

  const { bg, text, dot, label, icon: Icon } = config[status];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5",
        bg,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", dot)} />
      <Icon className={cn("h-3 w-3", text)} />
      <span className={cn("text-[10px] font-bold tracking-wide", text)}>
        {label}
      </span>
    </div>
  );
}

// GHS Sync Status indicator for bottom of screen
interface GHSSyncStatusProps {
  status: "online" | "offline" | "loading" | "empty";
  className?: string;
}

export function GHSSyncStatus({ status, className }: GHSSyncStatusProps) {
  const config = {
    online: { color: "text-emerald-600", label: "ONLINE", dot: "bg-emerald-500" },
    offline: { color: "text-rose-500", label: "OFFLINE", dot: "bg-rose-500" },
    loading: { color: "text-amber-500", label: "SYNCING", dot: "bg-amber-500" },
    empty: { color: "text-slate-400", label: "NO DATA", dot: "bg-slate-400" },
  };

  const { color, label, dot } = config[status];

  return (
    <div className={cn("flex items-center justify-center gap-2 text-[10px]", className)}>
      <span className="text-slate-400">GHS AI Sync Status:</span>
      <span className={cn("font-bold flex items-center gap-1.5", color)}>
        <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
        {label}
      </span>
    </div>
  );
}
