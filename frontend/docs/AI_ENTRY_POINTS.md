# Afia Health Assistant - AI Entry Points Documentation

This document outlines all AI-related components in the Afia Health Assistant application, their locations, functions, and how to identify them for development purposes.

---

## 1. AfiaChat (Dashboard AI Widget)

**File**: `components/afia-chat.tsx`

**Route/Entry**: Dashboard home page (`/`)

**Description**:  
A compact chat widget embedded directly within the dashboard interface. Provides quick AI query capabilities without navigating away from the main dashboard.

**Key Features**:
- Compact input area at bottom of widget
- Inline response rendering within dashboard layout
- Image upload with crop functionality
- "Save to Patient" integration
- Typing animation effect for responses
- Mobile-responsive design

**Usage Context**: Used for quick questions while reviewing dashboard statistics and patient lists.

**When to Edit**: Use this name when you want changes to the dashboard's embedded AI chat widget.

---

## 2. AIAssistant (Main Diagnostic AI Page)

**File**: `components/ai-assistant.tsx`

**Route/Entry**: `/ai-assistant` (accessed via "Diagnostic Aid" navigation button)

**Description**:  
The primary full-page AI diagnostic interface featuring a **mobile-first Clinical Snapshot Card** design. This is the main entry point for comprehensive AI-assisted clinical consultations.

**Key Features**:
- **Full-page dedicated chat interface** with expanded vertical space
- **Persistent chat history** across sessions
- **Multimodal Image Analysis**:
  - **Direct File Upload**: Upload scanned images/lab results directly from chat
  - **Handwriting Recognition**: AI analyzes handwritten notes and forms
  - **Mobile-first Input**: Integrated camera/file picker
  - **Preview & Send**: Review images before submission
