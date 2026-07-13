"use client";

import React from "react";
import { Cloud } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

/**
 * AFIA HYBRID SYNC ENGINE
 * This component needs to be migrated from Firebase to the new backend API.
 * Temporarily disabled with placeholder UI.
 */

interface HybridSyncProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function HybridSync({ isOpen, onClose }: HybridSyncProps = {}) {
  if (!isOpen) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full max-w-md p-0 border-l border-slate-100 bg-slate-50/95 backdrop-blur-md">
        <SheetHeader className="sr-only">
          <SheetTitle>Data Synchronization</SheetTitle>
        </SheetHeader>

        <div className="h-full flex flex-col items-center justify-center p-8 text-center">
          <Cloud className="h-16 w-16 text-slate-400 mb-4" />
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Sync Migration Required</h3>
          <p className="text-sm text-slate-600 mb-6">
            The sync functionality needs to be migrated from Firebase to the new backend API.
            This component is temporarily disabled.
          </p>
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
