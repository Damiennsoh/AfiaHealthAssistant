// scripts/precompute-embeddings-only.js
const fs = require('fs').promises;
  const path = require('path');
  
  // Mock sharp to prevent errors if transformers tries to load it
  try {
    const sharpPath = require.resolve('sharp');
    console.log(`Mocking sharp at ${sharpPath}`);
    require.cache[sharpPath] = {
      id: sharpPath,
      filename: sharpPath,
      loaded: true,
      exports: {},
    };
  } catch (e) {
    console.log('Could not resolve sharp to mock it: ' + e.message);
  }

  // Also manually poison the 0.32.6 version found in stack trace
  const sharp32Path = path.join(process.cwd(), 'node_modules', '.pnpm', 'sharp@0.32.6', 'node_modules', 'sharp', 'lib', 'index.js');
  console.log(`Poisoning sharp@0.32.6 at ${sharp32Path}`);
  require.cache[sharp32Path] = {
    id: sharp32Path,
    filename: sharp32Path,
    loaded: true,
    exports: {},
  };

   const Module = require('module');
   const originalRequire = Module.prototype.require;
   Module.prototype.require = function(id) {
     if (id === 'sharp' || id.includes('sharp')) {
       console.log(`Blocking require for sharp-related module: ${id}`);
       return {}; // Return empty object
     }
     return originalRequire.apply(this, arguments);
   };

/**
 * This script SKIPS PDF parsing and just generates embeddings 
 * from existing chunk files.
 * 
 * Usage: node scripts/precompute-embeddings-only.js ./data/GHANA-STG-2017-chunks.json ./data/NHIS-ML-2025-chunks.json
 */

async function generateEmbeddingsFromChunks() {
  const { pipeline, env } = await import('@xenova/transformers');

  // Configure environment to avoid sharp dependency issues
   env.allowLocalModels = false;
   // env.useBrowserCache = true; // Not available in Node.js
   
   console.log('\n🧠 Generating embeddings from existing chunk files...\n');
  
  // Get chunk files from command line
  const chunkFiles = process.argv.slice(2);
  
  if (chunkFiles.length === 0) {
    console.error('❌ Please provide chunk JSON files');
    console.log('\nUsage: node scripts/precompute-embeddings-only.js ./data/*-chunks.json\n');
    process.exit(1);
  }
  
  try {
    // Load all chunks
    let allChunks = [];
    for (const chunkFile of chunkFiles) {
      console.log(`📚 Loading chunks from: ${path.basename(chunkFile)}`);
      const chunksJson = await fs.readFile(chunkFile, 'utf-8');
      const chunks = JSON.parse(chunksJson);
      
      // Infer source from filename
      let source = 'unknown';
      if (chunkFile.includes('STG')) source = 'GHANA-STG-2017';
      else if (chunkFile.includes('NHIS')) source = 'NHIS-ML-2025';
      
      // Add source to each chunk
      const chunksWithSource = chunks.map(c => ({
        ...c,
        source: c.source || source
      }));

      console.log(`   ✓ Loaded ${chunks.length} chunks (Source: ${source})`);
      allChunks = allChunks.concat(chunksWithSource);
    }
    
    console.log(`\n🔢 Total chunks to embed: ${allChunks.length}\n`);
    
    // Initialize the model
    console.log('🤖 Loading embedding model...');
    console.log('   This may take 30-60 seconds on first run...\n');
    
    const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      quantized: true
    });
    
    console.log('   ✓ Model loaded!\n');
    
    // Generate embeddings in batches
    const batchSize = 20;
    const embeddedChunks = [];
    
    for (let i = 0; i < allChunks.length; i += batchSize) {
      const batch = allChunks.slice(i, i + batchSize);
      const progress = ((i / allChunks.length) * 100).toFixed(1);
      console.log(`   Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(allChunks.length/batchSize)} (${progress}%)`);
      
      const batchResults = await Promise.all(
        batch.map(async (chunk, idx) => {
          try {
            const output = await extractor(chunk.content, {
              pooling: 'mean',
              normalize: true
            });
            
            return {
              ...chunk,
              embedding: Array.from(output.data),
              embeddingDimension: output.data.length
            };
          } catch (err) {
            console.error(`   ❌ Failed chunk ${i + idx}:`, err.message);
            return {
              ...chunk,
              embedding: []
            };
          }
        })
      );
      
      embeddedChunks.push(...batchResults);
    }
    
    // Count successes
    const successful = embeddedChunks.filter(c => c.embedding.length > 0).length;
    console.log(`\n✅ Successfully embedded ${successful}/${embeddedChunks.length} chunks`);
    
    // Save combined knowledge base
    const outputFile = './public/data/complete-knowledge-base.json';
    await fs.writeFile(outputFile, JSON.stringify(embeddedChunks));
    console.log(`\n💾 Saved to: ${outputFile}`);
    
    // Also save individual files
    const stgChunks = embeddedChunks.filter(c => c.source.includes('STG'));
    const nhisChunks = embeddedChunks.filter(c => c.source.includes('NHIS'));
    
    if (stgChunks.length > 0) {
      await fs.writeFile('./public/data/ghs-stg-embeddings.json', JSON.stringify(stgChunks));
      console.log(`   Saved ${stgChunks.length} GHS chunks separately`);
    }
    
    if (nhisChunks.length > 0) {
      await fs.writeFile('./public/data/nhis-embeddings.json', JSON.stringify(nhisChunks));
      console.log(`   Saved ${nhisChunks.length} NHIS chunks separately`);
    }
    
    // Create stats
    const stats = {
      total: embeddedChunks.length,
      withEmbeddings: successful,
      bySource: {},
      generatedAt: new Date().toISOString()
    };
    
    embeddedChunks.forEach(chunk => {
      stats.bySource[chunk.source] = (stats.bySource[chunk.source] || 0) + 1;
    });
    
    await fs.writeFile('./public/data/knowledge-stats.json', JSON.stringify(stats, null, 2));
    console.log(`\n📊 Stats saved to: ./public/data/knowledge-stats.json`);
    
  } catch (error) {
    console.error('\n❌ Embedding generation failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  console.log('Script is running directly, calling generateEmbeddingsFromChunks...');
  generateEmbeddingsFromChunks()
    .then(() => console.log('Script completed successfully.'))
    .catch((err) => {
      console.error('Script failed:', err);
      process.exit(1);
    });
} else {
  console.log('Script is being imported, not running directly.');
}

module.exports = generateEmbeddingsFromChunks;