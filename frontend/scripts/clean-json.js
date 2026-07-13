const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../public/data/complete-knowledge-base.json');

try {
  const rawData = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(rawData);

  let fixedCount = 0;
  
  const cleanText = (text) => {
    if (!text) return text;
    // Remove replacement character �
    let cleaned = text.replace(/\uFFFD/g, '');
    // Remove other common non-printable control characters (except newlines/tabs)
    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
    // Fix multiple spaces
    cleaned = cleaned.replace(/\s+/g, ' ');
    return cleaned.trim();
  };

  const cleanedData = data.map(chunk => {
    const originalContent = chunk.content;
    const newContent = cleanText(originalContent);
    
    if (originalContent !== newContent) {
      fixedCount++;
      return { ...chunk, content: newContent };
    }
    return chunk;
  });

  fs.writeFileSync(filePath, JSON.stringify(cleanedData, null, 2));
  console.log(`Successfully cleaned ${fixedCount} chunks in ${filePath}`);

} catch (error) {
  console.error('Error processing file:', error);
}
