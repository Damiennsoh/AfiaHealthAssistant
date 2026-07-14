"use client";

import { useEffect } from "react";

export default function LoginPage() {
  useEffect(() => {
    // Redirect to home page where AuthWrapper handles authentication
    window.location.href = "/";
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
          <div className="w-8 h-8 bg-emerald-600 rounded-full animate-ping"></div>
        </div>
        <p className="text-slate-600 font-medium">Redirecting to login...</p>
      </div>
    </div>
  );
}
