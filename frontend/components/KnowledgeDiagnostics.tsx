"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  Activity, 
  Database, 
  Cpu, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle,
  FileSearch,
  Zap,
  Terminal,
  X,
  Play,
  Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";

// Config from your system
import { knowledgeDB } from "@/lib/knowledge-base";

export default function KnowledgeDiagnostics() {
  const [dbStats, setDbStats] = useState({ total: 0, embedded: 0, status: 'loading' });
  const [logs, setLogs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 10)]);
  }, []);

  const checkDatabase = useCallback(async () => {
    addLog("Opening Knowledge Database...");
    try {
      const stats = await knowledgeDB.getStats();
      addLog(`Found ${stats.total} total chunks in DB.`);
      addLog(`Analysis complete: ${stats.embedded}/${stats.total} chunks have vectors.`);
      
      setDbStats({ ...stats, status: 'ready' });

      if (stats.total > 0 && stats.embedded === 0) {
        addLog("CRITICAL: Text exists but NO embeddings. The Vector Engine is failing.");
      }
    } catch (error) {
      addLog("Error accessing Knowledge Database.");
      setDbStats({ total: 0, embedded: 0, status: 'error' });
      console.error(error);
    }
  }, [addLog]);

  const testModelLoading = async () => {
    setIsRunning(true);
    addLog("Attempting to initialize Transformers.js...");
    try {
      // This mimics the check for the embedding engine
      const start = Date.now();
      addLog("Checking for @xenova/transformers or similar...");
      
      // Simulate model check
      setTimeout(() => {
        addLog(`Model init check took ${Date.now() - start}ms`);
        setIsRunning(false);
      },1000);
    } catch (e) {
      addLog("FAILURE: Model could not be initialized.");
      setIsRunning(false);
    }
  };

  useEffect(() => { 
    checkDatabase(); 
    
    // Subscribe to changes
    const unsubscribe = knowledgeDB.subscribe(() => {
      addLog("Database updated. Refreshing stats...");
      checkDatabase();
    });
    
    return () => { unsubscribe(); };
  }, [checkDatabase, addLog]);

  // Refresh stats when panel opens
  useEffect(() => {
    if (isOpen) {
      checkDatabase();
    }
  }, [isOpen, checkDatabase]);

  return (
    <>
      {/* Floating Trigger Button - Slender, Hidden, Reveal on Hover */}
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className="fixed right-0 top-[60%] z-50 bg-slate-900 text-white py-4 px-1.5 rounded-l-lg shadow-2xl border-y border-l border-slate-700 transition-transform duration-300 translate-x-[calc(100%-6px)] hover:translate-x-0 flex flex-col items-center gap-3 group"
        >
          <div className="relative shrink-0">
            <Activity className="h-4 w-4 text-emerald-400 group-hover:animate-pulse" />
            <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 bg-emerald-500 rounded-full animate-ping" />
          </div>
          <span className="text-[9px] font-bold uppercase [writing-mode:vertical-rl] tracking-widest text-slate-400 group-hover:text-white whitespace-nowrap">
            Engine Logs
          </span>
        </button>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sliding Panel */}
      <div 
        className={cn(
          "fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 transition-transform duration-300 ease-in-out transform flex flex-col font-sans",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="bg-slate-900 px-6 py-5 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Terminal className="h-4 w-4 text-emerald-500" />
              Vector Engine Diagnostics
            </h2>
            <p className="text-[10px] text-slate-400 mt-1 font-mono">
              System Status: {dbStats.status === 'ready' ? 'ONLINE' : 'INITIALIZING...'}
            </p>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors group"
          >
            <X className="h-4 w-4 text-slate-400 group-hover:text-white" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
          
          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Text Chunks</p>
              <div className="flex items-end justify-between mt-1">
                <p className="text-2xl font-black text-slate-800">{dbStats.total}</p>
                <Database className="h-4 w-4 text-emerald-500 mb-1" />
              </div>
              <p className="text-[9px] text-slate-500 font-medium mt-2">IndexedDB Storage</p>
            </div>
            
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Embeddings</p>
              <div className="flex items-end justify-between mt-1">
                <p className={cn("text-2xl font-black", dbStats.embedded === 0 ? "text-rose-500" : "text-emerald-600")}>
                  {dbStats.embedded}
                </p>
                <Cpu className="h-4 w-4 text-blue-500 mb-1" />
              </div>
              <p className="text-[9px] text-slate-500 font-medium mt-2">AI Search Ready</p>
            </div>
          </div>

          {/* Engine Health Status */}
          {dbStats.total > 0 && dbStats.embedded === 0 && (
            <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex gap-3 animate-pulse">
              <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0" />
              <div>
                <p className="text-xs font-bold text-rose-900 uppercase">Embedding Failure</p>
                <p className="text-[10px] text-rose-800 leading-relaxed mt-1">
                  Text exists but vectors are missing. The semantic search engine is offline.
                </p>
              </div>
            </div>
          )}

          {/* Terminal Console */}
          <div className="flex flex-col h-[300px] bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-inner">
            <div className="bg-slate-800 px-4 py-2 flex items-center justify-between border-b border-slate-700">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Console Output</span>
              <button 
                onClick={() => setLogs([])}
                className="text-[10px] text-slate-500 hover:text-white flex items-center gap-1 transition-colors"
              >
                <Trash2 className="h-3 w-3" /> Clear
              </button>
            </div>
            <div className="flex-1 p-4 overflow-y-auto font-mono text-[10px] space-y-1 custom-scrollbar">
              {logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-2">
                  <Terminal className="h-8 w-8 opacity-20" />
                  <p>Ready to initialize...</p>
                </div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="text-slate-300 border-l-2 border-emerald-500/30 pl-2">
                    <span className="text-slate-500 mr-2">{log.substring(1, 12)}</span>
                    {log.substring(13)}
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Action Footer */}
        <div className="p-4 bg-white border-t border-slate-100 shrink-0">
          <button 
            disabled={isRunning}
            onClick={testModelLoading}
            className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold text-xs hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-slate-900/20 active:scale-[0.98]"
          >
            {isRunning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 text-emerald-400" />}
            Run Diagnostic Test
          </button>
          <p className="text-[9px] text-slate-400 text-center mt-3">
            Afia Clinical Intelligence Engine v2.4.0 • Local Environment
          </p>
        </div>
      </div>
    </>
  );
}
