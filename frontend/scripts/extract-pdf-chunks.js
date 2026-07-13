// scripts/extract-pdf-chunks.js
if (typeof global.DOMMatrix === "undefined") {
  global.DOMMatrix = class DOMMatrix {
    constructor(init) {
      this._init = init || null;
    }
  };
}
const fs = require('fs').promises;
const path = require('path');
const pdfModule = require('pdf-parse');
// The installed pdf-parse version exports a class named PDFParse
const PDFParse = pdfModule.PDFParse || pdfModule.default?.PDFParse || pdfModule;

/**
 * Extracts text chunks from a PDF file
 * Usage: node scripts/extract-pdf-chunks.js ./data/GHANA-STG-2017-1.pdf
 */

async function extractChunksFromPDF(pdfPath) {
  console.log('\n📄 Processing PDF:', path.basename(pdfPath));
  
  try {
    // Read PDF file
    const dataBuffer = await fs.readFile(pdfPath);
    console.log('   ✓ PDF loaded');
    
    // Parse PDF using the installed PDFParse class
    const uint8Array = new Uint8Array(dataBuffer);
    
    let data;
    
    // Try to use PDFParse class if available
    if (typeof PDFParse === 'function' && PDFParse.prototype && PDFParse.prototype.load) {
       const parser = new PDFParse(uint8Array);
       const doc = await parser.load();
       
       let fullText = "";
       for (let i = 1; i <= doc.numPages; i++) {
         const page = await doc.getPage(i);
         const content = await page.getTextContent();
         // items is array of {str: "...", ...}
         const strings = content.items.map(item => item.str);
         // Join with space, but preserve some structure if possible?
         // Actually PDF text extraction is messy. Let's just join with space
         // and double newline for page breaks if we processed pages individually, 
         // but here we are inside a loop.
         fullText += strings.join(" ") + "\n\n";
       }
       
       data = {
         text: fullText,
         numpages: doc.numPages
       };
    } else if (typeof PDFParse === 'function') {
       // Fallback for standard pdf-parse (v1.1.1 style) just in case
       data = await PDFParse(dataBuffer);
    } else {
       throw new Error('Could not identify PDF parser function or class');
    }

    console.log('   ✓ PDF parsed');
    console.log(`   📊 Pages: ${data.numpages}`);
    console.log(`   📝 Text length: ${data.text.length} characters`);
    
    // --- IMPROVED CHUNKING STRATEGY ---
    // Instead of simple paragraph splitting, use a recursive strategy 
    // to ensure chunks are of optimal size for embeddings (approx 512 tokens / ~1000 chars).
    
    const CHUNK_SIZE = 1000;
    const CHUNK_OVERLAP = 200;
    
    // Helper function to split text recursively
    function recursiveSplit(text, separators = ['\n\n', '\n', '. ', ' ', '']) {
      const finalChunks = [];
      let goodSplits = [];
      
      // Find the best separator that works
      let separator = separators[separators.length - 1];
      let newSeparators = [];
      
      for (let i = 0; i < separators.length; i++) {
        const s = separators[i];
        if (text.includes(s)) {
          separator = s;
          newSeparators = separators.slice(i + 1);
          break;
        }
      }
      
      // Split using the separator
      const splits = separator ? text.split(separator) : [text];
      
      // Merge splits into chunks
      let currentChunk = [];
      let currentLen = 0;
      
      for (const s of splits) {
        const sLen = s.length;
        if (currentLen + sLen + (currentChunk.length > 0 ? separator.length : 0) > CHUNK_SIZE) {
          if (currentChunk.length > 0) {
            const chunkText = currentChunk.join(separator);
            finalChunks.push(chunkText);
            
            // Handle overlap (keep last few items)
            // This is a simplified overlap, mostly just resetting
            // Ideally we keep enough items to meet overlap length
            while (currentLen > CHUNK_OVERLAP && currentChunk.length > 0) {
               const removed = currentChunk.shift();
               currentLen -= (removed.length + separator.length);
            }
          }
          
          // If the single item is still too big, recurse on it
          if (sLen > CHUNK_SIZE && newSeparators.length > 0) {
            const subChunks = recursiveSplit(s, newSeparators);
            finalChunks.push(...subChunks);
            // Don't add to currentChunk as it's already handled
            currentChunk = [];
            currentLen = 0;
            continue;
          }
        }
        
        currentChunk.push(s);
        currentLen += sLen + (currentChunk.length > 1 ? separator.length : 0);
      }
      
      if (currentChunk.length > 0) {
        finalChunks.push(currentChunk.join(separator));
      }
      
      return finalChunks;
    }

    // Perform the split
    let paragraphs = recursiveSplit(data.text);
    
    // Filter out noise
    paragraphs = paragraphs
      .map(p => p.trim())
      .filter(p => p.length > 50); // Keep meaningful chunks

    console.log(`   🔪 Split into ${paragraphs.length} chunks (recursive strategy)`);
    
    // Create structured chunks
    const chunks = paragraphs.map((content, index) => ({
      id: `chunk-${Date.now()}-${index}`,
      content: content,
      metadata: {
        keywords: extractKeywords(content)
      }
    }));
    
    // Save raw chunks for debug/inspection
    const outputFilename = path.basename(pdfPath, '.pdf') + '-chunks.json';
    const outputPath = path.join(__dirname, '../data', outputFilename);
    
    await fs.writeFile(outputPath, JSON.stringify(chunks, null, 2));
    console.log(`   💾 Saved to: data\\${outputFilename}`);
    
    console.log(`   ✅ Extracted ${chunks.length} chunks`);
    return chunks;

  } catch (error) {
    console.error(`   ❌ Error processing PDF: ${error.message}`);
    return [];
  }
}

// Simple keyword extraction
function extractKeywords(text) {
  const commonTerms = [
    'malaria', 'hypertension', 'diabetes', 'fever', 'cough',
    'pneumonia', 'diarrhea', 'tuberculosis', 'hiv', 'aids',
    'pregnancy', 'child', 'infant', 'adult', 'dose',
    'treatment', 'diagnosis', 'prevention', 'management'
  ];
  
  const found = commonTerms.filter(term => 
    text.toLowerCase().includes(term)
  );
  
  return found.slice(0, 5); // Return top 5 keywords
}

// Run if called directly
if (require.main === module) {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.error('\n❌ Please provide PDF path');
    console.log('\nUsage: node scripts/extract-pdf-chunks.js path/to/your.pdf\n');
    process.exit(1);
  }
  
  extractChunksFromPDF(pdfPath).catch(console.error);
}

module.exports = extractChunksFromPDF;
