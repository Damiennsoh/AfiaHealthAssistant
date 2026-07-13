"use client";

import { User, MapPin, CreditCard, Calendar, ChevronRight, FolderOpen } from "lucide-react";
import type { Patient } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PatientCardProps {
  patient: Patient;
  onClick?: () => void;
  compact?: boolean;
}

export function PatientCard({ patient, onClick, compact }: PatientCardProps) {
  const initials = patient.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Card
      className={cn(
        "group cursor-pointer border-border/60 transition-all duration-200 hover:border-primary/30 hover:bg-slate-50 hover:shadow-md active:scale-[0.99]",
        compact ? "p-0" : ""
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" && onClick) onClick();
      }}
    >
      <CardContent className={cn("flex items-center gap-3 sm:gap-4", compact ? "p-2.5 sm:p-3" : "p-3 sm:p-4")}>
        {/* Avatar */}
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary",
            compact ? "h-9 w-9 text-xs" : "h-11 w-11 text-sm sm:h-12 sm:w-12 sm:text-base"
          )}
        >
          {initials}
        </div>

        {/* Info */}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:gap-1">
          <div className="flex items-center gap-2">
            <span className={cn("truncate font-semibold text-foreground", compact ? "text-xs" : "text-sm sm:text-base")}>
              {patient.name}
            </span>
            <Badge variant="secondary" className="shrink-0 text-[9px] sm:text-[10px] h-4 sm:h-5">
              {patient.sex === "male" ? "M" : "F"}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-1 text-[10px] sm:text-xs text-muted-foreground">
            <span className="flex items-center gap-1 font-mono text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1 rounded">
              <FolderOpen className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              {patient.folderNumber}
            </span>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1">
                <Calendar className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                {patient.age}Y
              </span>
              {patient.hasNHIS && patient.nhisNumber && (
                <span className="flex items-center gap-1">
                  <CreditCard className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  <span className="hidden sm:inline">NHIS: </span>
                  {patient.nhisNumber.slice(-4)}
                </span>
              )}
            </div>
            {patient.locality && (
              <span className="flex items-center gap-1 truncate max-w-[120px] sm:max-w-none">
                <MapPin className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                {patient.locality}
              </span>
            )}
          </div>
        </div>

        {/* Arrow */}
        <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full bg-transparent transition-colors group-hover:bg-primary/10">
          <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
        </div>
      </CardContent>
    </Card>
  );
}

export function PatientCardSkeleton() {
  return (
    <Card className="border-border/60">
      <CardContent className="flex items-center gap-4 p-4">
        <div className="h-12 w-12 animate-pulse rounded-full bg-muted" />
        <div className="flex flex-1 flex-col gap-2">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="h-3 w-48 animate-pulse rounded bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}
