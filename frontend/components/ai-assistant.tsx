"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  Send, 
  Bot, 
  User, 
  Stethoscope, 
  ShieldCheck, 
  Pill, 
  Activity, 
  Files, 
  Loader2, 
  Info, 
  BookOpen, 
  Microscope, 
  Copy, 
  Bookmark, 
  CheckCircle2, 
  ChevronRight, 
  X, 
  Image as ImageIcon,
  ArrowLeft,
  Database,
  Home,
  Plus,
  CloudOff,
  Trash2
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { saveChat, loadChat, clearChat } from "@/lib/chat-persistence";
import { searchLocalKnowledge } from "@/lib/knowledge-base";
import { BackNavigation } from "./ui/back-navigation";

// HELPER: Professional Text Sanitizer
const sanitize = (text: string) => {
  if (!text) return "";
  return text
    .replace(/[*#]/g, "")
    .replace(/\[\[AFIA_REQ:[^\]]+\]\]\n?/, "")
    .trim();
};

export type Message = {
  role: "assistant" | "user" | "system";
  content: string;
  mode?: "clinical" | "educational" | "lab" | "general";
  data?: any; // Structured data for cards
};

export function AIAssistant() {
  const searchParams = useSearchParams();
  const isOnline = useOnlineStatus();
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // URL Context
  const patientId = searchParams.get("patientId");
  const encounterId = searchParams.get("encounterId");

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [responseMode, setResponseMode] = useState<"clinical" | "educational" | "lab" | "general">("general");

  // Debug log to confirm reload
  useEffect(() => {
    console.log("AIAssistant component loaded with BackNavigation:", !!BackNavigation);
  }, []);

  // Load Chat History
  useEffect(() => {
    const initChat = async () => {
      try {
        const savedMessages = await loadChat();
        if (savedMessages && savedMessages.length > 0) {
          setMessages(savedMessages);
        } else {
          setMessages([
            {
              role: "assistant",
              content: "System ready. Enter clinical cases for diagnostic snapshots or ask for medical definitions.",
              mode: "general",
              data: {
                title: "System Ready",
                main: "I am Afia, synced with GHS STG 7th Edition. How can I assist with your patient today?"
              }
            }
          ]);
        }
      } catch (e) {
        console.error("Failed to load chat history:", e);
      } finally {
        setIsLoaded(true);
      }
    };
    initChat();
  }, []);

  // Save Chat History
  useEffect(() => {
    if (isLoaded && messages.length > 0) {
      saveChat(messages).catch((err: unknown) => console.error("Failed to save chat:", err));
    }
  }, [messages, isLoaded]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, isLoaded]);

  const handleClearChat = async () => {
    if (!window.confirm("Are you sure you want to clear the entire chat history? This action cannot be undone.")) {
      return;
    }

    try {
      await clearChat();
      setMessages([
        {
          role: "assistant",
          content: "System ready. Enter clinical cases for diagnostic snapshots or ask for medical definitions.",
          mode: "general",
          data: {
            title: "System Ready",
            main: "I am Afia, synced with GHS STG 7th Edition. How can I assist with your patient today?"
          }
        }
      ]);
      toast.success("Chat history cleared");
    } catch (e) {
      toast.error("Failed to clear chat history");
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error("Image too large. Please select an image under 5MB.");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() && !selectedImage) return;

    const userMsg = input;
    const currentImage = selectedImage;
    
    // Add User Message
    setMessages(prev => [...prev, { 
      role: "user", 
      content: userMsg,
      data: currentImage ? { image: currentImage } : undefined
    }]);
    
    setInput("");
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    
    setIsTyping(true);

    // REAL INTELLIGENCE ORCHESTRATOR
    try {
      // 1. Retrieve Knowledge Context (Client-Side RAG)
      let contextChunks: any[] = [];
      try {
        if (userMsg.trim()) {
          contextChunks = await searchLocalKnowledge(userMsg);
          console.log("Found chunks:", contextChunks.length);
        }
      } catch (err) {
        console.error("Knowledge retrieval failed:", err);
      }

      // 2. Call AI Assistant API
      const response = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: userMsg || (currentImage ? "Analyze this image" : ""),
          image: currentImage,
          context: contextChunks,
          patientContext: patientId ? { patientId, encounterId } : undefined
        }),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }

      const aiResponse = await response.json();
      
      // 3. Process Response
      const mode = aiResponse.mode || "general";
      const responseData = aiResponse.data || {};
      
      // Determine content to display in bubble
      let responseContent = "";
      if (mode === "clinical") responseContent = "Based on the symptoms, here is the clinical snapshot.";
      else if (mode === "educational") responseContent = "Here is the definition and key insights.";
      else if (mode === "lab") responseContent = "I've analyzed the lab results.";
      else responseContent = responseData.main || "I'm processing that.";

      setResponseMode(mode);
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: responseContent,
        mode: mode,
        data: responseData
      }]);

    } catch (error) {
      console.error("AI Assistant Error:", error);
      toast.error("Failed to connect to AI service. Using offline mode.");
      
      // Fallback to offline/general mode
      setResponseMode("general");
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "I'm having trouble connecting to the AI service. Please check your connection.",
        mode: "general",
        data: { main: "Connection Error: Unable to process request at this time." }
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleAddToPatient = () => {
    toast.success("Added to Patient Record");
  };

  const handleSaveToLibrary = () => {
    toast.success("Saved to Personal Library");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] relative bg-[#F8FAFC]">
      {/* HEADER: Explicit Height + z-index fix for Admin Buttons */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 sticky top-0 z-[100] shadow-sm shrink-0">
        <div className="flex items-center gap-2">
           {/* Back Button (Mobile Optimized) */}
          <BackNavigation fallback="/" showQuickNav={true} size="icon" />

          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white shadow-sm">
            <Stethoscope size={18} />
          </div>
          
          <div className="flex flex-col">
            <h1 className="text-sm font-black uppercase tracking-tighter text-slate-900 leading-none">Diagnostic AI</h1>
            <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">
              {responseMode === 'clinical' ? 'Clinical Mode' : responseMode === 'educational' ? 'Education Mode' : 'Expert Mode'}
            </span>
          </div>
        </div>

        <div className="flex gap-1">
          {/* Action Buttons */}
          <button 
            onClick={handleClearChat}
            title="Clear Chat History"
            className="h-9 w-9 rounded-lg border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition-colors"
          >
            <Trash2 size={16} />
          </button>
          
          <Link href="/knowledge" title="Knowledge Admin">
            <button className="h-9 w-9 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-emerald-600 flex items-center justify-center transition-colors">
              <Files size={16} />
            </button>
          </Link>
          <Link href="/patients?action=new" title="New Patient">
             <button className="h-9 w-9 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-emerald-600 flex items-center justify-center transition-colors">
              <Plus size={16} />
            </button>
          </Link>
          <Link href="/" title="Dashboard">
             <button className="h-9 w-9 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-emerald-600 flex items-center justify-center transition-colors">
              <Home size={16} />
            </button>
          </Link>
        </div>
      </header>

      {/* CHAT CONTAINER */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 pb-24 scroll-smooth">
        {!isOnline && (
           <div className="flex justify-center">
             <div className="bg-amber-50 text-amber-700 text-xs px-3 py-1 rounded-full border border-amber-200 flex items-center gap-1">
               <CloudOff size={12} /> Offline Mode
             </div>
           </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={cn("flex flex-col", msg.role === "user" ? "items-end" : "items-start")}>
            
            {/* USER BUBBLE */}
            {msg.role === "user" && (
              <div className="flex flex-col items-end gap-2 max-w-[85%]">
                {msg.data?.image && (
                  <div className="relative h-[200px] w-full rounded-xl overflow-hidden border-2 border-emerald-500/20 shadow-sm">
                    <Image 
                      src={msg.data.image} 
                      alt="User upload" 
                      fill
                      className="object-cover" 
                    />
                  </div>
                )}
                {msg.content && (
                  <div className="bg-emerald-600 text-white px-4 py-3 rounded-2xl rounded-tr-none shadow-lg text-sm leading-relaxed">
                    {msg.content}
                  </div>
                )}
              </div>
            )}

            {/* AI SYSTEM GREETING */}
            {msg.role === "assistant" && msg.mode === "general" && !msg.data?.title && (
               <div className="w-full flex justify-center py-4">
                 <div className="bg-slate-100 px-4 py-2 rounded-full border border-slate-200 flex items-center gap-2">
                   <Bot size={14} className="text-emerald-600" />
                   <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{msg.content}</span>
                 </div>
               </div>
            )}

            {/* AI CLINICAL CARDS */}
            {msg.role === "assistant" && msg.mode === "clinical" && (
              <div className="w-full max-w-xl space-y-3">
                 <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-r-2xl shadow-sm">
                   <p className="text-[10px] font-black text-rose-400 uppercase mb-1 flex items-center gap-1.5"><Activity size={12}/> {msg.data.title}</p>
                   <p className="text-sm font-bold text-slate-900">{sanitize(msg.data.main)}</p>
                 </div>
                 
                 <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-r-2xl shadow-sm">
                   <p className="text-[10px] font-black text-emerald-400 uppercase mb-1 flex items-center gap-1.5"><Pill size={12}/> Treatment Plan</p>
                   <p className="text-sm text-slate-800 leading-relaxed">{sanitize(msg.data.treatment)}</p>
                 </div>

                 <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                   <p className="text-[10px] font-black text-blue-400 uppercase mb-1 flex items-center gap-1.5"><Info size={12}/> Clinical Rationale</p>
                   <p className="text-xs text-slate-600 leading-relaxed">{sanitize(msg.data.rationale)}</p>
                   
                   <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                     <span className="text-[10px] font-bold text-slate-400 uppercase">{msg.data.source}</span>
                     
                     {/* CONTEXT AWARE ACTION BUTTON */}
                     {(patientId || encounterId || msg.data.treatment) ? (
                        <button 
                          onClick={handleAddToPatient}
                          className="text-[10px] font-bold text-emerald-600 uppercase flex items-center gap-1 hover:underline"
                        >
                          <Plus size={12}/> Add to Patient
                        </button>
                     ) : (
                        <button 
                          onClick={handleSaveToLibrary}
                          className="text-[10px] font-bold text-blue-600 uppercase flex items-center gap-1 hover:underline"
                        >
                          <Bookmark size={12}/> Save to Library
                        </button>
                     )}
                   </div>
                 </div>
              </div>
            )}

            {/* AI EDUCATIONAL CARDS */}
            {msg.role === "assistant" && msg.mode === "educational" && (
              <div className="w-full max-w-xl space-y-3">
                <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl">
                  <p className="text-[10px] font-black text-emerald-400 uppercase mb-1 flex items-center gap-1.5"><BookOpen size={12}/> {msg.data.title}</p>
                  <p className="text-lg font-bold">{sanitize(msg.data.main)}</p>
                  <p className="text-xs text-slate-400 leading-relaxed mt-2">{sanitize(msg.data.insight)}</p>
                  
                  <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">{msg.data.source}</span>
                    <div className="flex gap-2">
                       <button className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase hover:text-white"><Copy size={12}/> Copy</button>
                       <button onClick={handleSaveToLibrary} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase hover:text-white"><Bookmark size={12}/> Save</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AI LAB CARDS */}
            {msg.role === "assistant" && msg.mode === "lab" && (
              <div className="w-full max-w-xl space-y-3">
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-2xl shadow-sm">
                  <p className="text-[10px] font-black text-blue-400 uppercase mb-1 flex items-center gap-1.5"><Microscope size={12}/> {msg.data.title}</p>
                  <p className="text-sm font-bold text-slate-900">{sanitize(msg.data.main)}</p>
                </div>
                 <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                   <p className="text-[10px] font-black text-slate-400 uppercase mb-1 flex items-center gap-1.5"><Info size={12}/> Interpretation</p>
                   <p className="text-xs text-slate-600 leading-relaxed">{sanitize(msg.data.insight)}</p>
                   <div className="mt-2 p-2 bg-slate-50 rounded border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Recommendation</p>
                      <p className="text-xs text-slate-700">{sanitize(msg.data.takeaway)}</p>
                   </div>
                   
                   <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                     <span className="text-[10px] font-bold text-slate-400 uppercase">{msg.data.source}</span>
                     {(patientId || encounterId) && (
                        <button 
                          onClick={handleAddToPatient}
                          className="text-[10px] font-bold text-emerald-600 uppercase flex items-center gap-1 hover:underline"
                        >
                          <Plus size={12}/> Add to Patient
                        </button>
                     )}
                   </div>
                 </div>
              </div>
            )}

            {/* SIMPLE RESPONSE */}
            {msg.role === "assistant" && msg.mode === "general" && msg.data?.main && !msg.data?.title && (
               <div className="flex gap-3 max-w-[90%]">
                 <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-emerald-500 shrink-0">
                   <Bot size={18}/>
                 </div>
                 <div className="bg-white border border-slate-200 p-4 rounded-2xl rounded-tl-none shadow-sm text-sm text-slate-700 leading-relaxed">
                   {msg.content}
                 </div>
               </div>
            )}

          </div>
        ))}

        {isTyping && (
           <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-emerald-500 shrink-0">
                   <Loader2 size={16} className="animate-spin"/>
               </div>
               <span className="text-xs text-slate-400 self-center">Afia is thinking...</span>
           </div>
        )}
      </div>

      {/* INPUT BAR: Floating on bottom, Z-Indexed below header but above chat */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white/95 to-transparent z-[50]">
        <div className="max-w-3xl mx-auto">
          {/* Image Preview */}
          {selectedImage && (
            <div className="mb-2 relative inline-block">
              <div className="h-20 w-20 rounded-xl border-2 border-emerald-200 overflow-hidden relative group">
                <Image 
                  src={selectedImage} 
                  alt="Preview" 
                  fill
                  className="object-cover" 
                />
                <button 
                  onClick={handleRemoveImage}
                  className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                >
                  <X className="text-white" size={20} />
                </button>
              </div>
            </div>
          )}

          <div className="relative group">
             <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()}
                  className="text-slate-400 hover:text-emerald-500 transition-colors"
                  title="Upload Image"
                >
                  <ImageIcon size={20} />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleImageSelect}
                />
             </div>
             <input 
               value={input}
               onChange={(e) => setInput(e.target.value)}
               onKeyDown={handleKeyDown}
               placeholder="Ask details, list image, or medical term..."
               className="w-full h-14 bg-white border-2 border-slate-200 rounded-2xl pl-12 pr-14 focus:border-emerald-500 focus:outline-none shadow-2xl shadow-slate-200/50 text-sm font-medium transition-all"
             />
             <button 
               type="submit"
               onClick={handleSendMessage}
               disabled={isTyping || (!input.trim() && !selectedImage)}
               className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center hover:bg-emerald-600 transition-all disabled:opacity-50 shadow-lg shadow-emerald-200"
             >
               {isTyping ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
             </button>
          </div>
          <div className="flex justify-center mt-3 gap-4">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-1"><ShieldCheck size={10}/> GHS Protocol Engine</span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-1"><Microscope size={10}/> Visual Lab AI</span>
          </div>
        </div>
      </div>

    </div>
  );
}
