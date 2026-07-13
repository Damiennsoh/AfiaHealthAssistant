"use client";

import React, { useEffect, useState } from "react";
import { uploadDB } from "@/lib/db";

export default function UploadList() {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const all = await uploadDB.getAll();
      setItems(all as any[]);
    })();
  }, []);

  return (
    <div className="p-4 bg-white rounded shadow">
      <h3 className="font-semibold mb-2">Local Uploads</h3>
      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-3 border p-2 rounded">
            <div className="h-12 w-12 overflow-hidden rounded">
              {it.blob ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={URL.createObjectURL(it.blob)} alt={it.name || "Upload"} className="h-full w-full object-cover" />
              ) : (
                <div className="h-12 w-12 bg-muted" />
              )}
            </div>
            <div className="flex-1">
              <div className="font-medium">{it.name}</div>
              <div className="text-xs text-muted-foreground">{it.status} • {new Date(it.createdAt).toLocaleString()}</div>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="text-sm text-muted-foreground">No uploads yet</div>}
      </div>
    </div>
  );
}
