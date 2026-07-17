import React from "react"
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as SonnerToaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/contexts/AfiaAuthContext'
import { SyncProvider } from '@/contexts/SyncContext'
import AuthWrapper from '@/components/auth/AuthWrapper'
import { ThemeProvider } from "@/components/theme-provider"
import { ServiceWorkerRegister } from "@/components/service-worker-register"
import './globals.css'

// If you add local font files under /public/fonts, globals.css will load them.

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });
export const metadata: Metadata = {
  title: 'Afia Health Assistant',
  description: 'Privacy-First, Offline-Ready Clinical Decision Support System for rural Ghanaian clinics and CHPS compounds',
  generator: 'v0.app',
  manifest: '/manifest.json',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#1a7a5a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <SyncProvider>
              <AuthWrapper>
                {children}
              </AuthWrapper>
            </SyncProvider>
          </AuthProvider>
          <Toaster />
          <SonnerToaster position="top-right" richColors />
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  )
}
