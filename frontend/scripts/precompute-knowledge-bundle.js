const fs = require("fs").promises;
const path = require("path");

// HACK: Prevent sharp from being loaded by transformers.js
// This forces it to use the pure JS implementation for image processing (if any)
// and avoids the "DLL load failed" error on Windows when sharp binaries are missing.
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
  if (id === 'sharp') {
    // Throw standard "module not found" error code
    const e = new Error("Cannot find module 'sharp'");
    e.code = 'MODULE_NOT_FOUND';
    throw e;
  }
  return originalRequire.apply(this, arguments);
};

const extractChunksFromPDF = require("./extract-pdf-chunks.js");

async function loadEmbedder() {
  const { pipeline, env } = await import("@xenova/transformers");

  // Force ONNX runtime to use pure JS/WASM backend if possible to avoid sharp/native deps
  // Disable local model checking if it triggers sharp/fs issues, 
  // but usually we want local execution.
  // The key is to avoid sharp dependency in the image processing part of transformers
  // even though we are only doing text feature extraction.
  env.allowLocalModels = false; 
  env.useBrowserCache = true;
  env.backends.onnx.wasm.numThreads = 1; 

  // IMPORTANT: This prevents transformers.js from even trying to load 'sharp'
  // by mocking the image processing requirement which is not needed for text.
  // This is a known workaround for text-only pipelines on environments with broken sharp.
  
  const pipe = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
    quantized: true,
    // Explicitly nullify revision/cache options that might trigger FS checks
    local_files_only: false, 
  });
  return embedder;
}

async function embedChunks(embedder, chunks) {
  const embeddings = [];
  for (let i = 0; i < chunks.length; i++) {
    const text = chunks[i].content;
    const output = await embedder(text, {
      pooling: "mean",
      normalize: true,
    });
    const vector = Array.from(output.data);
    embeddings.push(vector);
  }
  return embeddings;
}

async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch {}
}

async function main() {
  const [stgPdfPath, nhisPdfPath] = process.argv.slice(2);
  if (!stgPdfPath || !nhisPdfPath) {
    console.error(
      "\nUsage: node scripts/precompute-knowledge-bundle.js path/to/GHANA-STG-2017.pdf path/to/NHIS-ML-2025.pdf\n"
    );
    process.exit(1);
  }

  const outputDir = path.join(process.cwd(), "data");
  const publicKnowledgeDir = path.join(
    process.cwd(),
    "public",
    "knowledge"
  );
  await ensureDir(outputDir);
  await ensureDir(publicKnowledgeDir);

  console.log("\n📚 Precomputing knowledge bundle for:");
  console.log("   • GHANA-STG-2017 7th Edition");
  console.log("   • 2025 NHIS ML\n");

  const stgChunks = await extractChunksFromPDF(stgPdfPath);
  const nhisChunks = await extractChunksFromPDF(nhisPdfPath);

  const allChunks = [
    ...stgChunks.map((chunk) => ({
      ...chunk,
      source: "GHANA-STG-2017-7E",
      dateAdded: new Date().toISOString(),
      isAuthority: true,
      type: "protocol",
    })),
    ...nhisChunks.map((chunk) => ({
      ...chunk,
      source: "NHIS-ML-2025",
      dateAdded: new Date().toISOString(),
      isAuthority: true,
      type: "protocol",
    })),
  ];

  console.log(
    `   🔢 Total text chunks: ${allChunks.length} (STG: ${stgChunks.length}, NHIS: ${nhisChunks.length})`
  );

  console.log("\n⚙️  Loading embedding model (Xenova/all-MiniLM-L6-v2)...");
  const embedder = await loadEmbedder();
  console.log("   ✓ Model loaded");

  console.log("   🧠 Generating 384-dim embeddings for all chunks...");
  const vectors = await embedChunks(embedder, allChunks);

  if (vectors.length !== allChunks.length) {
    console.warn(
      `   ⚠ Embedding count mismatch: ${vectors.length} vectors for ${allChunks.length} chunks`
    );
  }

  const enrichedChunks = allChunks.map((chunk, index) => ({
    ...chunk,
    embedding: vectors[index] || [],
  }));

  const bundleName = "ghana-stg-2017-7e__nhis-ml-2025.bundle";
  const prettyPath = path.join(outputDir, `${bundleName}.pretty.json`);
  const minPath = path.join(outputDir, `${bundleName}.min.json`);
  const publicBundlePath = path.join(
    publicKnowledgeDir,
    `${bundleName}.json`
  );

  console.log("\n💾 Writing JSON outputs...");
  await fs.writeFile(
    prettyPath,
    JSON.stringify(enrichedChunks, null, 2),
    "utf-8"
  );
  await fs.writeFile(minPath, JSON.stringify(enrichedChunks), "utf-8");
  await fs.writeFile(publicBundlePath, JSON.stringify(enrichedChunks), "utf-8");

  const dims = vectors[0] ? vectors[0].length : 0;
  const stats = {
    totalChunks: enrichedChunks.length,
    stgChunks: stgChunks.length,
    nhisChunks: nhisChunks.length,
    embeddingDim: dims,
    sources: Array.from(new Set(enrichedChunks.map((c) => c.source))),
  };

  const statsPath = path.join(outputDir, `${bundleName}.stats.json`);
  await fs.writeFile(statsPath, JSON.stringify(stats, null, 2), "utf-8");

  console.log("   ✓ Pretty JSON:", prettyPath);
  console.log("   ✓ Minified JSON:", minPath);
  console.log("   ✓ Public bundle:", publicBundlePath);
  console.log("   ✓ Stats:", statsPath);
  console.log("\n✅ Precomputation complete.\n");
}

if (require.main === module) {
  main().catch((err) => {
    console.error("❌ Precomputation failed:", err);
    process.exit(1);
  });
}

