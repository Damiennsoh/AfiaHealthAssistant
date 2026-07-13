"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Stethoscope,
  BotMessageSquare,
  Paperclip,
  BookOpen,
  Wifi,
  WifiOff,
  Menu,
  X,
  Heart,
  ChevronRight,
  ArrowLeftRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/usePermissions";
import ProfileDropdown from "@/components/auth/ProfileDropdown";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { aiRequestDB } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, LogOut, Shield } from "lucide-react";
import HybridSync from "@/components/hybrid-sync";

const navItems = [
  {
    href: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
    description: "Overview",
  },
  {
    href: "/patients",
    label: "Patient Ledger",
    icon: Users,
    description: "OPD Registry",
  },
  {
    href: "/encounters",
    label: "Encounters",
    icon: Stethoscope,
    description: "Clinical Records",
  },
  {
    href: "/ai-assistant",
    label: "AI Assistant",
    icon: BotMessageSquare,
    description: "Diagnostic Aid",
  },
  {
    href: "/ai-requests",
    label: "AI Queue",
    icon: Paperclip,
    description: "Queued AI requests",
  },
];

import { ThemeToggle } from "@/components/theme-toggle";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isOnline = useOnlineStatus();
  const { user, logout } = useAuth();
  const { getUserDisplayName } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);
  const [processingCount, setProcessingCount] = useState(0);
  const [isSyncOpen, setIsSyncOpen] = useState(false);

  const handleSwitchUser = () => {
    logout();
    // Redirect to login page
    window.location.href = "/auth";
  };

  useEffect(() => {
    let mounted = true;
    async function loadCounts() {
      try {
        const all = await aiRequestDB.getAll();
        if (!mounted) return;
        setQueuedCount(all.filter((r:any)=>r.status==='queued').length);
        setProcessingCount(all.filter((r:any)=>r.status==='processing').length);
      } catch {}
    }
    
    loadCounts();
    
    // Subscribe to changes
    const unsubscribe = aiRequestDB.subscribe(loadCounts);
    
    // start upload processor
    import("@/lib/uploadQueue").then((m) => m.startUploadProcessor());
    import("@/lib/aiRequestQueue").then((m) => m.startAIRequestProcessor());
    
    return () => { 
      mounted = false; 
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setSidebarOpen(false);
          }}
          role="button"
          tabIndex={-1}
          aria-label="Close sidebar"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300 ease-in-out lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 border-b border-sidebar-border px-6 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar-primary">
            <Heart className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-sidebar-foreground">
              Afia Health
            </span>
            <span className="text-xs text-sidebar-foreground/60">
              CDSS for CHPS
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto text-sidebar-foreground lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close sidebar</span>
          </Button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium transition-all duration-200 relative",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <item.icon
                  className={cn(
                    "h-5 w-5 shrink-0",
                    isActive
                      ? "text-sidebar-primary"
                      : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80"
                  )}
                />
                <div className="flex flex-col">
                  <span>{item.label}</span>
                  <span
                    className={cn(
                      "text-[11px]",
                      isActive
                        ? "text-sidebar-primary/70"
                        : "text-sidebar-foreground/40"
                    )}
                  >
                    {item.description}
                  </span>
                </div>
                {isActive && (
                  <ChevronRight className="ml-auto h-4 w-4 text-sidebar-primary/60" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sync Button - Above Status Footer */}
        <div className="px-4 py-3">
          <button
            onClick={() => setIsSyncOpen(true)}
            className="w-full flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium transition-all duration-200 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground group"
          >
            <ArrowLeftRight
              className="h-5 w-5 shrink-0 text-sidebar-foreground/50 group-hover:text-sidebar-foreground"
            />
            <div className="flex flex-col">
              <span>Sync Data</span>
              <span className="text-[11px] text-sidebar-foreground/40">
                OPD ↔ Consulting
              </span>
            </div>
          </button>
        </div>

        {/* Status footer */}
        <div className="border-t border-sidebar-border px-4 pt-4 pb-8">
          <div className="flex items-center gap-3 rounded-xl bg-sidebar-accent/50 px-4 py-3">
            {isOnline ? (
              <Wifi className="h-4 w-4 text-success" />
            ) : (
              <WifiOff className="h-4 w-4 text-accent" />
            )}
            <div className="flex flex-col">
              <span className="text-xs font-medium text-sidebar-foreground">
                {isOnline ? "Online" : "Offline Mode"}
              </span>
              <span className="text-[10px] text-sidebar-foreground/50">
                {isOnline ? "AI features available" : "Data saved locally"}
              </span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Badge variant="secondary">Queued: {queuedCount}</Badge>
              <Badge variant="secondary">Processing: {processingCount}</Badge>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 items-center gap-4 border-b border-border bg-card px-4 lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open sidebar</span>
          </Button>

          <div className="flex flex-1 items-center gap-3">
            <h1 className="text-lg font-semibold text-foreground lg:hidden">
              Afia Health
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            
            {/* Profile dropdown */}
            <ProfileDropdown onSwitchUser={handleSwitchUser} />

            {/* Connection status pill */}
            <div
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium",
                isOnline
                  ? "bg-success/10 text-success"
                  : "bg-accent/10 text-accent"
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  isOnline ? "bg-success animate-pulse" : "bg-accent"
                )}
              />
              {isOnline ? "Connected" : "Offline"}
            </div>
            {/* Topbar queue badge */}
            <div className="ml-2">
              <Badge variant="secondary">Queue: {queuedCount}</Badge>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">{children}</main>
      </div>

      {/* Hybrid Sync Modal */}
      <HybridSync isOpen={isSyncOpen} onClose={() => setIsSyncOpen(false)} />
    </div>
  );
}
