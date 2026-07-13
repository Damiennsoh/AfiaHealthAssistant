"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { aiRequestDB } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function AIRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);

  const load = async () => {
    const all = await aiRequestDB.getAll();
    setRequests(all.sort((a:any,b:any)=> (a.createdAt>b.createdAt? -1:1)));
  };

  useEffect(() => { 
    load(); 
    const unsubscribe = aiRequestDB.subscribe(load);
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const remove = async (id:string) => {
    await aiRequestDB.delete(id);
    toast.success("Deleted request");
    load();
  };

  const retry = async (r:any) => {
    await aiRequestDB.save({ ...r, status: "queued", completedAt: null });
    toast.success("Request re-queued");
    load();
  };

  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">AI Request Queue</h1>
        {requests.length === 0 ? (
          <Card>
            <CardContent>
              No queued requests.
            </CardContent>
          </Card>
        ) : (
          requests.map((r) => (
              <Card key={r.id} className="border-border/60">
                <CardHeader>
                  <CardTitle className="flex justify-between items-center gap-4">
                    <div>
                      <span className="font-medium">{r.type}</span>
                      <div className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</div>
                    </div>
                    <div>
                      <Badge variant={r.status === 'completed' ? 'outline' : r.status === 'failed' ? 'destructive' : 'secondary'}>
                        {r.status}
                      </Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-sm">
                    <strong>Payload:</strong>
                    <pre className="whitespace-pre-wrap text-xs mt-1">{r.payload}</pre>
                  </div>
                  {r.response && (
                    <div className="text-sm">
                      <strong>Response:</strong>
                      <pre className="whitespace-pre-wrap text-xs mt-1">{r.response}</pre>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button onClick={() => retry(r)}>Retry</Button>
                    <Button variant="outline" onClick={() => remove(r.id)}>Delete</Button>
                  </div>
                </CardContent>
              </Card>
          ))
        )}
      </div>
    </AppShell>
  );
}
