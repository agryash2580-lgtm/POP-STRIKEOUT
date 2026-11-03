import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { mkdir, writeFile } from 'node:fs/promises';
const url = 'https://strikeout-mu20.vercel.app/devfest.html';
const code = QRCode.create(url, { errorCorrectionLevel: 'M' });
const scale = 6, margin = 4, size = (code.modules.size + margin * 2) * scale;
const rgba = new Uint8ClampedArray(size * size * 4).fill(255);
for (let y = 0; y < code.modules.size; y++) for (let x = 0; x < code.modules.size; x++) {
  if (!code.modules.get(y, x)) continue;
  for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
    const offset = (((y + margin) * scale + dy) * size + (x + margin) * scale + dx) * 4;
    rgba[offset] = rgba[offset + 1] = rgba[offset + 2] = 0;
  }
}
if (jsQR(rgba, size, size)?.data !== url) throw Error('QR decoding verification failed.');
await mkdir('output/devfest', { recursive: true });
await QRCode.toFile('output/devfest/strikeout-demo-qr.png', url, { margin, scale, errorCorrectionLevel: 'M' });
await writeFile('output/devfest/QR-TARGET.txt', url + '\nVerify the deployed page on a separate phone before printing this QR. Generation is not deployment.\n');
console.log('QR generated and matrix independently decoded. Verify public deployment before printing.');
