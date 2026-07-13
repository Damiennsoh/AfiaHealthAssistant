"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dbCleanup, uploadDB, aiRequestDB } from "@/lib/db";
import { toast } from "sonner";
import { Activity, Database, Server, X, RefreshCw, Trash2, HardDrive, Bot, Upload, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface DatabaseDebugProps {
  minimized?: boolean;
}

export function DatabaseDebug({ minimized = false }: DatabaseDebugProps) {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [uploads, setUploads] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const loadDebugInfo = async () => {
    setLoading(true);
    try {
      const info = await dbCleanup.getDebugCounts();
      const uploadList = await uploadDB.getAll();
      setDebugInfo(info);
      setUploads(uploadList as any[]);
    } catch (error) {
      console.error("Error loading debug info:", error);
      toast.error("Failed to load debug information");
    } finally {
      setLoading(false);
    }
  };

  const clearStuckTasks = async () => {
    setLoading(true);
    try {
      const clearedAI = await dbCleanup.clearStuckAIRequests();
      const clearedUploads = await dbCleanup.clearFailedUploads();
      
      toast.success(`Cleared ${clearedAI} stuck AI requests and ${clearedUploads} failed uploads`);
      await loadDebugInfo(); // Refresh the debug info
    } catch (error) {
      console.error("Error clearing stuck tasks:", error);
      toast.error("Failed to clear stuck tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial load
    if (!minimized || isOpen) {
      loadDebugInfo();
      
      // Subscribe to DB changes
      const unsubAI = aiRequestDB.subscribe(() => {
        if (!minimized || isOpen) loadDebugInfo();
      });
      const unsubUpload = uploadDB.subscribe(() => {
        if (!minimized || isOpen) loadDebugInfo();
      });
      
      return () => {
        if (unsubAI) unsubAI();
        if (unsubUpload) unsubUpload();
      };
    }
  }, [minimized, isOpen]);

  const Content = () => (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-sm text-muted-foreground mb-2 flex items-center gap-2">
          <Bot className="h-4 w-4" /> AI Requests
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-muted/30 p-3 rounded-lg border border-border/50">
          <div className="flex justify-between"><span>Total:</span> <span className="font-mono font-bold">{debugInfo?.aiRequests.total}</span></div>
          <div className="flex justify-between"><span>Queued:</span> <span className="font-mono font-bold text-yellow-600">{debugInfo?.aiRequests.queued}</span></div>
          <div className="flex justify-between"><span>Processing:</span> <span className="font-mono font-bold text-blue-600">{debugInfo?.aiRequests.processing}</span></div>
          <div className="flex justify-between"><span>Completed:</span> <span className="font-mono font-bold text-green-600">{debugInfo?.aiRequests.completed}</span></div>
          <div className="flex justify-between"><span>Failed:</span> <span className="font-mono font-bold text-red-600">{debugInfo?.aiRequests.failed}</span></div>
        </div>
      </div>
      
      <div>
        <h3 className="font-semibold text-sm text-muted-foreground mb-2 flex items-center gap-2">
          <Upload className="h-4 w-4" /> Upload Tasks
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-muted/30 p-3 rounded-lg border border-border/50">
          <div className="flex justify-between"><span>Total:</span> <span className="font-mono font-bold">{debugInfo?.uploads.total}</span></div>
          <div className="flex justify-between"><span>Pending:</span> <span className="font-mono font-bold text-yellow-600">{debugInfo?.uploads.pending}</span></div>
          <div className="flex justify-between"><span>Uploading:</span> <span className="font-mono font-bold text-blue-600">{debugInfo?.uploads.uploading}</span></div>
          <div className="flex justify-between"><span>Uploaded:</span> <span className="font-mono font-bold text-green-600">{debugInfo?.uploads.uploaded}</span></div>
          <div className="flex justify-between"><span>Failed:</span> <span className="font-mono font-bold text-red-600">{debugInfo?.uploads.failed}</span></div>
        </div>
      </div>
      
      <div className="pt-4 border-t flex flex-col gap-3">
        {/* Upload List Section */}
        {uploads.length > 0 && (
          <div className="bg-slate-100 rounded-lg p-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
              <FileText className="h-3 w-3" /> Recent Files
            </h4>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
              {uploads.slice(0, 10).map((it) => (
                <div key={it.id} className="flex items-center gap-2 bg-white p-2 rounded border border-slate-200 text-xs">
                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded bg-slate-100 border border-slate-200">
                    {it.blob ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={URL.createObjectURL(it.blob)} alt={it.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <FileText className="h-4 w-4 text-slate-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate text-slate-700">{it.name}</div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1">
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        it.status === 'uploaded' ? "bg-green-500" :
                        it.status === 'uploading' ? "bg-blue-500 animate-pulse" :
                        it.status === 'failed' ? "bg-red-500" : "bg-yellow-500"
                      )} />
                      {it.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            <strong>Active Tasks:</strong> {
              (debugInfo?.aiRequests.queued || 0) + 
              (debugInfo?.aiRequests.processing || 0) + 
              (debugInfo?.uploads.pending || 0) + 
              (debugInfo?.uploads.uploading || 0)
            }
          </p>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button 
              onClick={loadDebugInfo} 
              disabled={loading}
              variant="outline"
              size="sm"
              className="h-8 flex-1 sm:flex-none"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button 
              onClick={clearStuckTasks} 
              disabled={loading}
              variant="destructive"
              size="sm"
              className="h-8 flex-1 sm:flex-none"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Clear Stuck
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  if (minimized) {
    return (
      <>
        {/* Floating Trigger Button */}
        {!isOpen && (
          <button 
            onClick={() => setIsOpen(true)}
            className="fixed right-0 top-[35%] z-50 bg-slate-900 text-white py-4 px-1.5 rounded-l-lg shadow-2xl border-y border-l border-slate-700 transition-transform duration-300 translate-x-[calc(100%-6px)] hover:translate-x-0 flex flex-col items-center gap-3 group"
          >
            <div className="relative shrink-0">
              <Activity className="h-4 w-4 text-emerald-400 group-hover:animate-pulse" />
              <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 bg-emerald-500 rounded-full animate-ping" />
            </div>
            <span className="text-[9px] font-bold uppercase [writing-mode:vertical-rl] tracking-widest text-slate-400 group-hover:text-white whitespace-nowrap">
              DB Debug
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
                <Database className="h-4 w-4 text-emerald-500" />
                Database Diagnostics
              </h2>
              <p className="text-[10px] text-slate-400 mt-1 font-mono">
                System Status: {loading ? 'CHECKING...' : 'ONLINE'}
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
            {loading && !debugInfo ? (
              <div className="flex items-center justify-center h-40">
                <p className="text-sm text-muted-foreground animate-pulse">Loading debug information...</p>
              </div>
            ) : (
              <Content />
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span>Database Debug Information</span>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button 
              onClick={loadDebugInfo} 
              disabled={loading}
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none"
            >
              Refresh
            </Button>
            <Button 
              onClick={clearStuckTasks} 
              disabled={loading}
              variant="destructive"
              size="sm"
              className="flex-1 sm:flex-none"
            >
              Clear Stuck Tasks
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading && !debugInfo ? (
          <p>Loading debug information...</p>
        ) : debugInfo ? (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-2">AI Requests</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>Total: {debugInfo.aiRequests.total}</div>
                <div>Queued: {debugInfo.aiRequests.queued}</div>
                <div>Processing: {debugInfo.aiRequests.processing}</div>
                <div>Completed: {debugInfo.aiRequests.completed}</div>
                <div>Failed: {debugInfo.aiRequests.failed}</div>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-2">Upload Tasks</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>Total: {debugInfo.uploads.total}</div>
                <div>Pending: {debugInfo.uploads.pending}</div>
                <div>Uploading: {debugInfo.uploads.uploading}</div>
                <div>Uploaded: {debugInfo.uploads.uploaded}</div>
                <div>Failed: {debugInfo.uploads.failed}</div>
              </div>
            </div>
            
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                <strong>Active Tasks Count:</strong> {debugInfo.aiRequests.queued + debugInfo.aiRequests.processing + debugInfo.uploads.pending + debugInfo.uploads.uploading}
              </p>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
