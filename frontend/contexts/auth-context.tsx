/**
 * Compatibility shim — redirects legacy @/contexts/auth-context (kebab-case) imports
 * to the new AfiaAuthContext. Remove this once all imports are updated.
 */
export { useAuth, AuthProvider, withAuth } from './AfiaAuthContext';
