"use client";
import React from "react";
import { useAuth } from "@/contexts/AfiaAuthContext";

/**
 * GuestSandboxBanner
 *
 * Displayed at the very top of the app when the user is logged in as the guest
 * demo account. Makes it crystal-clear that all data is ephemeral, local-only
 * and completely isolated from the production database.
 */
export default function GuestSandboxBanner() {
  const { isGuestMode } = useAuth();

  if (!isGuestMode) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        background: "linear-gradient(90deg, #f59e0b 0%, #d97706 100%)",
        color: "#1c1917",
        padding: "10px 20px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        fontSize: "13px",
        fontWeight: 600,
        letterSpacing: "0.01em",
        boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
        zIndex: 9999,
        position: "sticky",
        top: 0,
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <span style={{ fontSize: "18px" }}>🧪</span>
      <span>
        <strong>Guest Preview Mode — Sandbox Active</strong>&nbsp; All data you
        create (patients, encounters) is stored{" "}
        <em>locally on this device only</em> and is never uploaded to the
        production database. This is a safe, isolated demo environment.
      </span>
    </div>
  );
}
