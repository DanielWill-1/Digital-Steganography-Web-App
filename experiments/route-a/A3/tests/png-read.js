/**
 * Minimal dependency-free PNG reader for the A3 robustness step.
 *
 * The Python transform stage writes transformed PNGs (small, compressed) and the Node step
 * must run jsQR on the *same pixels* OpenCV decodes. This decodes the PNGs OpenCV produces
 * (8-bit, non-interlaced, colour types 0/2/4/6) to RGBA. Uses only Node's built-in zlib.
 */

import zlib from 'node:zlib';

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/**
 * Decode an 8-bit non-interlaced PNG buffer to { width, height, rgba: Uint8ClampedArray }.
 */
export function decodePng(buffer) {
  for (let i = 0; i < 8; i++) {
    if (buffer[i] !== SIGNATURE[i]) throw new Error('Not a PNG file');
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 8;
  let colorType = 2;
  let interlace = 0;
  const idat = [];
  let palette = null;

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'PLTE') {
      palette = Buffer.from(data);
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(data));
    } else if (type === 'IEND') {
      break;
    }
    offset += 8 + length + 4;
  }

  if (bitDepth !== 8) throw new Error(`Unsupported PNG bit depth ${bitDepth}`);
  if (interlace !== 0) throw new Error('Interlaced PNG not supported');

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const channelsByType = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
  const channels = channelsByType[colorType];
  if (!channels) throw new Error(`Unsupported PNG colour type ${colorType}`);

  const stride = width * channels;
  const out = new Uint8ClampedArray(width * height * 4);
  const previous = new Uint8Array(stride);
  const current = new Uint8Array(stride);
  let pos = 0;

  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    for (let i = 0; i < stride; i++) {
      const x = raw[pos++];
      const a = i >= channels ? current[i - channels] : 0;
      const b = previous[i];
      const c = i >= channels ? previous[i - channels] : 0;
      let value;
      switch (filter) {
        case 0: value = x; break;
        case 1: value = x + a; break;
        case 2: value = x + b; break;
        case 3: value = x + ((a + b) >> 1); break;
        case 4: value = x + paeth(a, b, c); break;
        default: throw new Error(`Unknown PNG filter ${filter}`);
      }
      current[i] = value & 0xff;
    }
    for (let x = 0; x < width; x++) {
      const base = x * channels;
      const outIndex = (y * width + x) * 4;
      if (colorType === 2) {
        out[outIndex] = current[base];
        out[outIndex + 1] = current[base + 1];
        out[outIndex + 2] = current[base + 2];
        out[outIndex + 3] = 255;
      } else if (colorType === 6) {
        out[outIndex] = current[base];
        out[outIndex + 1] = current[base + 1];
        out[outIndex + 2] = current[base + 2];
        out[outIndex + 3] = current[base + 3];
      } else if (colorType === 0) {
        out[outIndex] = out[outIndex + 1] = out[outIndex + 2] = current[base];
        out[outIndex + 3] = 255;
      } else if (colorType === 4) {
        out[outIndex] = out[outIndex + 1] = out[outIndex + 2] = current[base];
        out[outIndex + 3] = current[base + 1];
      } else if (colorType === 3) {
        const p = current[base] * 3;
        out[outIndex] = palette[p];
        out[outIndex + 1] = palette[p + 1];
        out[outIndex + 2] = palette[p + 2];
        out[outIndex + 3] = 255;
      }
    }
    previous.set(current);
  }

  return { width, height, rgba: out };
}
