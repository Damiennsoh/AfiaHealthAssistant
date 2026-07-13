
'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html>
      <body className="font-sans antialiased min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border border-slate-100 flex flex-col items-center animate-in fade-in zoom-in duration-300">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6 border border-red-100">
            <AlertTriangle className="h-10 w-10 text-red-500" />
          </div>
          
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Critical System Error</h1>
          <p className="text-slate-500 mb-8 text-sm text-center">
            The application encountered a critical error and cannot continue.
          </p>
          
          <Button 
            onClick={reset}
            className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-lg shadow-emerald-200"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Restart Application
          </Button>
        </div>
      </body>
    </html>
  )
}
