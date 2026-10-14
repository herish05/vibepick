// Smoke test: real HTTP ML client against the running ML service.
import { deflateSync } from 'node:zlib';
import { HttpMlClient } from '../src/lib/ml.js';

function crc32(buf: Buffer): number {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
const w = 16;
const raw = Buffer.concat(Array.from({ length: w }, () => Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => [230, 140, 60]).flat())])));
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(w, 0);
ihdr.writeUInt32BE(w, 4);
ihdr[8] = 8;
ihdr[9] = 2;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);

const res = await new HttpMlClient(process.env.ML_SERVICE_URL ?? 'http://localhost:8000', 5000).analyzeImage(png, 'image/png');
console.log(res.provider, res.confidence, Object.entries(res.vibe).sort((a, b) => b[1] - a[1]).slice(0, 3));
