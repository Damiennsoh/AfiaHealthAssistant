"use client"

import { Printer, Download, Share2, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ReferralNoteProps {
  data: {
    referringFacility: string;
    receivingFacility: string;
    patientName: string;
    age: string;
    gender: string;
    nhisNumber: string;
    history: string;
    vitals: { bp: string; temp: string; pulse: string; weight: string };
    treatmentGiven: string;
    reason: string;
    officerName: string;
  }
}

export default function ReferralNote({ data }: ReferralNoteProps) {
  return (
    <div className="max-w-3xl mx-auto bg-white shadow-xl border border-slate-200 rounded-xl overflow-hidden print:shadow-none print:border-none">
      {/* Header with GHS Aesthetic */}
      <div className="bg-emerald-600 p-6 text-white flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight uppercase">Referral Note</h2>
          <p className="text-emerald-100 text-xs font-medium italic">Afia Health Assistant • Clinical Document</p>
        </div>
        <FileText className="h-10 w-10 opacity-50" />
      </div>

      <div className="p-8 space-y-6 text-slate-800">
        {/* Section 1: Logistics */}
        <div className="grid grid-cols-2 gap-6 pb-6 border-b border-slate-100 text-sm">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">From (Facility)</label>
            <p className="font-semibold">{data.referringFacility}</p>
          </div>
          <div className="text-right">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">To (Facility)</label>
            <p className="font-semibold text-emerald-700">{data.receivingFacility}</p>
          </div>
        </div>

        {/* Section 2: Patient Bio-data */}
        <div className="bg-slate-50 p-4 rounded-lg grid grid-cols-3 gap-4 border border-slate-100">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase">Patient Name</label>
            <p className="font-bold">{data.patientName}</p>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase">Age/Gender</label>
            <p className="font-medium">{data.age} yrs • {data.gender}</p>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase">NHIS Number</label>
            <p className="font-medium">{data.nhisNumber || "N/A"}</p>
          </div>
        </div>

        {/* Section3: Clinical Findings */}
        <div className="space-y-4">
          <div>
            <h4 className="text-xs font-bold text-emerald-700 uppercase border-b border-emerald-100 pb-1 mb-2">Clinical History & Findings</h4>
            <p className="text-sm leading-relaxed">{data.history}</p>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {Object.entries(data.vitals).map(([key, value]) => (
              <div key={key} className="bg-white border border-slate-200 p-2 rounded text-center">
                <label className="block text-[9px] font-bold text-slate-400 uppercase">{key}</label>
                <p className="text-sm font-bold">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: Treatment & Reason */}
        <div className="grid grid-cols-2 gap-6 pt-4">
          <div className="p-4 bg-amber-50 rounded-lg border border-amber-100">
            <h4 className="text-xs font-bold text-amber-800 uppercase mb-2">Pre-referral Treatment</h4>
            <p className="text-xs italic text-amber-900">{data.treatmentGiven}</p>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
            <h4 className="text-xs font-bold text-blue-800 uppercase mb-2">Reason for Referral</h4>
            <p className="text-xs italic text-blue-900">{data.reason}</p>
          </div>
        </div>

        {/* Footer: Authentication */}
        <div className="pt-10 flex justify-between items-end border-t border-slate-100">
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-bold">Authorized Officer</p>
            <p className="font-bold text-slate-700 border-b border-slate-300 w-48 mt-1">{data.officerName}</p>
          </div>
          <div className="text-right">
             <p className="text-[10px] text-slate-400 font-bold uppercase">Digital Signature ID</p>
             <p className="text-[10px] font-mono text-slate-400 uppercase">AFIA-GHS-{Math.random().toString(36).substring(7).toUpperCase()}</p>
          </div>
        </div>
      </div>

      {/* Action Bar (Hidden in Print) */}
      <div className="bg-slate-50 p-4 flex justify-end gap-2 border-t border-slate-200 print:hidden">
        <Button variant="outline" size="sm" className="gap-2">
          <Share2 className="h-4 w-4" /> Share
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print PDF
        </Button>
        <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700">
          <Download className="h-4 w-4" /> Export for S3
        </Button>
      </div>
    </div>
  )
}
