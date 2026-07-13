"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { 
  Pill, 
  Stethoscope, 
  Activity, 
  Info, 
  Plus, 
  AlertTriangle, 
  ClipboardCheck, 
  FileText,
  ShieldAlert,
  GraduationCap,
  Microscope,
  ChevronRight,
  Save,
  Database
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ClinicalResponseRendererProps {
  content: string;
  className?: string;
  isStreaming?: boolean;
  onAddToPatient?: (content: string, section?: string) => void;
  showActions?: boolean;
}

// Helper to strip markdown and clean medical text
const cleanMedicalText = (text: string): string => {
  return text
    .replace(/\[\[AFIA_REQ:[^\]]+\]\]\s*/g, "")
    .replace(/\[GENERAL_FALLBACK\]\s*/g, "")
    .replace(/[#*_~`]/g, "")
    .replace(/\[PROTOCOL\s*\d+\]/gi, "GHS STG 7th Edition, 2017")
    .replace(/protocol\s*\d+/gi, "GHS Guidelines")
    .replace(/\bper\s+ghs\s+stg[^.]*\.?/gi, "") // Remove "Per GHS STG..." references
    .replace(/\baccording\s+to\s+ghs\s+stg[^.]*\.?/gi, "") // Remove "According to GHS STG..."
    .replace(/\breferences?:?\s*ghs\s+stg[^.]*\.?/gi, "") // Remove reference citations
    .replace(/\bsee\s+ghs\s+stg[^.]*\.?/gi, "") // Remove "see GHS STG..."
    .replace(/\(source:\s*ghs[^)]*\)/gi, "") // Remove (Source: GHS...)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

// Parser for structured clinical data
const extractSections = (text: string) => {
  const sections: Record<string, string[]> = {};
  let current = "";
  
  text.split('\n').forEach(line => {
    const match = line.match(/^(Diagnosis|Assessment|Treatment|Rationale|Investigations|Prescription|Counseling|Danger Signs|GHS Recommendation|Disclaimer):/i);
    if (match) {
      current = match[1].toLowerCase();
      sections[current] = [];
    } else if (current && line.trim()) {
      sections[current].push(line.replace(/^[*-]\s*/, '').trim());
    }
  });
  
  return sections;
};

// Section configuration with colors
const config: Record<string, { label: string; icon: any; colors: string }> = {
  diagnosis: { label: "DIAGNOSIS", icon: Stethoscope, colors: "bg-rose-50 border-rose-200 text-rose-900" },
  assessment: { label: "ASSESSMENT", icon: Activity, colors: "bg-amber-50 border-amber-200 text-amber-900" },
  treatment: { label: "TREATMENT PLAN", icon: Pill, colors: "bg-emerald-50 border-emerald-200 text-emerald-900" },
  rationale: { label: "RATIONALE", icon: Info, colors: "bg-blue-50 border-blue-200 text-blue-900" },
  prescription: { label: "PRESCRIPTION", icon: FileText, colors: "bg-sky-50 border-sky-200 text-sky-900" },
  investigations: { label: "INVESTIGATIONS", icon: Microscope, colors: "bg-violet-50 border-violet-200 text-violet-900" },
  counseling: { label: "COUNSELING", icon: GraduationCap, colors: "bg-teal-50 border-teal-200 text-teal-900" },
  "danger signs": { label: "DANGER SIGNS", icon: ShieldAlert, colors: "bg-red-50 border-red-200 text-red-900" },
  "ghs recommendation": { label: "GHS RECOMMENDATION", icon: ClipboardCheck, colors: "bg-emerald-50 border-emerald-200 text-emerald-900" },
  disclaimer: { label: "DISCLAIMER", icon: AlertTriangle, colors: "bg-slate-50 border-slate-200 text-slate-700" },
};

function SectionCard({ section, data, onAdd, show }: { section: string; data: string[]; onAdd?: Function; show: boolean }) {
  const c = config[section];
  if (!c) return null;
  const Icon = c.icon;
  
  return (
    <div className={cn("rounded-2xl border p-4 shadow-sm", c.colors)}>
      <div className="flex items-center justify-between mb-3">
        <Badge className={cn("gap-1 text-[10px] uppercase font-bold", c.colors)}>
          <Icon className="h-3 w-3" /> {c.label}
        </Badge>
        {show && onAdd && (
          <button onClick={() => onAdd(data.join('\n'), section)} className="flex items-center gap-1 px-2 py-1 bg-white/80 rounded-lg text-[10px] font-bold border shadow-sm hover:bg-white">
            <Save className="h-3 w-3" /> SAVE
          </button>
        )}
      </div>
      <div className="space-y-1.5">
        {data.map((item, i) => (
          <div key={i} className="flex gap-2 items-start">
            <ChevronRight className={cn("h-4 w-4 flex-shrink-0 mt-0.5", c.colors.split(' ')[2])} />
            <span className="text-sm font-medium leading-relaxed">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ClinicalResponseRenderer({ content, className, isStreaming, onAddToPatient, showActions = true }: ClinicalResponseRendererProps) {
  const data = extractSections(content);
  const hasData = Object.keys(data).length > 0;

  if (!hasData) {
    return (
      <div className={cn("w-full", className)}>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
            {cleanMedicalText(content)}
          </div>
          {showActions && onAddToPatient && (
            <button onClick={() => onAddToPatient(content)} className="mt-4 flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-sm">
              <Plus className="h-4 w-4" /> ADD TO PATIENT
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("w-full space-y-4", className)}>
      {/* Header Bar */}
      {showActions && onAddToPatient && (
        <div className="flex items-center justify-between bg-gradient-to-r from-emerald-50 to-emerald-100/50 rounded-2xl p-4 border border-emerald-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
              <ClipboardCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-xs font-bold text-emerald-800 uppercase">GHS Protocol Match</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] text-emerald-700">Active Session</span>
                {isStreaming && <span className="text-[10px] text-emerald-600 animate-pulse">• Streaming</span>}
              </div>
            </div>
          </div>
          <button onClick={() => onAddToPatient(content, "all")} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-lg">
            <Database className="h-4 w-4" /> SAVE ALL
          </button>
        </div>
      )}

      {/* Section Cards */}
      <div className="space-y-3">
        {data.diagnosis && <SectionCard section="diagnosis" data={data.diagnosis} onAdd={onAddToPatient} show={showActions} />}
        {data.assessment && <SectionCard section="assessment" data={data.assessment} onAdd={onAddToPatient} show={showActions} />}
        {data.rationale && <SectionCard section="rationale" data={data.rationale} onAdd={onAddToPatient} show={showActions} />}
        {data.treatment && <SectionCard section="treatment" data={data.treatment} onAdd={onAddToPatient} show={showActions} />}
        {data["ghs recommendation"] && <SectionCard section="ghs recommendation" data={data["ghs recommendation"]} onAdd={onAddToPatient} show={showActions} />}
        {data.prescription && <SectionCard section="prescription" data={data.prescription} onAdd={onAddToPatient} show={showActions} />}
        {data.investigations && <SectionCard section="investigations" data={data.investigations} onAdd={onAddToPatient} show={showActions} />}
        {data["danger signs"] && (
          <div className="ring-2 ring-red-400 ring-offset-2 rounded-2xl">
            <SectionCard section="danger signs" data={data["danger signs"]} onAdd={onAddToPatient} show={showActions} />
          </div>
        )}
        {data.counseling && <SectionCard section="counseling" data={data.counseling} onAdd={onAddToPatient} show={showActions} />}
        {data.disclaimer && <SectionCard section="disclaimer" data={data.disclaimer} onAdd={onAddToPatient} show={showActions} />}
      </div>
    </div>
  );
}

export function formatClinicalResponseForDisplay(text: string): string {
  return cleanMedicalText(text);
}
