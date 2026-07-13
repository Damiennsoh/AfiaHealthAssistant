
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '..', 'frontend', 'public', 'data');

console.log('Loading files...');

// Read all input files FIRST before writing anything
const ghsChunks = JSON.parse(fs.readFileSync(path.join(dataDir, 'ghs-stg-embeddings.json'), 'utf8'));
const nhisChunks = JSON.parse(fs.readFileSync(path.join(dataDir, 'nhis-embeddings.json'), 'utf8'));
const zwChunks = JSON.parse(fs.readFileSync(path.join(dataDir, 'complete-knowledge-base.json'), 'utf8'));

console.log(`Loaded ${ghsChunks.length} GHS-STG chunks`);
console.log(`Loaded ${nhisChunks.length} NHIS chunks`);
console.log(`Loaded ${zwChunks.length} Zimbabwe (EDLIZ) chunks`);

const combined = [];

// Process GHS-STG chunks
ghsChunks.forEach((chunk, index) => {
  combined.push({
    id: `ghana-stg-${index}`,
    content: chunk.content,
    source: 'GHANA-STG-2017',
    sourceShortName: 'GHS STG 2017',
    documentType: 'guideline',
    authority: 'ghs',
    countryCode: 'GH',
    color: '#2e7d32',
    dateAdded: new Date().toISOString(),
    dateEmbedded: new Date().toISOString(),
    embedding: chunk.embedding,
    metadata: {
      ...chunk.metadata,
      year: 2017
    }
  });
});

// Process NHIS chunks
nhisChunks.forEach((chunk, index) => {
  combined.push({
    id: `ghana-nhis-${index}`,
    content: chunk.content,
    source: 'NHIS-ML-2025',
    sourceShortName: 'NHIS ML 2025',
    documentType: 'formulary',
    authority: 'nhis',
    countryCode: 'GH',
    color: '#1565c0',
    dateAdded: new Date().toISOString(),
    dateEmbedded: new Date().toISOString(),
    embedding: chunk.embedding,
    metadata: {
      ...chunk.metadata,
      year: 2025
    }
  });
});

// Process Zimbabwe chunks
zwChunks.forEach((chunk, index) => {
  combined.push({
    id: `zimbabwe-edliz-${index}`,
    content: chunk.content,
    source: 'EDLIZ-2020',
    sourceShortName: 'EDLIZ 2020',
    documentType: 'guideline',
    authority: 'mohcc',
    countryCode: 'ZW',
    color: '#d32f2f',
    dateAdded: new Date().toISOString(),
    dateEmbedded: new Date().toISOString(),
    embedding: chunk.embedding,
    metadata: {
      ...chunk.metadata,
      year: 2020
    }
  });
});

console.log(`Combined ${combined.length} chunks total!`);

// Update knowledge-stats.json
const stats = {
  total: combined.length,
  withEmbeddings: combined.length,
  byCountry: {
    'GH': combined.filter(c => c.countryCode === 'GH').length,
    'ZW': combined.filter(c => c.countryCode === 'ZW').length
  },
  bySource: {
    'GHANA-STG-2017': combined.filter(c => c.source === 'GHANA-STG-2017').length,
    'NHIS-ML-2025': combined.filter(c => c.source === 'NHIS-ML-2025').length,
    'EDLIZ-2020': combined.filter(c => c.source === 'EDLIZ-2020').length
  },
  generatedAt: new Date().toISOString()
};

// NOW write the complete file (after reading all inputs)
fs.writeFileSync(path.join(dataDir, 'complete-knowledge-base.json'), JSON.stringify(combined, null, 2));
fs.writeFileSync(path.join(dataDir, 'knowledge-stats.json'), JSON.stringify(stats, null, 2));

console.log('✅ Complete knowledge base updated!');
console.log('✅ Knowledge stats updated!');
console.log('\nSummary:');
console.log('🇬🇭 Ghana (GHS STG):', stats.bySource['GHANA-STG-2017'], 'chunks');
console.log('🇬🇭 Ghana (NHIS):', stats.bySource['NHIS-ML-2025'], 'chunks');
console.log('🇿🇼 Zimbabwe (EDLIZ):', stats.bySource['EDLIZ-2020'], 'chunks');
console.log('Total:', stats.total, 'chunks');
