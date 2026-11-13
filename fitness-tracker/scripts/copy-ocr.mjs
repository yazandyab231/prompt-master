// Copies the on-device OCR engine (Tesseract) out of node_modules into public/ocr
// so label scanning never has to download anything from a third-party CDN.
import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'ocr');
mkdirSync(out, { recursive: true });

const files = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js'],
  ['node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'eng.traineddata.gz'],
];

for (const [from, to] of files) {
  const src = join(root, from);
  if (!existsSync(src)) {
    console.error(`copy-ocr: missing ${from} (run npm install)`);
    process.exit(1);
  }
  cpSync(src, join(out, to));
}
console.log(`copy-ocr: ${files.length} files -> public/ocr`);
