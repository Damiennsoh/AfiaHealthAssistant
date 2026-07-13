"use client";

import React, { useState } from "react";
import { Bug, Eye, EyeOff, Search, BookOpen, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useKnowledgeBase, type KnowledgeChunk } from "@/hooks/use-knowledge-base";

interface KnowledgeDebugProps {
  className?: string;
}

export function KnowledgeDebug({ className }: KnowledgeDebugProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [testQuery, setTestQuery] = useState("malaria treatment");
  const [testResults, setTestResults] = useState<KnowledgeChunk[]>([]);
  const { chunks, searchKnowledge, getSyncStatus } = useKnowledgeBase();

  const handleTestSearch = async () => {
    if (!testQuery.trim()) return;
    
    console.log('🧪 [DEBUG UI] Manual test search for:', testQuery);
    const results = await searchKnowledge(testQuery, 5);
    setTestResults(results);
  };

  const syncStatus = getSyncStatus();

  if (!isVisible) {
    return (
      <div className={className}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsVisible(true)}
          className="fixed bottom-4 right-4 z-50 bg-amber-50 border-amber-200"
        >
          <Bug className="h-4 w-4 mr-2" />
          Debug Knowledge
        </Button>
      </div>
    );
  }

  return (
    <div className={className}>
      <Card className="fixed bottom-4 right-4 z-50 w-96 max-h-[80vh] overflow-hidden bg-white border-2 border-amber-200">
        <CardHeader className="bg-amber-50 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold text-amber-800">
              Knowledge Base Debug
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsVisible(false)}
              className="h-6 w-6 p-0 text-amber-600"
            >
              <EyeOff className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Status Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600">Status:</span>
              <Badge 
                variant={syncStatus.status === "online" ? "default" : "secondary"}
                className="text-xs"
              >
                {syncStatus.label}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600">Total Chunks:</span>
              <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded">
                {chunks.length}
              </span>
            </div>
          </div>

          {/* Test Search Section */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-700">Test Search:</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={testQuery}
                onChange={(e) => setTestQuery(e.target.value)}
                placeholder="Enter medical query..."
                className="flex-1 text-xs px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-300"
                onKeyPress={(e) => e.key === 'Enter' && handleTestSearch()}
              />
              <Button
                size="sm"
                onClick={handleTestSearch}
                className="h-7 px-2 text-xs bg-amber-600 hover:bg-amber-700"
              >
                <Search className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Results Section */}
          {testResults.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <BookOpen className="h-3 w-3 text-green-600" />
                <span className="text-xs font-medium text-green-700">
                  Found {testResults.length} protocols:
                </span>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {testResults.map((chunk, index) => (
                  <div
                    key={chunk.id}
                    className="p-2 bg-green-50 border border-green-200 rounded text-xs"
                  >
                    <div className="font-medium text-green-800 mb-1">
                      {index + 1}. {chunk.section}
                    </div>
                    <div className="text-green-600 truncate">
                      {chunk.content.substring(0, 100)}...
                    </div>
                    <div className="text-green-500 text-xs mt-1">
                      Source: {chunk.source}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {testResults.length === 0 && testQuery && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-3 w-3 text-amber-600" />
                <span className="text-xs font-medium text-amber-700">
                  No protocols found
                </span>
              </div>
              <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                Try different medical terms like: &quot;malaria&quot;, &quot;hypertension&quot;, &quot;diabetes&quot;, &quot;pneumonia&quot;
              </div>
            </div>
          )}

          {/* Sample Chunks */}
          {chunks.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-medium text-slate-700">Sample Chunks:</span>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {chunks.slice(0, 3).map((chunk) => (
                  <div
                    key={chunk.id}
                    className="p-2 bg-slate-50 border border-slate-200 rounded text-xs"
                  >
                    <div className="font-medium text-slate-700 truncate">
                      {chunk.section}
                    </div>
                    <div className="text-slate-500 text-xs">
                      {chunk.source}
                    </div>
                  </div>
                ))}
                {chunks.length > 3 && (
                  <div className="text-xs text-slate-400 text-center">
                    ... and {chunks.length - 3} more
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
