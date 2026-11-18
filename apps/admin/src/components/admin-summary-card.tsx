"use client";

import { api } from "@mybjj/backend/convex/_generated/api";
import { useQuery } from "convex/react";

export function AdminSummaryCard() {
  const gyms = useQuery(api.gyms.getAllGyms);

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>Platform Snapshot</h2>
      <p style={{ marginBottom: 0 }}>
        {gyms === undefined
          ? "Loading gyms..."
          : `Gyms registered: ${gyms.length}`}
      </p>
    </div>
  );
}
