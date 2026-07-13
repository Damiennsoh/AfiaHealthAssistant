
if (typeof global.DOMMatrix === "undefined") {
  global.DOMMatrix = class DOMMatrix {
    constructor(init) {
      this._init = init || null;
    }
  };
}

const pdfModule = require('pdf-parse');
const PDFParse = pdfModule.PDFParse;

const dummyBuffer = Buffer.from('dummy pdf content'); // This won't work for real parsing but might get past the check
const uint8 = new Uint8Array(dummyBuffer);

try {
  console.log('Instantiating PDFParse with Uint8Array...');
  const parser = new PDFParse(uint8);
  
  parser.load().then(doc => {
     console.log('Document loaded!');
     console.log('Doc keys:', Object.keys(doc));
     console.log('numPages:', doc.numPages);
     // If this works, I know how to proceed.
     // Of course, dummy content will fail to parse as PDF, but I expect "InvalidPDFException" or similar, 
     // which confirms the API flow.
  }).catch(e => {
     console.log('Load failed (expected for dummy content):', e.message);
     if (e.message.includes('InvalidPDFException') || e.message.includes('PDF header not found')) {
       console.log('Confirmed: API flow is correct, just invalid data.');
     }
  });

} catch (e) {
  console.error(e);
}
