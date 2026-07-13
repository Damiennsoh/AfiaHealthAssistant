/**
 * AFIA Health Assistant - Environment Configuration
 * Replace Firebase config with self-hosted backend settings
 */

export interface EnvironmentConfig {
  // API
  apiUrl: string;
  apiVersion: string;

  // Feature flags
  enableOfflineSync: boolean;
  enableAuditLogging: boolean;
  enableKnowledgeQuery: boolean;

  // Sync settings
  syncInterval: number;
  maxSyncRetries: number;

  // App info
  appName: string;
  appVersion: string;
  defaultCountry: 'GH' | 'ZW';
}

const environments: Record<string, EnvironmentConfig> = {
  development: {
    apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
    apiVersion: 'v1',
    enableOfflineSync: true,
    enableAuditLogging: true,
    enableKnowledgeQuery: true,
    syncInterval: 30000, // 30 seconds
    maxSyncRetries: 3,
    appName: 'AFIA Health Assistant',
    appVersion: '2.0.0-dev',
    defaultCountry: 'GH',
  },

  staging: {
    apiUrl: process.env.NEXT_PUBLIC_API_URL || 'https://staging.afia.local',
    apiVersion: 'v1',
    enableOfflineSync: true,
    enableAuditLogging: true,
    enableKnowledgeQuery: true,
    syncInterval: 60000, // 60 seconds
    maxSyncRetries: 3,
    appName: 'AFIA Health Assistant',
    appVersion: '2.0.0-staging',
    defaultCountry: 'GH',
  },

  production: {
    apiUrl: process.env.NEXT_PUBLIC_API_URL || 'https://afia.local',
    apiVersion: 'v1',
    enableOfflineSync: true,
    enableAuditLogging: true,
    enableKnowledgeQuery: true,
    syncInterval: 60000, // 60 seconds
    maxSyncRetries: 3,
    appName: 'AFIA Health Assistant',
    appVersion: '2.0.0',
    defaultCountry: 'GH',
  },
};

/**
 * Get current environment configuration
 */
export function getEnvironment(): EnvironmentConfig {
  const env = process.env.NEXT_PUBLIC_ENVIRONMENT || 'development';
  return environments[env] || environments.development;
}

/**
 * Current environment config (singleton)
 */
export const environment = getEnvironment();

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return (process.env.NEXT_PUBLIC_ENVIRONMENT || 'development') === 'development';
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return (process.env.NEXT_PUBLIC_ENVIRONMENT || 'development') === 'production';
}

export default environment;
