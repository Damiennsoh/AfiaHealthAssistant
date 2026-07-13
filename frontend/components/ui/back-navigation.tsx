"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home, Users, Stethoscope, BotMessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface BackNavigationProps {
  /** Default fallback route */
  fallback?: string;
  /** Custom label for the back button */
  label?: string;
  /** Show additional quick navigation options */
  showQuickNav?: boolean;
  /** Custom className for styling */
  className?: string;
  /** Size variant for the button */
  variant?: "default" | "outline" | "ghost" | "secondary";
  /** Size variant for the button */
  size?: "default" | "sm" | "lg" | "icon";
  /** Force quick navigation to be visible on mobile */
  forceQuickNavMobile?: boolean;
}

export function BackNavigation({ 
  fallback = "/", 
  label = "Back", 
  showQuickNav = false,
  forceQuickNavMobile = false,
  className = "",
  variant = "ghost",
  size = "sm"
}: BackNavigationProps) {
  const router = useRouter();

  const handleBack = (e?: React.MouseEvent) => {
    // 0. Prevent default browser behavior for button clicks
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // 1. Try to go back in history first
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      // 2. Fallback to provided route
      router.push(fallback);
    }
  };

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {/* Primary back button */}
      <Button
        variant={variant}
        size={size}
        onClick={handleBack}
        className={cn(
          "gap-2 hover:bg-accent/50 transition-colors shrink-0",
          size === "icon" && "rounded-full"
        )}
        title={label}
      >
        <ArrowLeft className="h-4 w-4" />
        {size !== "icon" && <span>{label}</span>}
      </Button>

      {/* Quick navigation options */}
      {showQuickNav && (
        <div className={cn(
          "items-center gap-1.5",
          forceQuickNavMobile ? "flex" : "hidden md:flex"
        )}>
          <div className="h-4 w-px bg-border mx-1 opacity-50" />
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/")}
            className="h-8 w-8 rounded-full hover:bg-accent/50 transition-colors shrink-0"
            title="Dashboard"
          >
            <Home className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/patients")}
            className="h-8 w-8 rounded-full hover:bg-accent/50 transition-colors shrink-0"
            title="Patient Ledger"
          >
            <Users className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/encounters")}
            className="h-8 w-8 rounded-full hover:bg-accent/50 transition-colors shrink-0"
            title="Encounters"
          >
            <Stethoscope className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/ai-assistant")}
            className="h-8 w-8 rounded-full hover:bg-accent/50 transition-colors shrink-0"
            title="AI Assistant"
          >
            <BotMessageSquare className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
