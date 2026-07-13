"use client";

import React, { useState, useEffect } from "react";
import { 
  FileSpreadsheet, 
  CheckCircle2,
  RefreshCcw,
  ShieldAlert,
  FileArchive,
  BarChart3,
  Users,
  TrendingUp,
  Stethoscope,
  Calendar,
  ChevronLeft,
  ChevronRight,
  UploadCloud,
  DownloadCloud,
  History,
  AlertCircle,
  Lock,
  Unlock
} from "lucide-react";

import CryptoJS from "crypto-js";
import { useAuth } from "@/contexts/AfiaAuthContext";
import { 
  patientDB, encounterDB, aiRequestDB, uploadDB, userDB, metadataDB 
} from "@/lib/db";

// Correct database configuration - single database with multiple stores
const DB_NAME = "afia-health-db";
const DB_VERSION = 4;

interface BackupData {
  app: string;
  version: string;
  timestamp: string;
  dbVersion: number;
  payload: {
    patients: any[];
    encounters: any[];
    aiRequests: any[];
    uploads: any[];
    metadata: any[];
    users: any[];
  };
}

export default function DataUtility() {
  const { can } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<{msg: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [password, setPassword] = useState("");
  const [useEncryption, setUseEncryption] = useState(false);

  useEffect(() => {
    generateQuickStats(selectedDate);

    // Subscribe to changes for real-time updates
    const unsubPatients = patientDB.subscribe(() => generateQuickStats(selectedDate));
    const unsubEncounters = encounterDB.subscribe(() => generateQuickStats(selectedDate));

    return () => {
      unsubPatients();
      unsubEncounters();
    };
  }, [selectedDate]);

  const generateQuickStats = async (dateStr: string) => {
    const encounters = await encounterDB.getAll();
    const patients = await patientDB.getAll();

    // 1. Calculate Total Patients (Total Records)
    const totalPatients = patients.length;

    // 2. Calculate Patients Registered Today
    // Check createdAt field for date match
    const patientsRegisteredToday = patients.filter((p: any) => {
      if (!p.createdAt) return false;
      return p.createdAt.split('T')[0] === dateStr;
    }).length;

    // 3. Keep Top Case logic based on encounters (as it's about diseases/cases)
    const diagnoses: Record<string, number> = {};
    encounters.forEach((enc: any) => {
      if (enc.diagnosis) {
        diagnoses[enc.diagnosis] = (diagnoses[enc.diagnosis] || 0) + 1;
      }
    });

    const top10 = Object.entries(diagnoses)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    setStats({
      total: totalPatients,
      dayCount: patientsRegisteredToday,
      dayEncounters: encounters.filter((e: any) => e.date === dateStr).length, // Kept for reference if needed, though not displayed in the requested slots
      top10
    });
  };

  const changeDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  // --- SYSTEM BACKUP (.afia) ---
  const handleSystemBackup = async () => {
    // Check permission for backup creation
    if (!can('backup:create')) {
      setStatus({ msg: "Access Denied: Only administrators can create backups", type: 'error' });
      return;
    }

    if (useEncryption && !password) {
      setStatus({ msg: "Please enter a password for encryption", type: 'error' });
      return;
    }

    setIsProcessing(true);
    setStatus({ msg: useEncryption ? "Encrypting system backup..." : "Creating system backup...", type: 'info' });
    try {
      const backupData: BackupData = {
        app: "Afia CHPS",
        version: "1.0",
        timestamp: new Date().toISOString(),
        dbVersion: DB_VERSION,
        payload: {
          patients: await patientDB.getAll(),
          encounters: await encounterDB.getAll(),
          aiRequests: await aiRequestDB.getAll(),
          uploads: await uploadDB.getAll(),
          metadata: await metadataDB.getAll(),
          users: await userDB.getAll(),
        }
      };

      let fileContent: string;
      
      if (useEncryption) {
        // Encrypt the entire JSON string
        const jsonString = JSON.stringify(backupData);
        const encrypted = CryptoJS.AES.encrypt(jsonString, password).toString();
        
        // Create a wrapper object
        const wrapper = {
          app: "Afia CHPS",
          encrypted: true,
          content: encrypted,
          timestamp: new Date().toISOString()
        };
        fileContent = JSON.stringify(wrapper, null, 2);
      } else {
        fileContent = JSON.stringify(backupData, null, 2);
      }

      const blob = new Blob([fileContent], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const date = new Date().toISOString().split("T")[0];
      const patientCount = backupData.payload.patients.length;
      const encounterCount = backupData.payload.encounters.length;
      
      link.href = url;
      // Add .enc suffix if encrypted to indicate security
      link.download = `AFIA_BACKUP_${date}_${patientCount}p_${encounterCount}e${useEncryption ? '_SECURE' : ''}.afia`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus({ msg: `Backup saved: ${patientCount} patients, ${encounterCount} encounters`, type: 'success' });
    } catch (err) {
      console.error(err);
      setStatus({ msg: "Could not save data", type: 'error' });
    } finally { setIsProcessing(false); }
  };

  // --- RESTORE FROM .afia FILE ---
  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check permission for backup restore
    if (!can('backup:restore')) {
      setStatus({ msg: "Access Denied: Only administrators can restore backups", type: 'error' });
      return;
    }

    setIsProcessing(true);
    setStatus({ msg: "Reading file...", type: 'info' });

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const fileContent = event.target?.result as string;
        let backup: BackupData;
        let parsed: any;

        try {
          parsed = JSON.parse(fileContent);
        } catch (e) {
          throw new Error("Invalid file format");
        }

        // Check if encrypted
        if (parsed.encrypted && parsed.content) {
          if (!password) {
            setStatus({ msg: "File is encrypted. Please enter password above and try again.", type: 'error' });
            setIsProcessing(false);
            return;
          }

          try {
            setStatus({ msg: "Decrypting data...", type: 'info' });
            const bytes = CryptoJS.AES.decrypt(parsed.content, password);
            const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
            
            if (!decryptedString) throw new Error("Decryption failed");
            
            backup = JSON.parse(decryptedString);
          } catch (e) {
            setStatus({ msg: "Incorrect password or corrupted file", type: 'error' });
            setIsProcessing(false);
            return;
          }
        } else {
          // Standard unencrypted backup
          backup = parsed;
        }

        if (backup.app !== "Afia CHPS") throw new Error("Invalid Afia backup file");
        
        setStatus({ msg: "Restoring database...", type: 'info' });

        // Open database and restore each store
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onsuccess = () => {
          const db = request.result;
          
          const restoreStore = (storeName: string, data: any[]) => {
            return new Promise<void>((resolve) => {
              if (!db.objectStoreNames.contains(storeName) || !data || data.length === 0) {
                resolve();
                return;
              }
              
              const tx = db.transaction(storeName, "readwrite");
              const store = tx.objectStore(storeName);
              
              // Clear existing data
              store.clear();
              
              // Add all records
              let completed = 0;
              for (const item of data) {
                const putRequest = store.put(item);
                putRequest.onsuccess = () => {
                  completed++;
                  if (completed === data.length) resolve();
                };
                putRequest.onerror = () => {
                  completed++;
                  if (completed === data.length) resolve();
                };
              }
            });
          };
          
          // Restore all stores
          Promise.all([
            restoreStore("patients", backup.payload.patients),
            restoreStore("encounters", backup.payload.encounters),
            restoreStore("aiRequests", backup.payload.aiRequests),
            restoreStore("uploads", backup.payload.uploads),
            restoreStore("metadata", backup.payload.metadata),
            restoreStore("users", backup.payload.users),
          ]).then(() => {
            setStatus({ msg: "Data restored successfully!", type: 'success' });
            generateQuickStats(selectedDate);
            setTimeout(() => window.location.reload(), 1500);
          });
        };
        request.onerror = () => {
          setStatus({ msg: "Failed to open database", type: 'error' });
          setIsProcessing(false);
        };
      } catch (err) {
        setStatus({ msg: "Error: Use a valid .afia file", type: 'error' });
        setIsProcessing(false);
      }
    };
    reader.readAsText(file);
  };

  // --- GHS REPORT EXPORT ---
  const handleGHSReport = async () => {
    setIsProcessing(true);
    setStatus({ msg: "Generating Report...", type: 'info' });
    try {
      const patients = await patientDB.getAll();
      const encounters = await encounterDB.getAll();
      
      if (patients.length === 0) {
        throw new Error("No patients found");
      }

      // Create comprehensive CSV with patient and encounter data
      const headers = [
        "Folder Number", "Patient Name", "Age", "Sex", 
        "Region", "Community", "Phone", "NHIS Number", "Has NHIS",
        "Total Encounters", "Latest Diagnosis", "Latest Encounter Date",
        "All Diagnoses (History)", "All Drugs Prescribed"
      ];
      
      const rows: any[] = [];
      
      // For each patient, find their encounters and create summary row
      for (const patient of patients) {
        const patientEncounters = encounters.filter((e: any) => e.patientId === patient.id);
        const totalEncounters = patientEncounters.length;
        
        // Get latest encounter
        const sortedEncounters = patientEncounters.sort((a: any, b: any) => 
          new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime()
        );
        const latestEncounter = sortedEncounters[0];
        
        // Collect all diagnoses
        const allDiagnoses = patientEncounters
          .map((e: any) => e.diagnosis)
          .filter((d: string) => d && d !== "Pending")
          .join("; ");
        
        // Collect all drugs
        const allDrugs = patientEncounters
          .flatMap((e: any) => e.drugs || [])
          .map((d: any) => d.drugName)
          .filter((d: string) => d)
          .join("; ");
        
        rows.push([
          patient.folderNumber || "N/A",
          patient.name || "N/A",
          patient.age || "N/A",
          patient.sex || "N/A",
          patient.region || "N/A",
          patient.community || "N/A",
          patient.phone || "N/A",
          patient.nhisNumber || "N/A",
          patient.hasNHIS ? "Yes" : "No",
          totalEncounters,
          latestEncounter?.diagnosis || "N/A",
          latestEncounter ? new Date(latestEncounter.date || latestEncounter.createdAt).toLocaleDateString() : "N/A",
          allDiagnoses || "None",
          allDrugs || "None"
        ]);
      }

      const csvContent = [headers, ...rows].map(row => 
        row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      ).join("\n");
      
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `GHS_Monthly_Report_${new Date().getMonth() + 1}_${new Date().getFullYear()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus({ msg: `Report downloaded: ${patients.length} patients`, type: 'success' });
    } catch (e) { 
      const errorMsg = e instanceof Error ? e.message : "Export failed";
      setStatus({ msg: errorMsg, type: 'error' }); 
    } finally { setIsProcessing(false); }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6 bg-[#f8faf9] min-h-screen pb-24">
      
      {/* Date Navigation Header */}
      <div className="bg-[#064e3b] text-white p-6 rounded-[2.5rem] shadow-2xl flex items-center justify-between border-b-4 border-emerald-900/30">
        <button onClick={() => changeDate(-1)} className="p-3 bg-white/10 hover:bg-white/20 active:scale-90 rounded-full transition-all">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="h-4 w-4 text-emerald-400" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300/80">OPD Attendance Log</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight">
            {selectedDate === new Date().toISOString().split('T')[0] ? "Today" : selectedDate}
          </h2>
        </div>
        <button onClick={() => changeDate(1)} className="p-3 bg-white/10 hover:bg-white/20 active:scale-90 rounded-full transition-all">
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>

      {/* Analytics Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-[2rem] border-b-4 border-emerald-100 shadow-sm flex flex-col items-center text-center">
          <div className="bg-emerald-50 p-3 rounded-2xl mb-3 text-emerald-700">
            <Users className="h-6 w-6" />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Patients Recorded Today</p>
          <p className="text-3xl font-black text-[#064e3b]">{stats?.dayCount || 0}</p>
        </div>
        <div className="bg-white p-5 rounded-[2rem] border-b-4 border-emerald-100 shadow-sm flex flex-col items-center text-center">
          <div className="bg-emerald-50 p-3 rounded-2xl mb-3 text-emerald-700">
            <TrendingUp className="h-6 w-6" />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Records</p>
          <p className="text-3xl font-black text-[#064e3b]">{stats?.total || 0}</p>
        </div>
        <div className="hidden md:flex bg-white p-5 rounded-[2rem] border-b-4 border-emerald-100 shadow-sm flex-col items-center text-center">
          <div className="bg-emerald-50 p-3 rounded-2xl mb-3 text-emerald-700">
            <History className="h-6 w-6" />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Top Case</p>
          <p className="text-sm font-black text-[#064e3b] truncate max-w-full">{stats?.top10?.[0]?.[0] || "No Data"}</p>
        </div>
      </div>

      {/* Main Actions Container */}
      <div className="bg-white rounded-[2.5rem] p-6 shadow-xl border border-slate-100 space-y-4">
        <div className="px-2">
          <h3 className="text-lg font-black text-slate-800">Storage & Reports</h3>
          <p className="text-xs font-medium text-slate-400 italic">Manage clinical information safely</p>
        </div>

        {/* Security Controls */}
        <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-xl ${useEncryption ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                {useEncryption ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-700">Encryption</h4>
                <p className="text-[10px] text-slate-400 font-medium">Protect backup with password</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={useEncryption} onChange={(e) => setUseEncryption(e.target.checked)} className="sr-only peer" />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>
          
          {(useEncryption || password) && (
            <div className="animate-in slide-in-from-top-2">
              <input
                type="password"
                placeholder="Enter encryption password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
              <p className="mt-2 text-[10px] text-slate-400 italic">
                {useEncryption 
                  ? "Required for both backup and restore of encrypted files." 
                  : "Enter password if restoring an encrypted file."}
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4">
          {/* Export Report */}
          <button
            onClick={handleGHSReport}
            disabled={isProcessing}
            className="flex items-center gap-5 p-5 bg-emerald-50 border-2 border-emerald-100 rounded-3xl hover:bg-emerald-100 transition-all group disabled:opacity-50"
          >
            <div className="bg-white p-4 rounded-2xl shadow-sm text-emerald-600 group-hover:scale-110 transition-transform">
              <FileSpreadsheet className="h-7 w-7" />
            </div>
            <div className="text-left">
              <span className="block font-black text-emerald-900 text-lg">Download Monthly Report</span>
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest leading-none">For Excel / GHS Directorate</span>
            </div>
          </button>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Backup */}
            <button
              onClick={handleSystemBackup}
              disabled={isProcessing}
              className="flex items-center gap-4 p-5 bg-[#064e3b] rounded-3xl hover:bg-emerald-900 transition-all text-white shadow-lg shadow-emerald-200 disabled:opacity-50"
            >
              <DownloadCloud className="h-6 w-6 shrink-0 opacity-80" />
              <div className="text-left">
                <span className="block font-black text-md">Save All Data</span>
                <span className="text-[9px] font-bold text-emerald-300 uppercase tracking-widest">Backup to USB (.afia)</span>
              </div>
            </button>

            {/* Restore */}
            <label className="flex items-center gap-4 p-5 bg-white border-2 border-slate-100 rounded-3xl hover:border-emerald-500 transition-all cursor-pointer group disabled:opacity-50">
              <input type="file" accept=".afia" onChange={handleRestore} disabled={isProcessing} className="hidden" />
              <UploadCloud className="h-6 w-6 shrink-0 text-emerald-600 group-hover:animate-bounce" />
              <div className="text-left">
                <span className="block font-black text-md text-slate-800">Load Saved Data</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Restore from USB (.afia)</span>
              </div>
            </label>
          </div>
        </div>

        {/* Status Messenger */}
        {status && (
          <div className={`mt-4 p-4 rounded-2xl flex items-center justify-center gap-3 text-[11px] font-black uppercase tracking-widest animate-in slide-in-from-top-2 ${
            status.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-white'
          }`}>
            {status.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <RefreshCcw className="h-4 w-4 animate-spin" />}
            {status.msg}
          </div>
        )}
      </div>

      {/* Morbidity Preview Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 p-2 rounded-xl">
              <BarChart3 className="h-5 w-5 text-emerald-700" />
            </div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Common Diseases</h3>
          </div>
          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Live Summary</span>
        </div>

        {stats?.top10?.length > 0 ? (
          <div className="space-y-3">
            {stats.top10.slice(0, 5).map(([name, count]: any, idx: number) => (
              <div key={idx} className="flex items-center gap-4 group">
                <span className="text-[11px] font-black text-slate-200">0{idx+1}</span>
                <div className="flex-1 bg-slate-50 h-12 rounded-2xl flex items-center px-5 justify-between border border-transparent group-hover:border-emerald-100 group-hover:bg-white transition-all">
                  <span className="text-xs font-bold text-slate-600">{name}</span>
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                    <span className="text-xs font-black text-[#064e3b]">{count} cases</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10">
            <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Stethoscope className="h-6 w-6 text-slate-200" />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No cases found for this date</p>
          </div>
        )}
      </div>

      {/* Nurse Safety Notice */}
      <div className="bg-[#fffbeb] border-2 border-[#fef3c7] p-6 rounded-[2rem] flex items-start gap-5">
        <div className="bg-amber-100 p-3 rounded-2xl text-amber-600 shrink-0">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div>
          <h4 className="text-xs font-black text-amber-900 uppercase tracking-widest mb-1">Privacy Reminder</h4>
          <p className="text-[11px] text-amber-800 leading-relaxed font-bold italic">
            Patient information is sensitive. If you save a report to Excel, print it for the District Office and then delete the file from your computer&apos;s downloads folder.
          </p>
        </div>
      </div>
    </div>
  );
}
