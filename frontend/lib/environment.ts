/**
 * AFIA Health Assistant — Environment Configuration
 */

export const environment = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1',
  isProduction: process.env.NODE_ENV === 'production',

  // Feature flags
  features: {
    offlineMode: true,      // Enable offline PWA
    syncEnabled: true,      // Enable background sync
    knowledgeBase: true,    // Enable RAG queries
    analytics: false,       // Enable usage analytics
  },

  // Knowledge base config
  knowledgeBase: {
    defaultCountry: 'GH',
    offlineCacheDuration: 7 * 24 * 60 * 60 * 1000, // 7 days
    maxOfflineChunks: 5000,
  },

  // Sync config
  sync: {
    autoSyncInterval: 5 * 60 * 1000, // 5 minutes
    maxRetries: 5,
    conflictResolution: 'server', // 'server' | 'client' | 'manual'
  },
};
