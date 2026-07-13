# Hybrid Client-Side Authentication Architecture Documentation

## Overview

This document describes a hybrid client-side authentication system designed for offline-first applications. User credentials and profile data are securely stored in **IndexedDB** (`afia-health-db`), while active session state is maintained in browser **localStorage**. This approach combines robust data storage with simple session persistence.

## Architecture Principles

1.  **Client-Only Storage**: No server API calls for auth operations; works completely offline.
2.  **IndexedDB Persistence**: User records are stored in a structured, queryable database (`users` store in `afia-health-db`).
3.  **Session Persistence**: Active session token/state survives browser restarts via `localStorage`.
4.  **Immediate Availability**: No network latency for authentication.
5.  **Simple & Reliable**: No complex token management or server-side session handling.

---

## Core Components

### 1. Storage Layers

*   **IndexedDB (`afia-health-db`)**:
    *   **Store**: `users`
    *   **Purpose**: Persistent storage of user accounts, credentials (hashed/encrypted ideally, or PINs), and profiles.
    *   **Indexes**: `staffId` (unique), `role`, `facility`.

*   **LocalStorage**:
    *   **Key**: `afia-auth-session`
    *   **Purpose**: Stores the currently logged-in user's session data (non-sensitive).

### 2. Data Structures

#### User Interface (Stored in IndexedDB)
```typescript
interface User {
  id: string              // Unique identifier
  staffId: string         // Username/Staff ID for login (Unique)
  name: string            // Display name
  pin: string            // Authentication PIN
  role: string           // User role (admin, healthworker, etc.)
  facility: string       // Organization/facility
  department: string     // Department
  securityQuestion: string   // For password recovery
  securityAnswer: string     // For password recovery verification
  createdAt: string
  updatedAt: string
}
```

#### AuthUser Interface (Session Data)
```typescript
interface AuthUser {
  id: string
  staffId: string
  name: string
  role: string
  facility: string
  department: string
}
```

### 3. Authentication Flow

#### Login
1.  User enters `Staff ID` and `PIN`.
2.  System queries `users` store in IndexedDB by `staffId`.
3.  If found, validates `PIN` against stored record.
4.  If valid:
    *   Creates `AuthUser` object (stripping sensitive fields).
    *   Saves `AuthUser` to `localStorage` (`afia-auth-session`).
    *   Updates `lastLogin` timestamp in IndexedDB.
    *   Sets application state to `authenticated`.

#### Logout
1.  Clears `afia-auth-session` from `localStorage`.
2.  Resets application state to `unauthenticated`.
3.  Redirects to login page.

#### Session Restoration (App Load)
1.  Checks `localStorage` for `afia-auth-session`.
2.  If found and valid, restores `user` state and sets `isAuthenticated = true`.
3.  If missing or invalid, redirects to login.

### 4. User Management (Admin)

*   **Registration**: Admins can add new users directly to IndexedDB.
*   **Listing**: `userDB.getAll()` retrieves all registered staff.
*   **Modification**: Roles and details can be updated locally.
*   **Deletion**: Users can be removed from the local device.

## Migration Note

The system includes logic to migrate users from the legacy `localStorage` key (`afia-users`) to IndexedDB upon initialization, ensuring backward compatibility with previous versions.
