# AFIA Health Assistant - User Manual

> **A comprehensive guide for healthcare providers using the AFIA Health Assistant system**

---

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Login and Authentication](#login-and-authentication)
4. [Dashboard Overview](#dashboard-overview)
5. [Patient Management](#patient-management)
6. [Clinical Encounters](#clinical-encounters)
7. [AI Clinical Assistant](#ai-clinical-assistant)
8. [Knowledge Base Management](#knowledge-base-management)
9. [Settings and Configuration](#settings-and-configuration)
10. [Offline Mode](#offline-mode)
11. [Security Features](#security-features)
12. [Troubleshooting](#troubleshooting)

---

## Introduction

AFIA Health Assistant is a privacy-first, offline-capable clinical decision support system designed for healthcare facilities in Ghana and Zimbabwe. The system integrates:

- **GHS Standard Treatment Guidelines** (Ghana)
- **EDLIZ Essential Drug List** (Zimbabwe)
- **AI-powered clinical assistance** using advanced RAG technology
- **Offline-first architecture** for unreliable internet environments
- **Comprehensive patient management** with SOAP-note encounters

### Key Features

- **Multi-country Support**: Switch between Ghana (GHS) and Zimbabwe (EDLIZ) protocols
- **Offline Capability**: Continue working without internet connection
- **AI Clinical Guidance**: Get treatment recommendations based on official guidelines
- **Patient Records**: Manage patient history, vitals, diagnoses, and prescriptions
- **Secure Data**: AES-256 encryption and role-based access control
- **Data Sync**: Automatic synchronization when connection is restored

---

## Getting Started

### System Requirements

- **Device**: Desktop, tablet, or mobile device with modern web browser
- **Browser**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Internet**: Required for initial setup and data sync (offline mode available)
- **Account**: Admin-provided credentials (no self-registration)

### First-Time Setup

1. **Contact your clinic administrator** to receive your login credentials
2. **Open the application** using the URL provided by your organization
3. **Select your country** (Ghana or Zimbabwe) on the welcome screen
4. **Log in** with your provided email and password
5. **Complete your profile** if prompted (name, department, staff ID)

### Accessing the Application

- **Production URL**: Provided by your organization
- **Local Development**: http://localhost:3000 (for developers)

---

## Login and Authentication

### Login Process

1. **Navigate to the application URL**
2. **Select your country** from the options (Ghana/Zimbabwe)
3. **Enter your credentials**:
   - Email address (provided by admin)
   - Password (case-sensitive)
4. **Click "Sign In"** to access the dashboard

### Account Types

| Role | Permissions | Typical Users |
|------|-------------|---------------|
| **Super Admin** | Full system access, manage all clinics | System administrators |
| **Clinic Admin** | Manage clinic staff, patients, settings | Clinic managers |
| **Health Worker** | Patient care, encounters, prescriptions | Doctors, nurses, clinical officers |
| **Viewer** | Read-only access to patient data | Supervisors, researchers |

### Password Security

- **Minimum length**: 8 characters
- **Requirements**: At least one uppercase letter, one number, one special character
- **Lockout**: Account locked after 5 failed attempts (contact admin to unlock)
- **Reset**: Contact your clinic administrator to reset forgotten passwords

### Session Management

- **Session timeout**: 30 minutes of inactivity
- **Automatic logout**: For security protection
- **Remember me**: Not available (security feature)
- **Multi-device**: Limited to one active session per user

---

## Dashboard Overview

### Main Navigation

The dashboard provides quick access to all major features:

- **Patients**: Manage patient records and registration
- **Encounters**: View and create clinical encounters (SOAP notes)
- **AI Assistant**: Access AI-powered clinical guidance
- **Knowledge Base**: View and manage medical protocols
- **Settings**: Configure user and clinic preferences
- **Sync Status**: Monitor data synchronization

### Dashboard Widgets

- **Today's Patients**: Quick count of patients seen today
- **Pending Encounters**: Encounters requiring completion
- **Sync Status**: Current online/offline status
- **Recent Activity**: Latest clinical actions
- **Quick Actions**: Shortcuts to common tasks

### Country Selection

- **Ghana**: Uses GHS Standard Treatment Guidelines
- **Zimbabwe**: Uses EDLIZ Essential Drug List
- **Switching countries**: Requires logout and re-login

---

## Patient Management

### Registering a New Patient

1. **Navigate to Patients → New Patient**
2. **Enter patient information**:
   - **Folder Number**: Unique patient identifier (required)
   - **Full Name**: First and last name
   - **Date of Birth**: Age calculation
   - **Gender**: Male/Female/Other
   - **Phone Number**: Contact information
   - **NHIS Number** (Ghana): National Health Insurance Scheme ID
   - **Address**: Residential location
3. **Click "Save Patient"** to create the record

### Searching for Patients

- **By Folder Number**: Most precise search method
- **By Name**: Partial name matching supported
- **By Phone Number**: Alternative contact search
- **Advanced Filters**: Date range, gender, registration date

### Viewing Patient Details

- **Demographics**: Basic patient information
- **Medical History**: Previous diagnoses and conditions
- **Encounter History**: All past clinical visits
- **Prescriptions**: Current and previous medications
- **Vitals History**: Historical vital signs trends
- **NHIS Status** (Ghana): Insurance validation

### Editing Patient Information

1. **Open patient record**
2. **Click "Edit"** in the patient details
3. **Update required fields**
4. **Save changes** (syncs when online)

### Patient Privacy

- **Data Encryption**: All patient data encrypted at rest
- **Access Logging**: All views and accesses logged
- **Role-based Access**: Only authorized staff can view records
- **Audit Trail**: Complete history of all changes

---

## Clinical Encounters

### Creating a New Encounter

1. **Navigate to Encounters → New Encounter**
2. **Select patient** from search or recent list
3. **Complete SOAP sections**:

#### Subjective (S)
- **Chief Complaint**: Primary reason for visit
- **History of Present Illness**: Detailed symptom description
- **Patient History**: Relevant medical background
- **Notes**: Additional subjective information

#### Objective (O)
- **Vital Signs**:
  - Temperature (°C)
  - Blood Pressure (mmHg)
  - Heart Rate (bpm)
  - Respiratory Rate (breaths/min)
  - Oxygen Saturation (%)
  - Weight (kg)
  - Height (cm)
- **Physical Examination**: Systematic examination findings
- **Test Results**: Laboratory or imaging results

#### Assessment (A)
- **Primary Diagnosis**: Main condition identified
- **Secondary Diagnoses**: Comorbidities or additional conditions
- **Severity Assessment**: Condition severity level
- **Protocol Match**: System shows if GHS/EDLIZ protocol applies

#### Plan (P)
- **Prescriptions**: Medication orders with dosages
- **Referrals**: Specialist referrals if needed
- **Follow-up**: Next appointment date
- **Patient Education**: Instructions for patient
- **Investigations**: Additional tests ordered

4. **Click "Save Encounter"** to complete

### Using AI Assistance During Encounters

- **Real-time Suggestions**: AI provides treatment recommendations
- **Protocol Matching**: System identifies relevant GHS/EDLIZ protocols
- **Drug Interactions**: Checks for medication conflicts
- **Dosage Calculations**: Weight-based dosing for pediatrics
- **Citation References**: Links to official guideline sources

### Viewing Past Encounters

1. **Navigate to Patients → Select Patient**
2. **Click "Encounter History"**
3. **View encounter details** by date
4. **Print or export** if needed

### Editing Encounters

- **Time Limit**: Encounters can be edited within 24 hours
- **Audit Trail**: All changes logged with timestamp
- **Reason Required**: Must provide reason for edits
- **Approval**: May require supervisor approval for significant changes

---

## AI Clinical Assistant

### Accessing the AI Assistant

1. **Navigate to AI Assistant** from main menu
2. **Start a new consultation** or continue previous
3. **Enter patient context**:
   - Age, gender, weight
   - Vital signs
   - Symptoms and complaints
   - Current medications
4. **Submit query** for AI analysis

### AI Capabilities

- **Diagnosis Support**: Suggests possible diagnoses based on symptoms
- **Treatment Recommendations**: Protocol-aligned treatment options
- **Drug Information**: Dosage, interactions, contraindications
- **Protocol Retrieval**: Finds relevant GHS/EDLIZ guidelines
- **Differential Diagnosis**: Lists alternative diagnoses to consider
- **Patient Education**: Generates explanations for patients

### Understanding AI Responses

- **Confidence Levels**: High/Medium/Low confidence indicators
- **Source Citations**: References to official guidelines
- **Protocol Badges**: 
  - "GHS STG PROTOCOL" - Official Ghana guideline
  - "EDLIZ PROTOCOL" - Official Zimbabwe guideline
  - "General Medical Guidance" - General medical advice
- **Disclaimer**: Always verify AI suggestions with clinical judgment

### Best Practices

- **Provide Complete Information**: Include all relevant patient data
- **Verify Recommendations**: Cross-check with official guidelines
- **Use Clinical Judgment**: AI is a decision support tool, not replacement
- **Document Decisions**: Record why you accepted or rejected AI suggestions
- **Report Issues**: Notify admin of incorrect or problematic AI responses

### Limitations

- **Not Emergency Care**: Not suitable for emergency situations
- **Not Definitive**: Suggestions require clinical validation
- **Country-Specific**: Protocols limited to Ghana and Zimbabwe
- **Offline Mode**: Limited AI capabilities when offline

---

## Knowledge Base Management

### Accessing the Knowledge Base

1. **Navigate to Knowledge Base** from main menu
2. **Browse by category**:
   - Infectious Diseases
   - Chronic Conditions
   - Pediatric Care
   - Maternal Health
   - Emergency Protocols
3. **Search** by condition, symptom, or drug name

### Knowledge Base Content

- **GHS STG 7th Edition**: Complete Ghana Standard Treatment Guidelines
- **EDLIZ Guidelines**: Zimbabwe Essential Drug List protocols
- **Clinical Protocols**: Step-by-step treatment algorithms
- **Drug Formulary**: Medication information and dosing
- **Reference Materials**: Clinical reference documents

### Searching the Knowledge Base

- **Natural Language Search**: Use everyday medical terminology
- **Symptom Search**: Search by patient symptoms
- **Diagnosis Search**: Look up specific conditions
- **Drug Search**: Find medication information
- **Protocol Search**: Browse treatment protocols

### Knowledge Base Features

- **Offline Access**: All guidelines available offline
- **Regular Updates**: Protocols updated when online
- **Cross-References**: Links between related conditions
- **Printable**: Export protocols for reference
- **Favorites**: Save frequently accessed protocols

---

## Settings and Configuration

### User Settings

1. **Navigate to Settings → Profile**
2. **Update personal information**:
   - Name
   - Department
   - Staff ID
   - Contact information
3. **Change password** (if allowed by policy)
4. **Save changes**

### Clinic Settings (Admin Only)

- **Clinic Information**: Name, code, address
- **Department Configuration**: Add/edit departments
- **Staff Management**: Create and manage user accounts
- **Role Assignments**: Assign appropriate roles to staff
- **Protocol Selection**: Choose country-specific protocols

### Notification Settings

- **Sync Notifications**: Alerts for data synchronization
- **System Updates**: Notifications about new features
- **Security Alerts**: Login attempts and security events
- **Reminder Settings**: Encounter follow-up reminders

### Display Settings

- **Language**: English (default)
- **Theme**: Light/Dark mode
- **Font Size**: Adjust text size for accessibility
- **Date Format**: Choose preferred date display

---

## Offline Mode

### Understanding Offline Mode

AFIA Health Assistant is designed to work without internet connectivity:

- **Local Storage**: All data stored locally on device
- **Offline Capabilities**: 
  - Patient registration and lookup
  - Encounter creation and editing
  - Knowledge base access
  - AI assistance (limited)
- **Automatic Sync**: Data syncs when connection restored

### Working Offline

1. **Continue normal operations** - the system works seamlessly
2. **Offline Indicator**: Shows "Offline Mode" in header
3. **Data Queued**: Changes queued for sync
4. **Limited Features**: Some features require online connection

### Syncing Data

1. **Connect to internet** when available
2. **Automatic sync** begins in background
3. **Sync Progress**: Shows sync status in header
4. **Conflict Resolution**: "Newer wins" for conflicting changes
5. **Confirmation**: Notification when sync complete

### Offline Best Practices

- **Regular Sync**: Connect to internet regularly to sync data
- **Data Backup**: Export data before extended offline periods
- **Conflict Awareness**: Be aware of potential sync conflicts
- **Storage Management**: Monitor local storage usage

---

## Security Features

### Data Protection

- **AES-256 Encryption**: All sensitive patient data encrypted
- **Field-Level Encryption**: Individual fields encrypted separately
- **Secure Transmission**: HTTPS for all data transfers
- **No Data Retention**: Minimal data logging on servers

### Access Control

- **Role-Based Access**: Users see only appropriate data
- **Authentication**: Secure login with password requirements
- **Session Management**: Automatic timeout after inactivity
- **Device Restrictions**: Limited concurrent sessions

### Audit Logging

- **Complete Audit Trail**: All actions logged with timestamp
- **User Attribution**: Each action linked to specific user
- **Immutable Logs**: Audit logs cannot be modified
- **Compliance**: Meets healthcare data protection standards

### Security Best Practices

- **Strong Passwords**: Use complex, unique passwords
- **Device Security**: Lock device when not in use
- **Logout**: Always log out after completing work
- **Report Issues**: Notify admin of security concerns
- **No Sharing**: Never share login credentials

---

## Troubleshooting

### Common Issues

#### Login Problems

**Issue**: Cannot log in
- **Solution**: Check email and password are correct
- **Solution**: Verify account is active (contact admin)
- **Solution**: Check internet connection
- **Solution**: Clear browser cache and cookies

#### Sync Issues

**Issue**: Data not syncing
- **Solution**: Check internet connection
- **Solution**: Wait for automatic sync (may take few minutes)
- **Solution**: Manual sync trigger in Settings
- **Solution**: Check sync status for errors

#### Offline Mode

**Issue**: Stuck in offline mode
- **Solution**: Check internet connection
- **Solution**: Refresh browser page
- **Solution**: Clear browser cache
- **Solution**: Contact admin if issue persists

#### Performance Issues

**Issue**: Application running slowly
- **Solution**: Close other browser tabs
- **Solution**: Clear browser cache
- **Solution**: Check device storage space
- **Solution**: Update browser to latest version

#### AI Assistant Issues

**Issue**: AI not responding
- **Solution**: Check internet connection (AI requires online)
- **Solution**: Verify query is appropriate
- **Solution**: Try rephrasing the question
- **Solution**: Check if service is available

### Error Messages

| Error | Meaning | Action |
|-------|---------|--------|
| "Invalid credentials" | Wrong email/password | Check credentials, contact admin |
| "Account locked" | Too many failed attempts | Contact admin to unlock |
| "Sync failed" | Data sync error | Check connection, retry sync |
| "Session expired" | Logged out due to inactivity | Log in again |
| "Access denied" | Insufficient permissions | Contact admin for access |

### Getting Help

- **In-App Help**: Help button in application
- **Clinic Admin**: Contact your clinic administrator
- **IT Support**: Contact organization IT support
- **Documentation**: Refer to this manual
- **Training**: Request additional training if needed

### Contact Information

- **Technical Support**: [Your organization's support contact]
- **Admin Contact**: [Your clinic admin contact]
- **Emergency Issues**: [Emergency contact procedure]

---

## Appendix

### Glossary

- **SOAP Note**: Subjective, Objective, Assessment, Plan documentation method
- **GHS STG**: Ghana Health Service Standard Treatment Guidelines
- **EDLIZ**: Essential Drugs List for Zimbabwe
- **NHIS**: National Health Insurance Scheme (Ghana)
- **RAG**: Retrieval-Augmented Generation (AI technology)
- **AES-256**: Advanced Encryption Standard 256-bit encryption

### Keyboard Shortcuts

- **Ctrl/Cmd + K**: Quick search
- **Ctrl/Cmd + N**: New patient
- **Ctrl/Cmd + E**: New encounter
- **Ctrl/Cmd + /**: Open help
- **Escape**: Close modal/dialog

### Version History

- **Version 1.0**: Initial release
- **Version 1.1**: Added Zimbabwe support
- **Version 1.2**: Enhanced offline capabilities
- **Version 1.3**: Improved AI accuracy

---

## Additional Resources

- **Training Materials**: [Link to training videos/documents]
- **Protocol Updates**: [Link to latest GHS/EDLIZ updates]
- **System Status**: [Link to system status page]
- **Feedback**: [Link to feedback form]

---

**Document Version**: 1.0  
**Last Updated**: July 2026  
**Maintained By**: AFIA Health Systems

---

*This manual is intended for healthcare professionals using the AFIA Health Assistant system. Always follow your clinical judgment and institutional protocols when making patient care decisions.*
