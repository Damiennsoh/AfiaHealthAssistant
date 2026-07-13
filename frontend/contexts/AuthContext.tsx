/**
 * Compatibility shim — redirects legacy @/contexts/AuthContext imports
 * to the new AfiaAuthContext. Remove this once all imports are updated.
 */
export { useAuth, AuthProvider, withAuth } from './AfiaAuthContext';
