# Backup Implementation Documentation

## Overview

The Afia Health Assistant implements a comprehensive backup system designed for rural healthcare environments with unreliable internet connectivity. The system provides both full database backups and selective CSV exports for reporting purposes.

## Architecture

### Database Structure

The application uses IndexedDB with the following configuration:

```typescript
// Main Application Database
const DB_NAME = "afia-health-db";
const DB_VERSION = 4;

// Object Stores
- patients: Patient demographic and registration data
- encounters: Clinical visit records with vitals, symptoms, diagnosis
- aiRequests: AI consultation history and responses
- uploads: Image and file upload metadata
- metadata: Application configuration and settings
- users: Staff authentication and profile data
```

### Backup File Format

#### .afia Format (JSON-based)

The `.afia` file is a compressed JSON archive containing:

```typescript
interface BackupData {
  version: string;
  timestamp: string;
  facility: {
    name: string;
    region: string;
    district: string;
  };
  data: {
    patients: Patient[];
    encounters: Encounter[];
    aiRequests: AIRequest[];
    uploads: UploadMetadata[];
    metadata: ApplicationMetadata[];
  };
  statistics: {
    totalPatients: number;
    totalEncounters: number;
    dataSize: string;
    exportDate: string;
  };
}
```

#### CSV Export Format

Separate CSV files for different data types:

- **patients.csv**: Demographics, NHIS information, registration dates
- **encounters.csv**: Visit records, diagnoses, treatments, vitals
- **drugs.csv**: Medication prescriptions and administration records
- **lab-results.csv**: Laboratory test results and interpretations

## Implementation Details

### Backup Process Flow

1. **Data Collection**
   ```typescript
   // Collect data from all IndexedDB stores
   const patients = await getAllPatients();
   const encounters = await getAllEncounters();
   const aiRequests = await getAllAIRequests();
   ```

2. **Data Validation**
   - Verify data integrity
   - Check for missing required fields
   - Validate NHIS number formats
   - Ensure encounter-patient relationships

3. **File Generation**
   ```typescript
   // Create backup object
   const backupData = {
     version: BACKUP_VERSION,
     timestamp: new Date().toISOString(),
     facility: facilityInfo,
     data: { patients, encounters, aiRequests, uploads, metadata },
     statistics: generateStatistics(data)
   };
   ```

4. **File Compression**
   - Apply gzip compression for large datasets
   - Generate checksum for integrity verification
   - Create download blob with proper MIME type

### Import/Restore Process

1. **File Validation**
   ```typescript
   // Verify file format and integrity
   const isValidBackup = await validateBackupFile(file);
   if (!isValidBackup) throw new Error("Invalid backup file");
   ```

2. **Data Migration**
   - Clear existing data (optional)
   - Import patients first (maintain referential integrity)
   - Import encounters with patient ID mapping
   - Restore AI requests and uploads
   - Update metadata and statistics

3. **Conflict Resolution**
   - Handle duplicate patient records
   - Merge encounter histories
   - Preserve original timestamps
   - Log all import operations

### CSV Export Implementation

```typescript
// Patient CSV Export
const exportPatientsToCSV = async () => {
  const patients = await getAllPatients();
  const headers = [
    'ID', 'Name', 'NHIS Number', 'Age', 'Sex', 
    'Phone', 'Region', 'Community', 'Registration Date'
  ];
  
  const csvData = patients.map(patient => [
    patient.id,
    patient.name,
    patient.nhisNumber,
    patient.age,
    patient.sex,
    patient.phone,
    patient.locality?.region || '',
    patient.locality?.community || '',
    patient.createdAt
  ]);
  
  return generateCSV(headers, csvData);
};
```

## Security Considerations

### Data Protection

1. **Encryption at Rest**
   - Sensitive data encrypted in IndexedDB
   - Backup files can be password-protected
   - Secure key management for encryption

2. **Access Control**
   - Staff authentication required for backup operations
   - Role-based permissions for data export
   - Audit trail for all backup/restore activities

3. **Data Sanitization**
   - PII redaction in AI request exports
   - Remove temporary upload data
   - Exclude sensitive system configuration

### Privacy Compliance

- **NHIS Data Protection**: Compliant with Ghana Health Service standards
- **Data Residency**: All data stored locally within Ghana
- **Audit Logging**: Complete audit trail for regulatory compliance
- **Retention Policies**: Configurable data retention periods

## Performance Optimization

