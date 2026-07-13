"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AIAssistant } from "@/components/ai-assistant";
import { AfiaAssistant } from "@/components/AfiaAssistant";

function AIAssistantContent() {
  const searchParams = useSearchParams();
  const encounterId = searchParams.get("encounterId");

  if (encounterId) {
    return <AfiaAssistant />;
  }
  return <AIAssistant />;
}

export default function AIAssistantPage() {
  return (
    <AppShell>
      <Suspense fallback={<PageSkeleton />}>
        <AIAssistantContent />
      </Suspense>
    </AppShell>
  );
}

function PageSkeleton() {
  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div className="h-8 w-64 animate-pulse rounded bg-muted" />
      <div className="flex-1 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
