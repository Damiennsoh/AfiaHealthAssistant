import React, { useRef } from "react";
import {
  Printer,
  Hospital,
  User,
  Activity,
  AlertTriangle,
  X,
} from "lucide-react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import type { Patient, ReferralTrigger, VitalAlert } from "@/lib/db";

/**
 * Robust Referral System
 * FIX: Replaced custom UI component imports with standard Tailwind/HTML structures
 * to prevent "Element type is invalid: expected a string... but got: undefined" errors
 * which usually occur when @/components/ui/dialog or buttons are missing in the environment.
 */

/* Simple Local Dialog Implementation to ensure stability */
const CustomModal = ({ isOpen, onClose, children }: { isOpen: boolean; onClose: () => void; children: React.ReactNode }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 animate-in fade-in duration-300">
      <div className="relative w-full max-w-4xl max-h-[95vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {children}
      </div>
    </div>
  );
};

interface ReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
  triggers?: ReferralTrigger[];
  alerts?: VitalAlert[];
  encounterData: {
    complaint?: string;
    history?: string;
    vitals: {
      temperature?: string;
      bloodPressureSystolic?: string;
      bloodPressureDiastolic?: string;
      pulse?: string;
      respiratoryRate?: string;
      spO2?: string;
      weight?: string;
      height?: string;
    };
    treatment?: string;
    diagnosis?: string;
  };
  facilityInfo?: {
    referringFacility: string;
    receivingFacility: string;
    officerName: string;
  };
}

