// scripts/clean-chunks.js
const fs = require('fs').promises;
const path = require('path');

/**
 * Cleans extracted text chunks by removing noise, filtering short entries,
 * and stripping common page headers/footers.
 * Usage: node scripts/clean-chunks.js ./data/input-chunks.json [output-chunks.json]
 */

// Common patterns to remove (add your own)
const removePatterns = [
  // Page numbers
  /^\s*\d+\s*$/gm,
  /^\s*Page\s*\d+\s*$/gim,
  /^\s*–\s*\d+\s*–\s*$/gm,
  /^\s*\[Page\s*\d+\]\s*$/gim,

  // Headers/Footers (customize for your document)
  /EDLIZ\s+2020/gi,
  /EDLIZ\s+8TH\s+EDITION/gi,
  /Ministry of Health\s+(and Child Care)?/gi,
  /Republic of Zimbabwe/gi,
  /National Medicine\s+Therapeutics Policy Advisory Committee/gi,
  /NMTPAC/gi,
  /DIRECTORATE OF PHARMACY SERVICES/gi,
  /P.O\. Box\s+[A-Z0-9]+/gi,

  // Table of contents markers
  /^\.\.\.+\s*$/gm,
  /^\s*[0-9]+\.\s*[A-Z][A-Z\s]+\.*$/gm, // e.g., "1. INTRODUCTION"
  /^\s*[0-9]+\s+[A-Z][A-Z\s]+\.*$/gm,

  // Legal boilerplate
  /All rights reserved\.?/gi,
  /Copyright\s+©\s+20\d{2}/gi,

  // Empty lines or only whitespace
  /^\s*$/gm,
];

// Minimum content length to keep a chunk
const MIN_CONTENT_LENGTH = 80;

// Function to clean a single text string
function cleanText(text) {
  let cleaned = text;

  // Apply all removal patterns (replace with empty)
  for (const pattern of removePatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Remove extra whitespace and normalize newlines
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

// Determine if a chunk is noise (should be dropped)
function isNoiseChunk(chunk) {
  const content = chunk.content || '';
  const cleaned = cleanText(content);

  // If after cleaning, the length is too short, drop it
  if (cleaned.length < MIN_CONTENT_LENGTH) return true;

  // If the original content is mostly numbers/symbols, drop it
  const alphaNumeric = content.replace(/[^a-zA-Z0-9]/g, '').length;
  const total = content.length;
  if (total > 0 && alphaNumeric / total < 0.3) return true; // <30% alphanumeric

  // If it contains only common stopwords (optional)
  // (skip for simplicity)

  return false;
}

async function main() {
  const inputFile = process.argv[2];
  if (!inputFile) {
    console.error('\n❌ Please provide input chunks JSON file.');
    console.log('\nUsage: node scripts/clean-chunks.js ./data/your-chunks.json [output.json]\n');
    process.exit(1);
  }

  const outputFile = process.argv[3] || inputFile.replace('.json', '-cleaned.json');

  console.log(`📂 Reading chunks from: ${inputFile}`);
  const raw = await fs.readFile(inputFile, 'utf-8');
  const chunks = JSON.parse(raw);
  console.log(`   Original chunks: ${chunks.length}`);

  // Clean each chunk
  const cleanedChunks = chunks
    .map(chunk => ({
      ...chunk,
      content: cleanText(chunk.content)
    }))
    .filter(chunk => !isNoiseChunk(chunk));

  console.log(`   Kept chunks: ${cleanedChunks.length}`);
  console.log(`   Removed: ${chunks.length - cleanedChunks.length}`);

  // Write cleaned file
  await fs.writeFile(outputFile, JSON.stringify(cleanedChunks, null, 2));
  console.log(`💾 Saved cleaned chunks to: ${outputFile}`);
}

main().catch(err => {
  console.error('❌ Cleaning failed:', err.message);
  process.exit(1);
});
