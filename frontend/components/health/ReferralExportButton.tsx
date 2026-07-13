"use client";

import React from "react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { FileUp, Printer } from "lucide-react";

interface ReferralData {
  patientName: string;
  age: string;
  nhisNumber: string;
  vitals: { temp: string; bp: string; weight: string };
  assessment: string;
  referralReason: string;
}

export default function ReferralExportButton({ data }: { data: ReferralData }) {
  const handleExport = async () => {
    const element = document.getElementById("ghs-referral-template");
    if (!element) return;

    // Render the hidden template to a canvas then export to PDF
    const canvas = await html2canvas(element, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF("p", "mm", "a4");
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`GHS_Referral_${data.patientName.replace(/\s+/g, "_")}.pdf`);
  };

  return (
    <>
      <button 
        onClick={handleExport}
        className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-colors"
      >
        <Printer size={20} />
        Generate GHS Referral Note
      </button>

      {/* Hidden Template for PDF Generation */}
      <div className="hidden" aria-hidden>
        <div id="ghs-referral-template" className="p-10 w-[210mm] bg-white text-black font-sans">
          <div className="text-center border-b-2 border-black pb-4 mb-6">
            <h1 className="text-2xl font-bold uppercase">Ghana Health Service</h1>
            <h2 className="text-xl">Official Referral Note</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div>
              <p><strong>To:</strong> Medical Officer In-Charge</p>
              <p><strong>Facility:</strong> District/Regional Hospital</p>
            </div>
            <div className="text-right">
              <p><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
              <p><strong>NHIS #:</strong> {data.nhisNumber}</p>
            </div>
          </div>

          <div className="space-y-4 border p-4 rounded-md">
            <h3 className="font-bold border-b">Patient Information</h3>
            <p><strong>Name:</strong> {data.patientName} ({data.age} years)</p>
            <p><strong>Clinical Condition:</strong> {data.assessment}</p>
            <p><strong>Vitals:</strong> T: {data.vitals.temp}°C | BP: {data.vitals.bp} | Wt: {data.vitals.weight}kg</p>
          </div>

          <div className="mt-6">
            <h3 className="font-bold border-b">Reason for Referral</h3>
            <p className="mt-2 min-h-[100px]">{data.referralReason}</p>
          </div>

          <div className="mt-20 flex justify-between pt-10 border-t border-dashed">
            <div className="text-center w-40 border-t border-black">Clinician Signature</div>
            <div className="text-center w-40 border-t border-black">Facility Stamp</div>
          </div>
        </div>
      </div>
    </>
  );
}
