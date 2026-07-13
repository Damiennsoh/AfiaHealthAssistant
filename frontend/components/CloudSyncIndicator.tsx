"use client";

import React, { useEffect, useState } from "react";
import { 
  Cloud, 
  RefreshCw, 
  CheckCircle2, 
  WifiOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * CloudSyncIndicator
 * Shows online/offline status. Cloud sync is now handled server-side
 * via the FastAPI backend — this component reflects connectivity state only.
 */
export function CloudSyncIndicator({ className }: { className?: string }) {
  const [isOnline, setIsOnline] = useState(
    typeof window !== "undefined" ? navigator.onLine : true
  );
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [showStatus, setShowStatus] = useState(false);

  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); setLastChecked(new Date()); };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (lastChecked && isOnline) {
      setShowStatus(true);
      const timer = setTimeout(() => setShowStatus(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [lastChecked, isOnline]);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-9 w-9 rounded-full p-0 transition-all duration-300",
                !isOnline ? "bg-slate-100 text-slate-400" : "",
                isOnline && showStatus ? "text-emerald-600" : ""
              )}
              onClick={() => setLastChecked(new Date())}
            >
              {!isOnline ? (
                <WifiOff className="h-4 w-4" />
              ) : showStatus ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Cloud className="h-4 w-4" />
              )}
              <span className="sr-only">Connection Status</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {!isOnline
              ? "Offline — local data only"
              : lastChecked
              ? `Online • checked ${lastChecked.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : "Online"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {!isOnline && (
        <span className={cn(
          "text-[10px] font-medium animate-in fade-in slide-in-from-left-1 duration-300 hidden sm:inline-block text-slate-500"
        )}>
          Offline
        </span>
      )}
    </div>
  );
}