### Large Dataset Handling

1. **Streaming Processing**
   ```typescript
   // Process data in chunks to avoid memory issues
   const processInChunks = async (data, chunkSize = 1000) => {
     for (let i = 0; i < data.length; i += chunkSize) {
       const chunk = data.slice(i, i + chunkSize);
       await processChunk(chunk);
     }
   };
   ```

2. **Background Processing**
   - Use Web Workers for large file operations
   - Progress indicators for long-running operations
   - Cancelable operations for user control

3. **Memory Management**
   - Clear temporary data after processing
   - Optimize JSON serialization
   - Use streaming for very large exports

## Error Handling

### Common Scenarios

1. **Storage Limitations**
   - Detect available storage space
   - Split large backups into multiple files
   - Provide clear error messages

2. **Data Corruption**
   - Validate data integrity before export
   - Provide repair tools for corrupted backups
   - Automatic backup verification

3. **Network Issues**
   - Retry logic with exponential backoff
   - Offline queue for backup operations
   - Resume interrupted downloads

## Usage Examples

### Creating a Full Backup

```typescript
const createBackup = async () => {
  try {
    const backupData = await collectAllData();
    const compressedBackup = await compressData(backupData);
    const blob = new Blob([compressedBackup], { 
      type: 'application/x-afia-backup' 
    });
    
    // Trigger download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `afia-backup-${new Date().toISOString().split('T')[0]}.afia`;
    a.click();
    
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Backup failed:', error);
    throw error;
  }
};
```

### Restoring from Backup

```typescript
const restoreFromBackup = async (file) => {
  try {
    const backupData = await parseBackupFile(file);
    await validateBackupData(backupData);
    
    // Clear existing data if requested
    if (shouldClearExisting) {
      await clearAllData();
    }
    
    // Import data in correct order
    await importPatients(backupData.data.patients);
    await importEncounters(backupData.data.encounters);
    await importAIRequests(backupData.data.aiRequests);
    
    // Update application state
    await refreshApplicationData();
    
    return {
      patientsImported: backupData.data.patients.length,
      encountersImported: backupData.data.encounters.length,
      success: true
    };
  } catch (error) {
    console.error('Restore failed:', error);
    throw error;
  }
};
```

## Best Practices

### For Healthcare Facilities

1. **Regular Backup Schedule**
   - Daily automated backups
   - Weekly full system backups
   - Monthly off-site backup storage

2. **Backup Verification**
   - Test restore procedures regularly
   - Verify backup integrity
   - Document recovery procedures

3. **Data Governance**
   - Assign backup responsibilities
   - Maintain backup logs
   - Review backup policies quarterly

### For Developers

1. **Modular Design**
   - Separate backup logic from UI components
   - Use dependency injection for testability
   - Implement proper error boundaries

2. **Testing Strategy**
   - Unit tests for data transformation
   - Integration tests for backup/restore flows
   - Performance tests for large datasets

3. **Documentation**
   - Maintain API documentation
   - Document data format changes
   - Provide migration guides

## Future Enhancements

### Planned Features

1. **Cloud Backup Integration**
   - Automatic cloud synchronization
   - Encrypted cloud storage
   - Multi-facility backup aggregation

2. **Incremental Backups**
   - Track data changes
   - Delta backup generation
   - Efficient storage utilization

3. **Advanced Analytics**
   - Backup usage statistics
   - Data growth trends
   - Performance metrics

### Technology Roadmap

- **WebAssembly**: Faster data processing for large datasets
- **Service Workers**: Background synchronization
- **IndexedDB 2.0**: Improved performance and features
- **Compression Algorithms**: Better compression ratios

## Troubleshooting

### Common Issues

1. **Backup File Won't Open**
   - Verify file extension (.afia)
   - Check file size (should not be 0 bytes)
   - Ensure file wasn't corrupted during download

2. **Import Fails Mid-Process**
   - Check available disk space
   - Verify backup file integrity
   - Review error logs for specific issues

3. **Performance Issues**
   - Close unnecessary browser tabs
   - Restart browser application
   - Consider browser memory limits

### Support Resources

- **Documentation**: Complete API reference and guides
- **Community**: Developer forums and discussion boards
- **Support**: Technical support contact information
- **Training**: Backup and recovery procedures training

---

*This documentation is maintained alongside the Afia Health Assistant codebase. For the most up-to-date information, please refer to the latest version in the repository.*