- **Clinical Snapshot Card UI** - Mobile-first responsive design
- **Color-coded section cards** for Diagnosis (rose), Treatment (emerald), Rationale (blue), etc.
- **Persistent card layout** - Non-foldable, always-visible sections
- **Text sanitization** - Removes markdown artifacts (`#`, `*`, `_`, `` ` ``, `~`)
- **Protocol chatter removal** - Strips "Per GHS STG..." references
- **Database Debug Tool** - Integrated system monitor (sidebar mode)
- **Granular "Add to Patient"** functionality (per section + global save)
- **Protocol source citations** with GHS badge indicators
- **Greeting overlap fix** - Proper spacing and padding

**Usage Context**: Primary interface for clinical decision support and detailed diagnostic queries.

**When to Edit**: Use this name when you want changes to the main full-page AI diagnostic interface.

---

## 3. AfiaAssistant (Clinical Hub / Encounter AI)

**File**: `components/AfiaAssistant.tsx`

**Route/Entry**: Opens as modal/sidebar from encounters page (triggered via "Clinical Hub" button)

**Description**:  
A context-aware clinical assistant designed specifically for analyzing existing patient encounters. Integrates deeply with patient records and encounter data.

**Key Features**:
- Auto-analyzes patient encounter data on open
- Structured clinical response display (Diagnosis, Treatment, Rationale)
- GHS Protocol badge indication (shows if advice comes from local protocols)
- Direct sync to patient records
- Contextual patient data pre-loading
- Disclaimer handling for non-protocol responses

**Usage Context**: Used when reviewing existing patient encounters to get AI analysis of already-recorded clinical data.

**When to Edit**: Use this name when you want changes to the encounter-specific AI sidebar/modal.

---

## 4. ClinicalResponseRenderer

**File**: `components/clinical-response-renderer.tsx`

**Type**: Shared Component (used by AIAssistant)

**Description**:  
A specialized rendering component that transforms raw AI text responses into structured, **persistent color-coded Clinical Snapshot Cards**. This is the core UI engine for the mobile-first AI response display.

**Key Features**:
- **Section Parsing**: Automatically extracts Diagnosis, Assessment, Treatment, Rationale, Prescription, Investigations, Counseling, Danger Signs, Disclaimer
- **Color-coded badges** with Lucide icons for each section type
- **Persistent card layout** - Sections are always visible, non-foldable
- **Text sanitization** - Strips markdown: `#`, `*`, `_`, `` ` ``, `~`
- **Protocol reference removal** - Cleans "Per GHS STG..." AI chatter
- **Mobile-optimized** responsive card layout
- **Individual "Add to Patient"** buttons per section
- **Global "Save All"** functionality

**Section Color Scheme**:
- Diagnosis: Rose (`bg-rose-50`, `text-rose-900`)
- Treatment: Emerald (`bg-emerald-50`, `text-emerald-900`)
- Rationale: Blue (`bg-blue-50`, `text-blue-900`)
- Prescription: Sky (`bg-sky-50`, `text-sky-900`)
- Investigations: Violet (`bg-violet-50`, `text-violet-900`)
- Counseling: Teal (`bg-teal-50`, `text-teal-900`)
- Danger Signs: Red (`bg-red-50`, `text-red-900`)
- Disclaimer: Slate (`bg-slate-50`, `text-slate-700`)

**Usage Context**: Core rendering engine for AIAssistant. All AI responses pass through this component for formatting.

**When to Edit**: Use this name when you want changes to how AI responses are visually formatted, color-coded, or structured.

---

## 5. KnowledgeDebug

**File**: `components/ui/knowledge-debug.tsx`

**Type**: Debug Component

**Description**:  
A floating debug panel for testing and verifying the knowledge base functionality. **Intentionally limited to AIAssistant page only** - removed from Dashboard to avoid UI clutter.

**Key Features**:
- Floating button (bottom-right corner) with `fixed bottom-4 right-4 z-50`
- Test search functionality for knowledge base
- Displays search results and protocol matches
- Shows sync status and total chunks count
- Sample chunk preview

**Visibility Rules**:
- ✅ **Visible** on: `ai-assistant.tsx` (AI Assistant page)
- ❌ **Hidden** on: `afia-chat.tsx` (Dashboard), `dashboard-content.tsx`

**Usage Context**: Developer/admin tool for debugging knowledge base integration and protocol matching.

**When to Edit**: Use this name when you want changes to the knowledge base debugging interface or its visibility rules.

---

## Quick Reference Table

| Name | File | Context | Primary Use |
|------|------|---------|-------------|
| AfiaChat | `components/afia-chat.tsx` | Dashboard widget | Quick queries |
| AIAssistant | `components/ai-assistant.tsx` | Full page | Diagnostic consultations |
| AfiaAssistant | `components/AfiaAssistant.tsx` | Encounter modal | Patient encounter analysis |
| ClinicalResponseRenderer | `components/clinical-response-renderer.tsx` | Shared component | Response formatting |
| KnowledgeDebug | `components/ui/knowledge-debug.tsx` | Legacy | Unused |
| DatabaseDebug | `components/database-debug.tsx` | System Tool | Queue monitoring |

---

## Communication Guide for Developers

When requesting changes, use these exact names to avoid confusion:

- **"Update AfiaChat"** → Changes to dashboard widget
- **"Update AIAssistant"** or **"Update Diagnostic AI"** → Changes to main AI page
- **"Update AfiaAssistant"** or **"Update Clinical Hub"** → Changes to encounter sidebar
- **"Update ClinicalResponseRenderer"** → Changes to response card formatting
- **"Update KnowledgeDebug"** → Changes to debug panel

---

## Architecture Notes

- `AfiaChat` and `AIAssistant` are independent top-level components
- `AfiaAssistant` (Clinical Hub) is designed to be context-aware (requires encounter data)
- `ClinicalResponseRenderer` is the **core rendering engine** for AIAssistant - all responses are processed through it
- `KnowledgeDebug` is **conditionally rendered** and should only appear in diagnostic contexts (`ai-assistant.tsx`)
- **Mobile-first design** is prioritized across all AI interfaces
- **Text sanitization** happens at the renderer level to ensure clean output
- **Color-coded sections** provide immediate visual hierarchy for clinical data

---

*Last Updated: February 2026*
