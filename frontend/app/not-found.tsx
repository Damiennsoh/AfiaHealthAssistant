
"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { FileQuestion, Home, ArrowLeft } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
      <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border border-slate-100 flex flex-col items-center animate-in fade-in zoom-in duration-300">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
          <FileQuestion className="h-10 w-10 text-slate-400" />
        </div>
        
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Page Not Found</h1>
        <p className="text-slate-500 mb-8">
          The page you are looking for doesn&apos;t exist or has been moved.
        </p>
        
        <div className="space-y-3 w-full">
          <Button asChild className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-lg shadow-emerald-200">
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Return to Dashboard
            </Link>
          </Button>
          
          <Button asChild variant="ghost" className="w-full h-12 rounded-xl text-slate-600 hover:bg-slate-50">
            <Link href="#" onClick={() => history.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Link>
          </Button>
        </div>
      </div>
      
      <div className="mt-8 text-xs text-slate-400 font-medium">
        Afia Health Assistant
      </div>
    </div>
  )
}
