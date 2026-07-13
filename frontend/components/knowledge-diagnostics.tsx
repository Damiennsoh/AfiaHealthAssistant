"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle, Database, RefreshCw, Trash2, Activity } from "lucide-react";
import { toast } from "sonner";
import { knowledgeDB, KnowledgeChunk } from "@/lib/knowledge-base";

/**
 * KnowledgeDiagnostics Component
 * Step II from DeepSeek recovery plan: Diagnostics and re-indexing tool
 * Allows wiping and re-embedding the GHS STG knowledge base
 */
export function KnowledgeDiagnostics() {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>("");
  const [stats, setStats] = useState<{
    total: number;
    embedded: number;
    pending: number;
  } | null>(null);

  // Check database status
  const checkStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      setStatus("Checking database...");

      const { total, embedded } = await knowledgeDB.getStats();
      const pending = total - embedded;

      setStats({ total, embedded, pending });
      setStatus(`Found ${total} chunks: ${embedded} embedded, ${pending} pending`);

      if (pending === 0 && total > 0) {
        toast.success("All chunks are properly embedded!");
      } else if (total === 0) {
        toast.warning("Database is empty");
      } else {
        toast.warning(`${pending} chunks need embeddings`);
      }
    } catch (error) {
      console.error("Status check failed:", error);
      toast.error("Failed to check database status");
      setStatus("Error checking database");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Wipe all embeddings (keep text content)
  const wipeEmbeddings = useCallback(async () => {
    try {
      setIsLoading(true);
      setProgress(0);
      setStatus("Wiping embeddings...");

      const allChunks = await knowledgeDB.getAll();

      // Remove embeddings from each chunk
      const updatedChunks = allChunks.map((chunk) => ({
        ...chunk,
        embedding: undefined,
      }));

      // Save back to database
      await knowledgeDB.addAll(updatedChunks);

      setStatus("Embeddings wiped successfully");
      toast.success("Embeddings wiped successfully");
      checkStatus();
      
    } catch (error) {
      console.error("Wipe failed:", error);
      toast.error("Failed to wipe embeddings");
      setStatus("Error wiping embeddings");
    } finally {
      setIsLoading(false);
    }
  }, [checkStatus]);
  // Full wipe (delete all chunks)
  const fullWipe = useCallback(async () => {
    if (!confirm("WARNING: This will delete ALL knowledge chunks. Are you sure?")) {
      return;
    }

    try {
      setIsLoading(true);
      setStatus("Performing full wipe...");

      await knowledgeDB.clear();

      setStats({ total: 0, embedded: 0, pending: 0 });
      setStatus("Database cleared");
      toast.success("All knowledge chunks deleted");
    } catch (error) {
      console.error("Full wipe failed:", error);
      toast.error("Failed to clear database");
      setStatus("Error clearing database");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Re-index (run vector migration)
  const reindex = useCallback(async () => {
    try {
      setIsLoading(true);
      setProgress(0);
      setStatus("Starting re-indexing...");

      // Dynamic import to avoid loading on component mount
      const { processVectorsInBatches } = await import("@/lib/vector-engine-browser");
      
      await processVectorsInBatches((percent, message) => {
        setProgress(percent);
        setStatus(message || `Processing: ${percent}%`);
      });

      toast.success("Re-indexing complete!");
      await checkStatus();
    } catch (error) {
      console.error("Re-indexing failed:", error);
      toast.error("Re-indexing failed. Check console for details.");
      setStatus("Re-indexing failed");
    } finally {
      setIsLoading(false);
    }
  }, [checkStatus]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5 text-amber-500" />
          Knowledge Base Diagnostics
        </CardTitle>
        <p className="text-sm text-slate-500">
          Step II: Diagnose and repair the GHS STG knowledge base
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status Display */}
        <div className="bg-slate-50 p-3 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Database className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-medium">Database Status</span>
          </div>
          
          {stats ? (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white p-2 rounded border">
                <div className="text-lg font-bold text-slate-700">{stats.total}</div>
                <div className="text-xs text-slate-500">Total Chunks</div>
              </div>
              <div className="bg-emerald-50 p-2 rounded border border-emerald-200">
                <div className="text-lg font-bold text-emerald-700">{stats.embedded}</div>
                <div className="text-xs text-emerald-600">Embedded</div>
              </div>
              <div className={`p-2 rounded border ${stats.pending > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-100'}`}>
                <div className={`text-lg font-bold ${stats.pending > 0 ? 'text-amber-700' : 'text-slate-700'}`}>
                  {stats.pending}
                </div>
                <div className={`text-xs ${stats.pending > 0 ? 'text-amber-600' : 'text-slate-500'}`}>
                  Pending
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic">Click &quot;Check Status&quot; to view database statistics</p>
          )}
        </div>

        {/* Progress Bar */}
        {(isLoading || progress > 0) && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-slate-500">{status}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={checkStatus}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <Database className="h-4 w-4" />
            Check Status
          </Button>

          <Button
            variant="outline"
            onClick={wipeEmbeddings}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Wipe Embeddings
          </Button>

          <Button
            variant="default"
            onClick={reindex}
            disabled={isLoading}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Re-index Now
          </Button>

          <Button
            variant="destructive"
            onClick={fullWipe}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <AlertTriangle className="h-4 w-4" />
            Full Wipe
          </Button>
        </div>

        {/* Warning Note */}
        <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            <strong>Step II:</strong> If your search returns 0 results or shows &quot;0/1988 embeddings&quot;, 
            use &quot;Wipe Embeddings&quot; then &quot;Re-index Now&quot; to rebuild the vector database. 
            This fixes the 404 worker issue by using the main-thread fallback.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
