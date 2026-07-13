"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Database,
  CheckCircle,
  Loader2,
  BookOpen,
  FileText,
  ShieldCheck,
  AlertCircle,
  ArrowLeft,
  Zap,
  RefreshCw,
  Download,
  Info,
  ChevronDown,
  ChevronUp,
  Trash2,
  AlertTriangle,
  Search,
  Upload,
  FileUp,
  Brain,
  Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AfiaAuthContext";
import {
  loadPrecomputedKnowledge,
  getKnowledgeStats,
  isKnowledgeLoaded,
  type KnowledgeChunk,
  initDB as initKnowledgeDB
} from "@/lib/knowledge-loader";
import { semanticChunking } from "@/lib/chunking-engine";

const PDF_WORKER_SRC = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

export default function KnowledgeAdmin() {
  const { user, can } = useAuth();
  
  // State for tabs
  const [activeTab, setActiveTab] = useState("overview");

  // State for Knowledge Base (Shared)
  const [chunks, setChunks] = useState<KnowledgeChunk[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string>("all"); // "all" | "GH" | "ZW"

  // State for Manual Upload
  const [isEmbeddingReady, setIsEmbeddingReady] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);

  // Initialize embedding worker for manual uploads
  useEffect(() => {
    // Only initialize worker if we are in the browser
    if (typeof window === "undefined") return;

    try {
      // Use a try-catch block to prevent "Illegal constructor" errors
      // Some environments or bundlers might have issues with Worker construction
      if (typeof Worker !== 'undefined') {
        const worker = new Worker(new URL("../workers/embedding.worker.ts", import.meta.url));
        workerRef.current = worker;

        worker.postMessage({ type: "init" });

        const handleMessage = (event: MessageEvent) => {
          const data = event.data as { type?: string; error?: string };
          if (data?.type === "ready") {
            setIsEmbeddingReady(true);
            console.log("Embedding worker ready");
          }
          if (data?.type === "error") {
            console.error("Embedding worker error:", data.error);
            // Don't toast error here to avoid annoying users who just want precomputed
          }
        };

        worker.addEventListener("message", handleMessage);

        return () => {
          worker.removeEventListener("message", handleMessage);
          worker.terminate();
          workerRef.current = null;
        };
      }
    } catch (error) {
      console.error("Failed to initialize embedding worker:", error);
    }
  }, []);

  // Load PDF.js from CDN
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // Check if pdf.js is already loaded
    if (!(window as any)["pdfjs-dist/build/pdf"]) {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.async = true;
      script.onload = () => {
        const pdfjsLib = (window as any)["pdfjs-dist/build/pdf"];
        if (pdfjsLib) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
        }
      };
      document.body.appendChild(script);
    }
  }, []);

  const loadSampleChunks = useCallback(async () => {
    try {
      const db = await initKnowledgeDB();
      const tx = db.transaction("knowledge_chunks", "readonly");
      const store = tx.objectStore("knowledge_chunks");
      // Get chunks, filtered by selectedCountry
      let cursor = await store.openCursor(null, "next");
      const sampleChunks: KnowledgeChunk[] = [];
      
      let i = 0;
      while (cursor && i < 50) {
        const chunk = cursor.value;
        // Apply country filter
        const matchesCountry = 
          selectedCountry === "all" || 
          chunk.countryCode === selectedCountry || 
          // If no countryCode but selectedCountry is "all", include it
          (selectedCountry === "all" && !chunk.countryCode);
        
        if (matchesCountry) {
          sampleChunks.push(chunk);
          i++;
        }
        
        cursor = await cursor.continue();
      }
      setChunks(sampleChunks);
    } catch (error) {
      console.error("Failed to load sample chunks:", error);
    }
  }, [selectedCountry]);

  const checkStatus = useCallback(async () => {
    try {
      const loaded = await isKnowledgeLoaded();
      setIsInitialized(loaded);
      
      if (loaded) {
        // Load sample chunks immediately for better UX
        loadSampleChunks().catch(console.error);
        
        // Load stats in background
        getKnowledgeStats().then(stats => {
          if (stats) setStats(stats);
        }).catch(console.error);
      }
    } catch (error) {
      console.error("Failed to check status:", error);
    }
  }, [loadSampleChunks]);

  // Check initialization status on mount
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Reload chunks when selectedCountry changes
  useEffect(() => {
    if (isInitialized) {
      loadSampleChunks();
    }
  }, [selectedCountry, isInitialized, loadSampleChunks]);

  // -------------------------------------------------------------------------
  // Precomputed Knowledge Logic
  // -------------------------------------------------------------------------

  const handleLoadPrecomputed = async () => {
    setIsLoading(true);
    setProgress(0);
    setStatus("Initializing...");

    try {
      const result = await loadPrecomputedKnowledge((p) => {
        setProgress(p);
        setStatus(`Loading knowledge base... ${p}%`);
      });

      if (result.success) {
        toast.success("Knowledge base loaded successfully", {
          description: `Loaded ${result.count} chunks with embeddings.`,
        });
        await checkStatus();
      } else {
        toast.error("Failed to load knowledge base", {
          description: result.error as string,
        });
      }
    } catch (error: any) {
      toast.error("An error occurred", {
        description: error.message,
      });
    } finally {
      setIsLoading(false);
      setStatus("");
    }
  };

  // -------------------------------------------------------------------------
  // Manual Upload Logic
  // -------------------------------------------------------------------------

  const extractTextFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdfjsLib = (window as any)["pdfjs-dist/build/pdf"];
    
    if (!pdfjsLib) {
      throw new Error("PDF.js library not loaded yet. Please try again in a moment.");
    }

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      fullText += pageText + "\n\n";
      
      // Update progress
      const percent = Math.round((i / pdf.numPages) * 30); // PDF extraction is 30% of work
      setUploadProgress(percent);
      setUploadStatus(`Extracting text (Page ${i}/${pdf.numPages})...`);
    }

    return fullText;
  };

  const embedChunks = async (texts: string[]): Promise<number[][]> => {
    if (!workerRef.current) {
      console.warn('[EMBED] Worker not available, using main-thread fallback');
      // Fallback to main-thread embedding if worker fails
      try {
        const { embedChunksMainThread } = await import('@/lib/vector-engine-browser');
        const results = await embedChunksMainThread(texts.map((t, i) => ({ id: `temp-${i}`, content: t })));
        return results.map(r => r.embedding);
      } catch (err) {
        console.error('[EMBED] Main-thread fallback failed:', err);
        return [];
      }
    }

    return new Promise((resolve) => {
      const worker = workerRef.current!;
      const chunksWithIds = texts.map((text, index) => ({ id: `chunk-${index}`, text }));
      
      // Send chunks to worker
      worker.postMessage({ 
        type: "EMBED_CHUNKS", 
        chunks: chunksWithIds,
        batchSize: 5
      });

      const handleMessage = (event: MessageEvent) => {
        const data = event.data;
        
        if (data?.type === "progress") {
          // Embedding is 70% of work (30% -> 100%)
          const percent = 30 + Math.round((data.current / data.total) * 70);
          setUploadProgress(percent);
          setUploadStatus(`Generating embeddings (${data.current}/${data.total})...`);
        }
        
        if (data?.type === "complete") {
          worker.removeEventListener("message", handleMessage);
          
          // Map results back to order
          const results = data.results || [];
          const vectors = texts.map((_, i) => {
            const result = results.find((r: any) => r.id === `chunk-${i}`);
            return result?.success ? result.embedding : [];
          });
          
          resolve(vectors);
        }
        
        if (data?.type === "error") {
          worker.removeEventListener("message", handleMessage);
          console.error("Worker embedding failed:", data.error);
          resolve([]);
        }
      };

      worker.addEventListener("message", handleMessage);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check permission for knowledge upload
    if (!can('knowledge:upload')) {
      toast.error("Access Denied", {
        description: "Only administrators can upload documents to the knowledge base."
      });
      return;
    }

    setIsLoading(true);
    setUploadProgress(0);
    setUploadStatus("Starting upload...");

    try {
      // 1. Extract Text
      const text = await extractTextFromPDF(file);
      
      // 2. Chunk Text
      setUploadStatus("Chunking text...");
      const textChunks = semanticChunking(text, 800, 150);
      
      // 3. Generate Embeddings
      setUploadStatus("Initializing embedding model...");
      const embeddings = await embedChunks(textChunks);
      
      // 4. Save to IDB
      setUploadStatus("Saving to database...");
      const db = await initKnowledgeDB();
      const tx = db.transaction("knowledge_chunks", "readwrite");
      const store = tx.objectStore("knowledge_chunks");
      
      const newChunks: KnowledgeChunk[] = textChunks.map((content, i) => ({
        id: `manual-${Date.now()}-${i}`,
        content,
        source: file.name,
        sourceShortName: "Upload",
        section: "Custom Upload",
        documentType: "reference",
        authority: "custom",
        color: "#888888",
        dateAdded: new Date().toISOString(),
        dateEmbedded: new Date().toISOString(),
        embedding: embeddings[i] || [],
        metadata: {
          year: new Date().getFullYear(),
          version: "1.0"
        }
      }));

      await Promise.all(newChunks.map(chunk => store.put(chunk)));
      await tx.done;

      toast.success("Document processed successfully", {
        description: `Added ${newChunks.length} chunks from ${file.name}`,
      });
      
      await checkStatus();
      setActiveTab("overview");

    } catch (error: any) {
      console.error("Upload failed:", error);
      toast.error("Upload failed", {
        description: error.message || "An error occurred during processing",
      });
    } finally {
      setIsLoading(false);
      setUploadStatus(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // -------------------------------------------------------------------------
  // Search Logic
  // -------------------------------------------------------------------------

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      await loadSampleChunks();
      return;
    }

    try {
      const db = await initKnowledgeDB();
      const tx = db.transaction("knowledge_chunks", "readonly");
      const store = tx.objectStore("knowledge_chunks");
      const allChunks = await store.getAll();
      
      // Basic keyword search with manual ranking and country filter
      const filtered = allChunks
        .filter(chunk => {
          // Apply country filter first
          const matchesCountry = 
            selectedCountry === "all" || 
            chunk.countryCode === selectedCountry || 
            (selectedCountry === "all" && !chunk.countryCode);
          return matchesCountry;
        })
        .map(chunk => {
          let score = 0;
          const content = chunk.content.toLowerCase();
          const query = searchQuery.toLowerCase();
          
          if (content.includes(query)) score += 1;
          if (chunk.section.toLowerCase().includes(query)) score += 2;
          
          // Boost official sources
          if (chunk.authority === 'ghs' || chunk.authority === 'nhis' || chunk.authority === 'mohcc') score *= 1.5;
          
          return { chunk, score };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 50)
        .map(item => item.chunk);
      
      setChunks(filtered);
    } catch (error) {
      console.error("Search failed:", error);
    }
  };

  const handleClearDatabase = async () => {
    // Check permission for knowledge delete
    if (!can('knowledge:delete')) {
      toast.error("Access Denied", {
        description: "Only administrators can delete knowledge base data."
      });
      return;
    }

    if (!confirm("Are you sure you want to clear the entire knowledge base? This cannot be undone.")) {
      return;
    }
    
    try {
      const db = await initKnowledgeDB();
      const tx = db.transaction("knowledge_chunks", "readwrite");
      await tx.objectStore("knowledge_chunks").clear();
      await tx.done;
      
      toast.success("Database cleared");
      setStats(null);
      setChunks([]);
      setIsInitialized(false);
    } catch (error) {
      toast.error("Failed to clear database");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Knowledge Base</h2>
          <p className="text-muted-foreground">
            Manage clinical protocols and formularies for offline access.
          </p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Link href="/" className="w-full md:w-auto">
            <Button variant="outline" size="sm" className="w-full md:w-auto">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 h-auto">
          <TabsTrigger value="overview" className="h-10">Overview & Search</TabsTrigger>
          <TabsTrigger value="manage" className="h-10">Manage Knowledge</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-4">
          {/* Country Filter */}
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-sm text-muted-foreground">Filter by Country:</span>
            <Button 
              variant={selectedCountry === "all" ? "default" : "outline"} 
              size="sm" 
              onClick={() => setSelectedCountry("all")}
            >
              All
            </Button>
            <Button 
              variant={selectedCountry === "GH" ? "default" : "outline"} 
              size="sm" 
              onClick={() => setSelectedCountry("GH")}
              style={selectedCountry === "GH" ? { backgroundColor: '#2e7d32' } : {}}
            >
              🇬🇭 Ghana
            </Button>
            <Button 
              variant={selectedCountry === "ZW" ? "default" : "outline"} 
              size="sm" 
              onClick={() => setSelectedCountry("ZW")}
              style={selectedCountry === "ZW" ? { backgroundColor: '#d32f2f' } : {}}
            >
              🇿🇼 Zimbabwe
            </Button>
          </div>

          {/* Stats Overview */}
          {stats && (
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Chunks</CardTitle>
                  <Database className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.total}</div>
                  <p className="text-xs text-muted-foreground">
                    Indexed knowledge fragments
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Ghana Chunks</CardTitle>
                  <Database className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-700">{stats.byCountry?.GH || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    GHS STG + NHIS
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Zimbabwe Chunks</CardTitle>
                  <Database className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-700">{stats.byCountry?.ZW || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    MOHCC EDLIZ
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Sources</CardTitle>
                  <BookOpen className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{Object.keys(stats.bySource || {}).length}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.keys(stats.bySource || {}).map(source => (
                      <Badge key={source} variant="secondary" className="text-[10px]">
                        {source}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Content Browser */}
          <Card>
            <CardHeader>
              <CardTitle>Knowledge Explorer</CardTitle>
              <CardDescription>
                Browse and verify indexed content.
              </CardDescription>
              <div className="flex flex-col sm:flex-row gap-2 mt-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search content..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>
                <Button variant="secondary" onClick={handleSearch} className="w-full sm:w-auto">Search</Button>
              </div>
            </CardHeader>
            <CardContent>
              {!isInitialized ? (
                <div className="text-center py-12 space-y-4">
                  <div className="rounded-full bg-slate-100 p-3 w-12 h-12 mx-auto dark:bg-slate-800">
                    <Database className="h-6 w-6 text-slate-400" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-medium">Knowledge base not initialized</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                      Load the pre-computed knowledge bundle to start using the clinical decision support features.
                    </p>
                  </div>
                  <Button onClick={() => setActiveTab("manage")}>
                    Go to Management
                  </Button>
                </div>
              ) : chunks.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No chunks found matching your query.
                </div>
              ) : (
                <div className="space-y-4">
                  {chunks.map((chunk) => (
                    <div 
                      key={chunk.id} 
                      className="flex flex-col space-y-2 p-4 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {chunk.countryCode && (
                              <Badge 
                                variant="secondary" 
                                className="text-xs font-normal"
                                style={{ 
                                  backgroundColor: chunk.countryCode === 'GH' ? '#e8f5e9' : chunk.countryCode === 'ZW' ? '#ffebee' : '#f5f5f5',
                                  color: chunk.countryCode === 'GH' ? '#2e7d32' : chunk.countryCode === 'ZW' ? '#d32f2f' : '#616161'
                                }}
                              >
                                {chunk.countryCode === 'GH' ? '🇬🇭 Ghana' : chunk.countryCode === 'ZW' ? '🇿🇼 Zimbabwe' : chunk.countryCode}
                              </Badge>
                            )}
                            <Badge 
                              variant="outline" 
                              style={{ borderColor: chunk.color, color: chunk.color }}
                            >
                              {chunk.sourceShortName || chunk.source}
                            </Badge>
                            <Badge variant="secondary" className="text-xs font-normal">
                              {chunk.documentType}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {chunk.section}
                            </span>
                            {chunk.embedding && chunk.embedding.length > 0 && (
                              <Badge variant="outline" className="text-[10px] border-green-200 text-green-700 bg-green-50">
                                Vector Ready
                              </Badge>
                            )}
                          </div>
                          <p className={cn(
                            "text-sm leading-relaxed",
                            expandedId !== chunk.id && "line-clamp-2"
                          )}>
                            {chunk.content}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0 ml-2"
                          onClick={() => setExpandedId(expandedId === chunk.id ? null : chunk.id)}
                        >
                          {expandedId === chunk.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* MANAGE TAB */}
        <TabsContent value="manage" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Precomputed Knowledge Card */}
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Official Protocols</CardTitle>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">Recommended</Badge>
                </div>
                <CardDescription>
                  Load the standard Ministry of Health / GHS protocols and NHIS Medicines List.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg text-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Ghana STG 2017 (Standard Treatment Guidelines)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>NHIS Medicines List 2025</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Pre-computed embeddings (fast load)</span>
                  </div>
                </div>

                <div className="pt-2">
                  {isLoading ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {status}
                      </div>
                      <Progress value={progress} />
                    </div>
                  ) : (
                    <Button 
                      onClick={handleLoadPrecomputed} 
                      className="w-full" 
                      disabled={isLoading}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {isInitialized ? "Reload Official Knowledge" : "Load Knowledge Base"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Manual Upload Card */}
            <Card className="border-l-4 border-l-amber-500">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Custom Documents</CardTitle>
                  <Badge variant="outline">Advanced</Badge>
                </div>
                <CardDescription>
                  Upload custom PDF documents (e.g. facility memos, new guidelines).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Info className="h-4 w-4" />
                    <span>Uses browser-based processing (Transformers.js)</span>
                  </div>
                  
                  <div className="grid w-full max-w-sm items-center gap-1.5">
                    <Input 
                      ref={fileInputRef}
                      type="file" 
                      accept=".pdf"
                      onChange={handleFileUpload}
                      disabled={isLoading || uploadStatus !== null}
                    />
                  </div>
                </div>

                {uploadStatus && (
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center gap-2 text-sm text-blue-600">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {uploadStatus}
                    </div>
                    <Progress value={uploadProgress} />
                  </div>
                )}
                
                {!isEmbeddingReady && (
                  <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Initializing embedding engine...
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Danger Zone */}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Danger Zone
              </CardTitle>
              <CardDescription>
                Irreversible actions for database management.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="destructive" 
                onClick={handleClearDatabase}
                className="w-full sm:w-auto"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear Knowledge Database
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