export function ReferralModal({
  isOpen,
  onClose,
  patient,
  triggers = [],
  alerts = [],
  encounterData,
  facilityInfo = {
    referringFacility: "CHPS Compound / Health Center",
    receivingFacility: "District/Regional Hospital",
    officerName: "Health Officer on Duty",
  },
}: ReferralModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  // Safety check for vitals to prevent parsing errors
  const safeVitals = {
    temp: encounterData?.vitals?.temperature || "N/A",
    bp: (encounterData?.vitals?.bloodPressureSystolic && encounterData?.vitals?.bloodPressureDiastolic)
      ? `${encounterData.vitals.bloodPressureSystolic}/${encounterData.vitals.bloodPressureDiastolic}`
      : "N/A",
    pulse: encounterData?.vitals?.pulse || "N/A",
    weight: encounterData?.vitals?.weight || "N/A",
    spo2: encounterData?.vitals?.spO2 || "N/A",
  };

  const handlePrint = async () => {
    if (!printRef.current) return;
    
    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: 800, // Forces A4 friendly layout
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`GHS_REFERRAL_${patient?.name?.toUpperCase().replace(/\s+/g, "_") || "PATIENT"}.pdf`);
    } catch (error) {
      console.error("PDF Generation failed:", error);
      window.print(); // Fallback to browser print
    }
  };

  return (
    <CustomModal isOpen={isOpen} onClose={onClose}>
      {/* Header (Friendly Sidebar on Mobile) */}
      <div className="bg-emerald-600 p-4 flex items-center justify-between text-white shrink-0 print:hidden">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-lg">
            <Hospital className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-tight leading-none mb-1">Clinical Referral</h3>
            <p className="text-[10px] opacity-80 leading-none">Ghana Health Service Standards</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-black/10 rounded-full transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Scrollable Preview Area */}
      <div className="flex-1 overflow-y-auto bg-slate-100 p-2 md:p-8 print:p-0 print:bg-white overflow-x-hidden">
        {/* THE PRINTABLE TEMPLATE */}
        <div 
          ref={printRef}
          className="bg-white mx-auto shadow-sm rounded-lg p-6 md:p-10 text-slate-800 max-w-[210mm] min-h-[297mm] print:shadow-none print:rounded-none print:p-0 print:m-0"
          id="ghs-referral-template"
        >
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-emerald-600 pb-6 mb-8">
            <div className="flex items-center gap-4">
              <div className="bg-emerald-600 text-white p-3 rounded-xl font-bold text-2xl shadow-lg ring-4 ring-emerald-50 shadow-emerald-200/50">GHS</div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-slate-900 uppercase tracking-wider">Clinical Referral Form</h1>
                <p className="text-xs md:text-sm font-medium text-emerald-700 uppercase tracking-widest leading-none mt-1">Official Clinical Record</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest">Date of Issue</p>
              <p className="text-sm md:text-base font-bold text-slate-900 leading-none mt-1">{new Date().toLocaleDateString("en-GH", { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            </div>
          </div>

          {/* Grid Content */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-8">
            {/* Patient Info */}
            <section>
              <h2 className="text-[10px] md:text-xs font-bold text-emerald-600 uppercase mb-3 flex items-center gap-2">
                <User className="h-3 w-3" /> Patient Particulars
              </h2>
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-2.5">
                <p className="text-sm"><strong>Full Name:</strong> {patient?.name || "N/A"}</p>
                <p className="text-sm"><strong>Age/Sex:</strong> {patient?.age || "N/A"} / {patient?.sex?.toUpperCase() || "N/A"}</p>
                <p className="text-sm"><strong>NHIS ID:</strong> {patient?.nhisNumber || "Not Provided"}</p>
              </div>
            </section>

            {/* Vitals */}
            <section>
              <h2 className="text-[10px] md:text-xs font-bold text-emerald-600 uppercase mb-3 flex items-center gap-2">
                <Activity className="h-3 w-3" /> Admission Vitals
              </h2>
              <div className="grid grid-cols-2 gap-2">
                <VitalItem label="TEMP" value={safeVitals.temp} />
                <VitalItem label="BP" value={safeVitals.bp} />
                <VitalItem label="PULSE" value={safeVitals.pulse} />
                <VitalItem label="SPO2" value={safeVitals.spo2} />
              </div>
            </section>
          </div>

          {/* Facility Info */}
          <div className="mb-8">
            <h2 className="text-[10px] md:text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
              <Hospital className="h-3 w-3" /> Transfer Details
            </h2>
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-2.5 text-sm">
              <p><strong>From:</strong> {facilityInfo.referringFacility}</p>
              <p><strong>To:</strong> {facilityInfo.receivingFacility || "________________________________"}</p>
            </div>
          </div>

          {/* Clinical Findings */}
          <section className="mb-8">
            <h2 className="text-[10px] md:text-xs font-bold text-emerald-600 uppercase mb-3 flex items-center gap-2">
              <AlertTriangle className="h-3 w-3" /> Clinical Findings & Referral Reason
            </h2>
            <div className="border-2 border-emerald-50 p-5 rounded-xl bg-emerald-50/20">
              <h3 className="text-[10px] font-bold text-emerald-800 mb-2 underline decoration-emerald-200 uppercase">Primary Trigger(s)</h3>
              <ul className="list-disc list-inside space-y-1 mb-4">
                {triggers.length > 0 ? triggers.map((t, i) => (
                  <li key={i} className="text-sm text-slate-800 font-medium">
                    {t.reason} ({t.actualValue})
                  </li>
                )) : (
                  <li className="text-sm text-slate-500 italic">Critical symptoms detected. Advanced management required.</li>
                )}
              </ul>
              
              <h3 className="text-[10px] font-bold text-emerald-800 mb-2 underline decoration-emerald-200 uppercase">Brief History</h3>
              <p className="text-sm text-slate-700 leading-relaxed line-clamp-6">
                {encounterData.complaint || encounterData.history || "No history provided."}
              </p>
            </div>
          </section>

          {/* Management */}
          <section className="mb-8 flex-1">
            <h2 className="text-[10px] md:text-xs font-bold text-slate-400 uppercase mb-3">Management/Treatments Given</h2>
            <div className="border border-slate-200 p-5 rounded-xl min-h-[120px] text-sm leading-relaxed italic text-slate-600 bg-slate-50/30">
              {encounterData.treatment || "Standard stabilization treatment."}
            </div>
          </section>

          {/* Signatures */}
          <div className="mt-8 pt-8 border-t border-dashed border-slate-200 grid grid-cols-2 gap-10">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-8">Referring Officer Signature</p>
              <div className="border-b border-slate-400 pb-1 flex justify-between items-end">
                <span className="text-sm font-bold text-slate-800">{facilityInfo.officerName}</span>
                <span className="text-[10px] text-slate-400 italic font-medium">Medical Personnel</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-tighter">ID: REF-{Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
            </div>
            <div className="flex flex-col items-end">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Official Stamp</p>
              <div className="w-24 h-24 md:w-32 md:h-32 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center text-center p-2">
                <span className="text-[8px] md:text-[10px] text-slate-300 font-bold uppercase tracking-widest">OFFICIAL STAMP HERE</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Buttons */}
      <div className="p-4 bg-white border-t border-slate-200 flex flex-col md:flex-row gap-3 shrink-0 print:hidden">
        <button 
          onClick={onClose}
          className="flex-1 h-12 md:h-14 rounded-xl border-2 border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-colors order-2 md:order-1"
        >
          Close Preview
        </button>
        <button 
          onClick={handlePrint}
          className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-12 md:h-14 font-bold flex items-center justify-center gap-2 order-1 md:order-2 shadow-lg shadow-emerald-200 transition-all active:scale-[0.98]"
        >
          <Printer className="h-5 w-5" />
          Print / Export PDF
        </button>
      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #ghs-referral-template, #ghs-referral-template * {
            visibility: visible !important;
          }
          #ghs-referral-template {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </CustomModal>
  );
}

function VitalItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-2 text-center shadow-sm">
      <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase leading-none mb-1">{label}</p>
      <p className="text-[12px] md:text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}
