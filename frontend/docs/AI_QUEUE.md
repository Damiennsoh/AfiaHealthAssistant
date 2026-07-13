# AI Queue System Documentation

## Overview

The AI Queue System is a core component of the Afia Health Assistant designed to ensure reliability and offline-first capability. It allows clinicians to make AI requests (such as clinical queries or image analysis) even when the device is offline or has a poor internet connection. Requests are persisted locally and processed automatically when connectivity is restored.

## Key Features

- **Offline-First:** Requests are saved to local storage immediately.
- **Automatic Processing:** A background processor monitors network status and processes the queue automatically.
- **Persistence:** Uses IndexedDB to ensure requests survive page reloads and browser restarts.
- **Concurrency Control:** Processes requests sequentially to prevent network congestion.
- **Retry Mechanism:** Failed requests can be retried manually or automatically (future enhancement).

## Architecture

The system consists of three main layers:

1.  **Storage Layer (`lib/db.ts`):** Uses IndexedDB to store request data, status, and responses.
2.  **Processing Layer (`lib/aiRequestQueue.ts`):** Manages the queue logic, processes requests, and handles API communication.
3.  **UI Layer (`app/ai-requests/page.tsx` & `components/app-shell.tsx`):** Provides visual feedback and control to the user.

### Data Model

Each AI Request is stored with the following structure:

```typescript
interface AIRequest {
  id: string;              // Unique identifier
  type: 'image-analysis' | 'chat' | 'diagnosis';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  payload: any;            // The data needed for the request (prompt, image blob, etc.)
  response?: any;          // The AI's response once completed
  createdAt: string;       // Timestamp
  error?: string;          // Error message if failed
}
```

## Workflow

1.  **Submission:**
    - When a user submits a request (e.g., asks a question or uploads an image), the application calls `aiRequestDB.add()`.
    - The request is saved with status `queued`.

2.  **Processing Loop:**
    - The `AppShell` component initializes the processor via `startAIRequestProcessor()`.
    - This processor runs on a set interval (e.g., every 3-5 seconds).
    - It checks:
        - Is the device online?
        - Is the processor already running?
        - Are there items in the queue?

3.  **Execution:**
    - If conditions are met, the processor picks the oldest `queued` item.
    - It updates the status to `processing`.
    - It attempts to send the request to the backend API (`/api/afia`).
    - **Success:** Status updates to `completed`, and the response is saved.
    - **Failure:** Status updates to `failed`, and the error is logged.

4.  **UI Updates:**
    - The "AI Queue" page polls the database to show real-time status.
    - The Dashboard sidebar shows a badge count of queued items.

## Database Debug Information vs. AI Queue

There are two interfaces that display queue information, but they serve different purposes:

### 1. AI Queue Page (`/ai-requests`)
*   **Target Audience:** Clinicians / End Users.
*   **Purpose:** To track their specific requests.
*   **Actions:** Users can see their history, view responses, retry failed requests, or delete them.
*   **Focus:** Content and outcomes.

### 2. Database Debug Information (`components/database-debug.tsx`)
*   **Target Audience:** Administrators / Developers / Technical Support.
*   **Purpose:** System health monitoring.
*   **Actions:**
    *   **Force Refresh:** Manually reload stats.
    *   **Clear Stuck Tasks:** Emergency maintenance tool to reset items that might be stuck in "processing" state due to a browser crash or bug.
*   **Focus:** Counts, system states, and raw technical health.
*   **Recommendation:** This tool should be kept hidden or minimized for normal users but is vital for troubleshooting.

## Troubleshooting

If requests seem stuck:
1.  Check internet connectivity.
2.  Open the **Database Debug Information** panel on the dashboard.
3.  Click "Clear Stuck Tasks" if a request has been "processing" for an unreasonable amount of time.
