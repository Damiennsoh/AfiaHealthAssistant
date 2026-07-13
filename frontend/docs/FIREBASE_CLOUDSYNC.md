# Firebase CloudSync Integration

Afia Health Assistant uses a **Hybrid Sync Architecture** that combines the speed of local-first storage (IndexedDB) with the collaboration features of the cloud (Firebase Firestore). This ensures that the application remains fully functional offline while enabling real-time, bidirectional data sharing across a clinic's team when online.

## Architecture Overview

### 1. Local-First Design (Source of Truth)
*   **Primary Storage**: All data (Patients, Encounters, AI Insights, Users) is first written to the local device's **IndexedDB**.
*   **Benefit**: Zero-latency reads/writes, works 100% offline, privacy-preserving.
*   **Reactivity**: The UI subscribes to the local database, ensuring that any background updates (from the cloud) are immediately reflected on screen without a refresh.

### 2. Cloud Mirror (Team Collaboration)
*   **Secondary Storage**: **Firebase Firestore** acts as a centralized "Clinic Cloud Folder."
*   **Purpose**: To synchronize data between different devices (e.g., OPD Nurse -> Doctor A -> Doctor B) within the same clinic.
*   **Scope**: Data is scoped by `clinicId`, ensuring one hospital cannot see another's records.
*   **Real-Time**: Changes made on one device are instantly propagated to others via Firestore listeners.

## Data Flow

### Upstream Sync (Local → Cloud)
*   **Triggers**: 
    1.  **Manual**: "Sync" button click.
    2.  **Automatic (Periodic)**: Runs every 60 seconds.
    3.  **Event-Driven**: Triggered immediately (with a 5s debounce) whenever a local record is created or updated.
*   **Function**: `syncAllDataToClinic` (in `lib/clinic-sync.ts`).
*   **Process (Delta Sync)**:
    1.  **Check Timestamp**: Retrieves the `afia_last_cloud_sync` timestamp from local storage.
    2.  **Filter**: Iterates through local IndexedDB tables (`patients`, `encounters`, `insights`) and selects only records modified (`updatedAt`) *after* the last sync.
    3.  **Batch Write**: Pushes these specific records to the corresponding Firestore collection under `artifacts/{appId}/clinics/{clinicId}/...`.
    4.  **Update Timestamp**: Updates the local sync timestamp upon successful commit.
*   **Benefit**: Drastically reduces Firestore write operations and bandwidth usage by avoiding full re-uploads of unchanged data.

### Downstream Sync (Cloud → Local)
*   **Trigger**: Real-time Firestore listeners (`onSnapshot` in `hooks/use-firestore-sync.ts`).
*   **Process**:
    1.  Listens for `added`, `modified`, or `removed` events in the clinic's collections.
    2.  **Conflict Resolution**: The system uses a smart `shouldUpdateLocal` helper:
        *   **Newer Wins**: If Cloud `updatedAt` > Local `updatedAt`, the local record is updated.
        *   **Safety Check**: If the local record has a valid timestamp but the cloud record is older, the incoming change is ignored (protecting local work).
        *   **Missing Local**: If the record doesn't exist locally, it is created.
    3.  **Deletions**:
        *   **Soft Delete**: If a record is marked `isDeleted: true` in the cloud, the local record is updated to reflect this (hiding it from the UI).
        *   **Hard Delete**: If a document is physically removed from Firestore (e.g., via Admin Console), the `removed` event triggers a **hard delete** in the local IndexedDB to ensure consistency.
    4.  **UI Refresh**: Active pages (like Encounter Details) listening to the DB will automatically re-render with the new data.

## Facility Data Archive ("Soft Wipe")
In scenarios where a facility's data needs to be archived or "wiped" from active devices without physical deletion:
1.  **Cloud Action**: An admin script marks all documents in the facility's collection as `isDeleted: true`.
2.  **Propagation**: Firestore pushes `modified` events to all connected devices.
3.  **Local Effect**: Every device updates its local records to `isDeleted: true`.
4.  **Result**: The data effectively "disappears" from the application UI on all devices but remains safely stored in both Firestore and local IndexedDB (hidden) for audit or recovery purposes.

## Data Model

All data is stored under a shared path structure to facilitate team access:

```text
artifacts/
  └── {appId}/
       └── clinics/
            └── {clinicId}/
                 ├── patients/
                 │    └── {patientId} (Document)
                 ├── encounters/
                 │    └── {encounterId} (Document)
                 ├── insights/
                 │    └── {insightId} (Document)
                 └── users/
                      └── {userId} (Document)
```

### Collections
1.  **Patients**: Demographics, NHIS info.
2.  **Encounters**: Vitals, consultation notes, diagnoses, treatment plans.
3.  **Insights**: AI-generated recommendations and chat logs.
4.  **Users**: Clinic staff profiles and roles.

## Security & Access Control

*   **Authentication**: Users must be authenticated (via Firebase Auth) to access sync features.
*   **Clinic Scoping**: Security rules ensure a user can only read/write to their assigned `clinicId`.
*   **Persistence**: Unlike the previous "Test Mode," this integration supports permanent production data.

## Troubleshooting

### Common Console Errors

1.  **`ReferenceError: BackNavigation is not defined`**:
    *   **Cause**: Missing import in a component.
    *   **Fix**: Ensure `import { BackNavigation } from "@/components/ui/back-navigation";` is present at the top of the file.

2.  **`net::ERR_QUIC_PROTOCOL_ERROR`**:
    *   **Cause**: Network firewall or ISP blocking the QUIC protocol (used by Google/Firebase services).
    *   **Fix**: 
        *   This is a client-side network issue, not an app bug.
        *   Can often be ignored if the app falls back to standard HTTPS automatically.
        *   To suppress locally: Go to `chrome://flags/#enable-quic` and Disable it.
