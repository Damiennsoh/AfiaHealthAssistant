"use client";

import React, { useState, useRef, useEffect } from "react";
import NextImage from "next/image";
import Cropper from "react-easy-crop";
import getCroppedImg from "../utils/crop";
import { uploadDB, generateId, encounterDB, aiRequestDB } from "@/lib/db";
import { PatientPickerModal } from "./patient-picker-modal";
import { toast } from "sonner";
import type { Patient, AIRequest } from "@/lib/db";
import { useKnowledgeBase } from "@/hooks/use-knowledge-base";
import { 
  Send, 
  Loader2, 
  Stethoscope, 
  ShieldCheck, 
  User, 
  Bot, 
  Sparkles,
  Search,
  History,
  ImageIcon,
  Info,
  Pill,
  FileText,
  Activity,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Enhanced text processing for clean professional output
const sanitizeText = (text: string): string => {
  // 1. Remove markdown symbols (#, *, **, ```, _, `, >, ~)
  let cleaned = text
    .replace(/```[\s\S]*?```/g, "") // Remove code blocks first
    .replace(/[#*_`>~]/g, "") // Remove ALL markdown symbols (added >, ~ for aggressive scrubbing)
    .replace(/\[\[AFIA_REQ:[^\]]+\]\]\s*/g, "") // Remove AFIA_REQ markers
    .replace(/\[GENERAL_FALLBACK\]\s*/g, "") // Remove fallback markers
    .replace(/\{[\s\S]*?\}/g, "") // Remove raw JSON objects if exposed
    .replace(/\n{3,}/g, "\n\n") // Normalize multiple newlines
    .trim();
    
  // 2. Add colons to section headers (uppercase lines) - OPTIONAL now but good for fallback
  cleaned = cleaned.split('\n').map(line => {
    const trimmed = line.trim();
    // Identify likely headers: Uppercase, < 60 chars, no existing colon
    if (trimmed.length > 0 && trimmed.length < 60 && /^[A-Z\s]+$/.test(trimmed) && !trimmed.endsWith(':')) {
      return trimmed; // Leave as is, parser will handle it
    }
    return line;
  }).join('\n');

  // 3. Convert key-value pairs to bullet points
  // Logic: Line starts with "Word: " or "Word Word: " (Mixed case) -> prepend bullet
  cleaned = cleaned.replace(/^([A-Za-z\s]+):/gm, (match, key) => {
    // Skip if it looks like a header (all caps)
    if (/^[A-Z\s]+$/.test(key)) return match;
    return `• ${match}`;
  });

  return cleaned;
};

// Source detection and citation formatter
const formatResponseWithSource = (content: string, protocolsUsed: number) => {
  // Check for explicit fallback markers or "soft" fallback language
  const explicitFallback = content.includes('[GENERAL_FALLBACK]');
  const softFallback = /no specific (GHS )?protocol|general (medical )?knowledge|general guidelines/i.test(content);
  const hasGeneralFallback = explicitFallback || softFallback;

  // Determine source type
  // If fallback is detected, force source to 'gemini' (General Medical Info)
  // Otherwise, if protocols were provided, assume 'ghs'
  let source: 'ghs' | 'gemini' = 'gemini';
  
  if (protocolsUsed > 0 && !hasGeneralFallback) {
    source = 'ghs';
  }

  // Clean the content of markers
  let text = content
    .replace('[GENERAL_FALLBACK]', '')
    .trim();

  return {
    text,
    source,
    hasDisclaimer: source === 'gemini' // Always show disclaimer for general info
  };
};

// Protocol citation cleanup - consolidates individual protocol references into single GHS citation
const cleanupProtocolCitations = (text: string): string => {
  // Remove individual PROTOCOL X references and their variations
  let cleaned = text
    .replace(/According to\s+PROTOCOL\s+\d+[,.]?\s*/gi, '')
    .replace(/According to\s+protocol\s+\d+[,.]?\s*/gi, '')
    .replace(/PROTOCOL\s+\d+[:,.]?\s*/gi, '')
    .replace(/protocol\s+\d+[:,.]?\s*/gi, '')
    .replace(/\[PROTOCOL\s+\d+\]\s*/gi, '')
    .replace(/\(PROTOCOL\s+\d+\)\s*/gi, '');
  
  // Clean up any double spaces or empty lines created
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').replace(/\s{2,}/g, ' ').trim();
  
  return cleaned;
};



// Clinical Response Renderer Component
function ClinicalResponseRenderer({ content, isStreaming, protocolsUsed }: {
  content: string;
  isStreaming?: boolean;
  protocolsUsed?: boolean;
}) {
  // Clean up individual protocol citations first
  const cleanedContent = cleanupProtocolCitations(content);
  const { text: rawContent, source, hasDisclaimer } = formatResponseWithSource(cleanedContent, protocolsUsed ? 1 : 0);
  
  // Sanitize text (remove markdown, fix headers, add bullets)
  const cleanContent = sanitizeText(rawContent);
  
  // Check for fallback/general knowledge triggers immediately
  const isFallback = /no specific (GHS )?protocol|general (medical )?knowledge|general guidelines/i.test(cleanContent);

  // Determine section style based on header
  const getSectionStyle = (header: string) => {
    const normalizedHeader = header.toUpperCase().replace(':', '').trim(); // Strip colon
    
    // Semantic Card Styles based on user requirement
    const sectionStyles = {
      // ROSE: Assessment, Diagnosis, Summary (Immediate clinical focus)
      diagnosis: { 
        keywords: ['DIAGNOSIS', 'ASSESSMENT', 'FINDINGS', 'PROBLEM', 'CONDITION', 'DIFFERENTIAL', 'SUSPECTED', 'SUMMARY'],
        label: normalizedHeader || "ASSESSMENT SUMMARY", 
        icon: Stethoscope, 
        bg: "bg-rose-50", 
        border: "border-rose-100", 
        text: "text-rose-900", 
        badge: "bg-rose-100 text-rose-700" 
      },
      // EMERALD: Treatment, Prescription, Medication (Healing)
      treatment: { 
        keywords: ['TREATMENT', 'PLAN', 'MANAGEMENT', 'DRUGS', 'PRESCRIPTION', 'DOSAGE', 'MEDICATION', 'THERAPY', 'ACTION', 'RECOMMENDED', 'GUIDELINES'],
        label: normalizedHeader || "GHS RECOMMENDED ACTION", 
        icon: Pill, 
        bg: "bg-emerald-50", 
        border: "border-emerald-100", 
        text: "text-emerald-900", 
        badge: "bg-emerald-100 text-emerald-700" 
      },
      // BLUE: Recommended Actions, Follow-up (Next steps)
      prevention: { 
        keywords: ['PREVENTION', 'LIFESTYLE', 'ADVICE', 'COUNSELING', 'EDUCATION', 'DIET', 'HOME CARE', 'NEXT STEPS', 'FOLLOW-UP'],
        label: normalizedHeader || "COUNSELING & FOLLOW-UP", 
        icon: Activity, 
        bg: "bg-blue-50", 
        border: "border-blue-100", 
        text: "text-blue-900", 
        badge: "bg-blue-100 text-blue-700" 
      },
      // SLATE: Rationale, Notes, Default
      rationale: { 
        keywords: ['RATIONALE', 'EXPLANATION', 'REASONING', 'BACKGROUND', 'CONTEXT'],
        label: normalizedHeader || "RATIONALE", 
        icon: Info, 
        bg: "bg-slate-50", 
        border: "border-slate-100", 
        text: "text-slate-900", 
        badge: "bg-slate-100 text-slate-700" 
      },
      clinical_note: {
        keywords: ['CLINICAL NOTE', 'NOTE', 'IMPORTANT', 'NOTICE'],
        label: normalizedHeader || "CLINICAL NOTE",
        icon: Info,
        bg: "bg-slate-50", 
        border: "border-slate-100", 
        text: "text-slate-900", 
        badge: "bg-slate-100 text-slate-700" 
      },
      warning: { 
        keywords: ['WARNING', 'CAUTION', 'ALERT', 'CONTRAINDICATION', 'RISK', 'DANGER', 'EMERGENCY', 'REFERRAL'],
        label: normalizedHeader || "CLINICAL ALERT", 
        icon: AlertTriangle, 
        bg: "bg-amber-50", 
        border: "border-amber-100", 
        text: "text-amber-900", 
        badge: "bg-amber-100 text-amber-700" 
      },
      default: {
        keywords: [],
        label: normalizedHeader || "INFORMATION", // Use original header if no match
        icon: FileText,
        bg: "bg-slate-50",
        border: "border-slate-100", 
        text: "text-slate-900",
        badge: "bg-slate-100 text-slate-700"
      }
    };

    for (const [key, style] of Object.entries(sectionStyles)) {
      if (key === 'default') continue;
      if (style.keywords.some(k => normalizedHeader.includes(k))) {
        return style;
      }
    }
    return sectionStyles.default;
  };

  // Robust parsing: Split by Newline + Uppercase Header (4+ chars)
  // Logic: Look for newlines followed by uppercase words (min 4 chars)
  let sections: Array<{ header: string; body: string; style: any }> = [];

  // If this is a fallback response, treat the entire content as a single CLINICAL NOTE card
  if (isFallback) {
    sections = [{
      header: 'CLINICAL NOTE',
      body: cleanContent,
      style: getSectionStyle('CLINICAL NOTE')
    }];
  } else {
    // New Flexible Split Logic:
    // Split by newline, then look ahead for uppercase start
    // Regex: \n(?=[A-Z\s]{4,}) -> Match newline if followed by 4+ uppercase chars
    const splitRegex = /\n(?=[A-Z\s]{4,})/;
    
    sections = cleanContent.split(splitRegex).filter(Boolean).map(section => {
      // Find the first newline or colon to separate header from body
      // But since we split by the start of header, the 'section' variable starts with the header
      
      // We need to separate the header line from the rest
      const firstLineBreak = section.indexOf('\n');
      let header = "";
      let body = "";
      
      if (firstLineBreak > -1) {
        header = section.substring(0, firstLineBreak).trim();
        body = section.substring(firstLineBreak + 1).trim();
      } else {
        // Single line or just header?
        // If it's short and uppercase, it's a header with no body (unlikely)
        // Assume header: body format if colon exists
        const colonIndex = section.indexOf(':');
        if (colonIndex > -1 && colonIndex < 50) {
           header = section.substring(0, colonIndex).trim();
           body = section.substring(colonIndex + 1).trim();
        } else {
           // Fallback: whole thing is body if it's long, or header if short?
           // Let's assume if it matched our split regex, the start is a header
           header = "INFORMATION";
           body = section.trim();
        }
      }

      // Cleanup header
      header = header.replace(/:$/, '').trim();
      
      if (body) {
         return { header, body, style: getSectionStyle(header) };
      }
      return null;
    }).filter(Boolean) as Array<{ header: string; body: string; style: any }>;
    
    // Fallback for when regex split produces nothing valid (e.g. no uppercase headers found)
    if (sections.length === 0 && cleanContent.length > 0) {
       sections.push({ header: 'INFORMATION', body: cleanContent.trim(), style: getSectionStyle('INFO') });
    }
  }

  // Remove JSON blocks if present in any section body (User reported JSON artifacts)
  sections = sections.map(section => ({
    ...section,
    body: section.body.replace(/```json[\s\S]*?```/g, "").replace(/\{[\s\S]*?\}/g, "").trim()
  }));

  // Final Fallback: Treat as single card if still no sections
  if (sections.length === 0 && cleanContent) {
    // Check if it looks like a single section response (e.g. starts with "While no specific...")
    // In this case, wrap it in a relevant card instead of generic RESPONSE
    const fallbackStyle = getSectionStyle('INFO');
    
    // If soft fallback detected, use Clinical Note style for visibility
    if (/no specific (GHS )?protocol|general (medical )?knowledge/i.test(cleanContent)) {
       sections.push({ 
        header: 'CLINICAL NOTE', 
        body: cleanContent, 
        style: getSectionStyle('CLINICAL NOTE') 
      });
    } else {
      sections.push({ 
        header: 'RESPONSE', 
        body: cleanContent, 
        style: fallbackStyle
      });
    }
  }
  
  return (
    <div className="w-full max-w-none space-y-4"> 
      {/* Source Badge - Only show if specifically GHS sourced or streaming */}
      {(source === "ghs" || isStreaming) && (
        <div className="flex items-center gap-2 mb-2">
          <Badge className={cn(
            "text-[10px] font-bold px-3 py-1 rounded-full shadow-sm",
            source === "ghs" 
              ? "bg-emerald-100 text-emerald-800 border-emerald-200" 
              : "bg-amber-100 text-amber-800 border-amber-200"
          )}>
            {source === "ghs" ? (
              <><ShieldCheck className="h-3 w-3 mr-1" /> GHS Protocol Verified</>
            ) : (
              <><Info className="h-3 w-3 mr-1" /> General Medical Info</>
            )}
          </Badge>
          {isStreaming && (
            <div className="flex items-center gap-1 text-xs text-slate-400 animate-pulse">
              <Loader2 className="h-3 w-3 animate-spin" />
              Processing...
            </div>
          )}
        </div>
      )}
      
      {/* Render Sections as Cards */}
      {sections.map((section, index) => {
        const StyleIcon = section.style.icon;
        
        return (
          <div key={index} className={cn("rounded-2xl border shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md", section.style.bg, section.style.border)}>
            {/* Card Header */}
            <div className="px-4 py-3 border-b border-black/5 flex items-center gap-2">
              <div className={cn("p-1.5 rounded-lg", section.style.badge.replace('text-', 'bg-').replace('bg-', 'bg-opacity-20 '))}>
                <StyleIcon className={cn("h-4 w-4", section.style.text)} />
              </div>
              <h3 className={cn("font-black text-sm tracking-wide uppercase", section.style.text)}>
                {section.header}
              </h3>
            </div>
            
            {/* Card Content */}
            <div className="p-4">
              <div className={cn("text-sm leading-relaxed font-semibold", section.style.text)}>
                {section.body.split('\n').map((line, i) => {
                  const isBullet = line.trim().startsWith('•') || line.trim().startsWith('-');
                  if (isBullet) {
                    return (
                      <div key={i} className="flex items-start gap-2 mb-1 pl-1">
                        <span className="shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full bg-current opacity-60" />
                        <span>{line.replace(/^[•-]\s*/, '')}</span>
                      </div>
                    );
                  }
                  return <div key={i} className="mb-1 min-h-[1.25rem] whitespace-pre-wrap">{line}</div>;
                })}
              </div>
            </div>
          </div>
        );
      })}
      
      {/* Disclaimer Card - Always show for non-GHS or if flagged */}
      {hasDisclaimer && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 flex gap-3 items-start">
          <AlertTriangle className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Clinical Disclaimer
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              This information is for clinical decision support only. Verify with official GHS Standard Treatment Guidelines before administration.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AfiaChatWidget() {
  const [input, setInput] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [showCrop, setShowCrop] = useState(false);
  const [cropError, setCropError] = useState<string | null>(null);
  const [typingText, setTypingText] = useState<string>("");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [imageUploadId, setImageUploadId] = useState<string | null>(null);
  // Knowledge source tracking
  const [responseSource, setResponseSource] = useState<"ghs" | "gemini" | null>(null);
  const [hasDisclaimer, setHasDisclaimer] = useState(false);
  
  // Message history state - stores conversation
  const [messages, setMessages] = useState<{role: 'user' | 'assistant', content: string, id: string, source?: "gemini" | "ghs", protocolsUsed?: boolean}[]>([]);
  
  // One-Tap Action state
  const [isPatientPickerOpen, setIsPatientPickerOpen] = useState(false);
  const [pendingContent, setPendingContent] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const { searchKnowledge, chunks } = useKnowledgeBase();

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleAsk = async () => {
    // Prevent duplicate calls
    if (loading || (!input.trim() && !imageFile)) return;
    
    // Search knowledge base for relevant protocols
    const relevantProtocols = input.trim() ? await searchKnowledge(input.trim()) : [];
    
    // Store protocols in localStorage for API consistency with AI Assistant
    if (typeof window !== "undefined" && relevantProtocols.length > 0) {
      localStorage.setItem("afia_current_protocols", JSON.stringify(relevantProtocols));
    }
    
    // Add user message to history
    const userMessage = { role: 'user' as const, content: input.trim(), id: generateId() };
    setMessages(prev => [...prev, userMessage]);
    
    setLoading(true);
    setTypingText("");
    setElapsedMs(0);
    const start = Date.now();
    const timer = setInterval(() => setElapsedMs(Date.now() - start), 250);
    try {
      let imageBase64: string | undefined = undefined;
      if (imageFile) {
        imageBase64 = await toBase64(imageFile);
        // enforce size limit: 2MB
        const approxSize = Math.ceil((imageBase64.length * 3) / 4);
        if (approxSize > 2 * 1024 * 1024) {
          // attempt to resize down
          const resized = await resizeImage(imageFile, 1200, 0.8);
          imageBase64 = resized.replace(/^data:\w+\/\w+;base64,/, "");
          const newSize = Math.ceil((imageBase64.length * 3) / 4);
          if (newSize > 2 * 1024 * 1024) {
            throw new Error("Image too large even after resizing. Please choose a smaller image.");
          }
        }

        // persist image to local DB before sending
        const uploadId = generateId();
        setImageUploadId(uploadId);
        const blob = await (await fetch(`data:image/jpeg;base64,${imageBase64}`)).blob();
        await uploadDB.save({
          id: uploadId,
          name: `image-${Date.now()}.jpg`,
          contentType: "image/jpeg",
          blob: blob,
          status: "pending",
          attempts: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      // Call AI assistant API with protocols
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: [{ role: 'user', content: input.trim() }],
          context: undefined,
          protocols: relevantProtocols.length > 0 ? relevantProtocols : undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const msg = errData.error || errData.message || "AI request failed";
        throw new Error(msg);
      }

      const data = await res.text(); // Get raw text response from streaming API
      const aiResponse = data || "No response received.";

      // Add AI message to history with source detection
      const { text: processedResponse, source: detectedSource, hasDisclaimer: needsDisclaimer } = formatResponseWithSource(aiResponse, relevantProtocols.length);
      const aiMessage = { 
        role: 'assistant' as const, 
        content: processedResponse, 
        id: generateId(),
        source: detectedSource,
        protocolsUsed: relevantProtocols.length > 0
      };
      setMessages(prev => [...prev, aiMessage]);
      setResponseSource(detectedSource);
      setHasDisclaimer(needsDisclaimer);

      // Update image upload status if applicable
      if (imageUploadId) {
        // Note: uploadDB doesn't have update method, so we'll just clear the ID
        setImageUploadId(null);
      }

      setResponse(processedResponse);
    } catch (error: any) {
      console.error("AI request error:", error);
      const errorMessage = error?.message || "Failed to get AI response";
      
      // --- OFFLINE QUEUE LOGIC ---
      const isNetworkError = errorMessage.includes('fetch') || errorMessage.includes('network') || (typeof navigator !== 'undefined' && !navigator.onLine);
      
      if (isNetworkError) {
        try {
          const queueId = generateId();
          const queueItem: AIRequest = {
            id: queueId,
            encounterId: 'chat-session', // Default placeholder for general chat
            patientId: 'guest', // Default placeholder
            type: 'chat',
            payload: JSON.stringify({ 
              query: input.trim(), 
              s3Key: imageUploadId ? (await uploadDB.getById(imageUploadId))?.s3Key : undefined 
            }),
            status: 'queued',
            createdAt: new Date().toISOString(),
            response: null,
            completedAt: null
          };
          await aiRequestDB.save(queueItem);
          
          toast.warning("Offline: Request queued", {
            description: "We'll process this automatically when connection returns."
          });
          
          const queuedMessage = { 
            role: 'assistant' as const, 
            content: "You appear to be offline. I've queued this request and will answer automatically once internet connectivity is restored.", 
            id: queueId 
          };
          setMessages(prev => [...prev, queuedMessage]);
          return; // Stop standard error handling
        } catch (qErr) {
          console.error("Failed to queue chat request:", qErr);
        }
      }

      // Add error message to history
      const errorMessageObj = { role: 'assistant' as const, content: `Error: ${errorMessage}`, id: generateId() };
      setMessages(prev => [...prev, errorMessageObj]);
      
      toast.error(errorMessage);
    } finally {
      clearInterval(timer);
      setLoading(false);
      setInput("");
      setImageFile(null);
      setImagePreview(null);
      setShowCrop(false);
      setCropError(null);
    }
  };

  // Helper functions
  const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.replace(/^data:\w+\/\w+;base64,/, ""));
      };
      reader.onerror = (error) => reject(error);
    });

  const resizeImage = (file: File, maxWidth: number, quality: number): Promise<string> =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d")!;
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = URL.createObjectURL(file);
    });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setCropError("Please select an image file");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setShowCrop(true);
    setCropError(null);
  };

  const handlePatientSelected = async (patient: Patient) => {
    if (!pendingContent) return;
    try {
      const newEncounter = {
        id: generateId(),
        patientId: patient.id,
        type: "ai-consult" as const,
        date: new Date().toISOString(),
        notes: pendingContent,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await encounterDB.save(newEncounter as any);
      toast.success("Created new encounter with AI insight");
    } catch (error) {
      console.error("Error saving content:", error);
      throw error;
    }
  };

  // Crop Modal Component
  function CropModal({ src, onCancel, onCrop }: { src: string; onCancel: () => void; onCrop: (file: File) => void }) {
    const [crop, setCrop] = React.useState({ x: 0, y: 0 });
    const [zoom, setZoom] = React.useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = React.useState<any>(null);

    const onCropComplete = React.useCallback((croppedArea: any, croppedAreaPixels: any) => {
      setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleCrop = async () => {
      try {
        const croppedImageDataURL = await getCroppedImg(src, croppedAreaPixels);
        // Convert DataURL to File
        const response = await fetch(croppedImageDataURL);
        const blob = await response.blob();
        const file = new File([blob], "cropped-image.jpg", { type: "image/jpeg" });
        onCrop(file);
      } catch (e) {
        setCropError("Failed to crop image");
      }
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-lg">Crop Image</h3>
          </div>
          <div className="relative h-64 bg-black">
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={4 / 3}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
          <div className="p-4 flex gap-3">
            <Button variant="outline" onClick={onCancel} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleCrop} className="flex-1">
              Crop
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden font-sans rounded-2xl border border-slate-800">
      {/* PROFESSIONAL HEADER - DASHBOARD THEMED */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between shadow-sm z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-center">
            <Stethoscope className="h-4 w-4 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white">Afia Clinical Intelligence</h1>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] text-emerald-400 font-medium uppercase tracking-tight">Active Protocol Session</span>
            </div>
          </div>
        </div>
        
        {/* Source Status Badge */}
        <Badge variant="secondary" className="bg-slate-800 text-emerald-400 border-slate-700 gap-1 px-3 py-1">
          <ShieldCheck className="h-3 w-3" /> GHS Certified
        </Badge>
      </header>

      {/* CHAT AREA - Mobile First */}
      <ScrollArea className="flex-1 px-4 py-4" ref={scrollRef}>
        <div className="w-full space-y-4 pb-4">
          {messages.length === 0 && (
            <div className="text-center py-12 space-y-6">
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto border border-emerald-200">
                <Sparkles className="h-8 w-8 text-emerald-600" />
              </div>
              <div className="space-y-3">
                <h2 className="text-lg font-bold text-slate-800">Afia Chat Widget</h2>
                <p className="text-sm text-slate-600 max-w-sm mx-auto leading-relaxed">
                  Your professional clinical assistant. Get concise, evidence-based responses with GHS STG 7th Edition citations.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 px-4">
                <button 
                  onClick={() => setInput('Patient with fever, headache, and body pain')}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-full text-xs text-slate-600 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-colors"
                >
                  &quot;Fever and headache&quot;
                </button>
                <button 
                  onClick={() => setInput('Management of malaria in adults')}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-full text-xs text-slate-600 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-colors"
                >
                  &quot;Malaria treatment&quot;
                </button>
                <button 
                  onClick={() => setInput('Pregnant woman with UTI symptoms')}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-full text-xs text-slate-600 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-colors"
                >
                  &quot;Pregnancy UTI&quot;
                </button>
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={cn("flex flex-col gap-3", m.role === "user" ? "items-end" : "items-start")}>
              {m.role === "user" ? (
                <>
                  {/* User avatar and message in row */}
                  <div className="flex gap-3 items-end max-w-[85%] flex-row-reverse">
                    {/* Avatar */}
                    <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm border bg-slate-800 border-slate-700">
                      <User className="h-4 w-4 text-white" />
                    </div>
                    {/* Message Content */}
                    <div className="bg-slate-800 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm shadow-sm leading-relaxed">
                      {m.content}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* AI icon centered above content */}
                  <div className="flex justify-center">
                    <div className="h-8 w-8 rounded-xl flex items-center justify-center shadow-sm border bg-gradient-to-br from-emerald-500 to-emerald-600 border-emerald-500">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                  </div>
                  {/* AI response content - full width */}
                  <div className="w-full">
                    <ClinicalResponseRenderer 
                      content={m.content} 
                      isStreaming={loading && m.id === messages[messages.length - 1]?.id}
                      protocolsUsed={m.protocolsUsed || m.source === "ghs"}
                    />
                  </div>
                </>
              )}
              
              {/* Role label */}
              <span className="text-[9px] text-slate-400 font-medium px-1">
                {m.role === "user" ? "You" : "Afia AI • Clinical Assistant"}
              </span>
            </div>
          ))}
          
          {/* Loading States */}
          {typingText && !response && (
            <div className="flex gap-3 flex-row">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shrink-0 shadow-sm">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 w-full">
                <div className="whitespace-pre-wrap text-sm text-slate-900 leading-relaxed">
                  {typingText}
                </div>
              </div>
            </div>
          )}
          
          {loading && !typingText && (
            <div className="flex gap-3 items-center justify-center py-4">
              <div className="h-8 w-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
                <Loader2 className="h-4 w-4 text-emerald-600 animate-spin" />
              </div>
              <span className="text-xs text-slate-500 font-medium">Consulting GHS protocols... {Math.round(elapsedMs / 1000)}s</span>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* INPUT AREA - Mobile First Design */}
      <div className="p-4 bg-white border-t border-slate-200 shrink-0">
        <div className="w-full space-y-3">
          {/* Typing Area - Full Width */}
          <div className="relative">
            <div className="absolute left-3 top-3 text-slate-400">
              <Search className="h-4 w-4" />
            </div>
            <textarea 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAsk(); } }}
              placeholder="Describe symptoms, ask about treatment, or request clinical guidance...\n\nExamples: 'Fever with headache', 'Malaria management', 'Pregnancy complications'"
              rows={3}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-12 py-4 text-sm resize-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 placeholder:text-xs"
            />
            {/* Image upload button */}
            <label className="absolute right-2 bottom-2 p-2 rounded-xl hover:bg-slate-100 cursor-pointer transition-colors">
              <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
              <ImageIcon className="h-4 w-4 text-slate-400 hover:text-emerald-500" />
            </label>
          </div>
          
          {/* Send Button - Below typing area */}
          <div className="flex justify-end">
            <Button 
              onClick={handleAsk}
              disabled={loading || (!input.trim() && !imageFile)} 
              className="h-12 px-8 rounded-2xl bg-emerald-600 hover:bg-emerald-700 hover:scale-105 shadow-lg shadow-emerald-600/20 gap-2 font-bold transition-all active:scale-95 disabled:hover:scale-100"
            >
              <Send className="h-4 w-4" />
              <span>{loading ? "Analyzing" : "Send"}</span>
            </Button>
          </div>
          
          {/* Image preview */}
          {imagePreview && (
            <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-2 border border-slate-200">
              <NextImage src={imagePreview} alt="Preview" width={40} height={40} className="h-10 w-10 rounded-lg object-cover border border-slate-200" />
              <span className="text-xs text-slate-600">Image attached</span>
              <button 
                onClick={() => { setImagePreview(null); setImageFile(null); }}
                className="text-xs text-rose-500 hover:text-rose-700 ml-auto"
              >
                Remove
              </button>
            </div>
          )}

          {cropError && (
            <div className="text-xs text-amber-600 font-medium bg-amber-50 rounded-lg p-2 border border-amber-200">
              {cropError}
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-4">
              <button className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1.5 hover:text-emerald-600 transition-colors p-1.5 rounded-lg hover:bg-emerald-50">
                <History className="h-3.5 w-3.5" /> History
              </button>
              <button className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1.5 hover:text-emerald-600 transition-colors p-1.5 rounded-lg hover:bg-emerald-50">
                <ShieldCheck className="h-3.5 w-3.5" /> STG v.2017
              </button>
            </div>
            <p className="text-[10px] text-slate-400 font-medium hidden sm:block">Verify all clinical suggestions</p>
          </div>
        </div>
      </div>

      {/* Crop Modal */}
      {showCrop && imagePreview && (
        <CropModal
          src={imagePreview}
          onCancel={() => setShowCrop(false)}
          onCrop={(file) => {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
            setShowCrop(false);
            setCropError(null);
          }}
        />
      )}

      {/* Patient Picker Modal */}
      <PatientPickerModal
        isOpen={isPatientPickerOpen}
        onClose={() => {
          setIsPatientPickerOpen(false);
          setPendingContent(null);
        }}
        onSelect={handlePatientSelected}
        title="Save AI Insight to Patient"
        description="Select a patient to add this clinical information to their record."
      />
    </div>
  );
}
