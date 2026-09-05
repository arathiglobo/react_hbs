/*
 * Strip the opaque white plate out of an 8-bit RGBA, non-interlaced PNG.
 *
 * The wordmark was exported as "ink over white", so every pixel satisfies
 *   observed = a * source + (1 - a) * 255
 * Taking a = 255 - min(r, g, b) and un-multiplying recovers the source colour
 * exactly, which means the result re-composites over white pixel-identical to
 * the original while becoming transparent everywhere else.
 */
const fs = require("fs");
const zlib = require("zlib");

const [, , SRC, DST] = process.argv;

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

const src = fs.readFileSync(SRC);
const width = src.readUInt32BE(16);
const height = src.readUInt32BE(20);
const bitDepth = src[24];
const colorType = src[25];
const interlace = src[28];
if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
  throw new Error(
    `unsupported PNG: bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace}`,
  );
}

// Collect IDAT payloads.
const idat = [];
for (let o = 8; o < src.length; ) {
  const len = src.readUInt32BE(o);
  const type = src.slice(o + 4, o + 8).toString("ascii");
  if (type === "IDAT") idat.push(src.slice(o + 8, o + 8 + len));
  o += 12 + len;
}
const raw = zlib.inflateSync(Buffer.concat(idat));

// Un-filter into a flat RGBA buffer.
const BPP = 4;
const stride = width * BPP;
const px = Buffer.alloc(height * stride);
let p = 0;
for (let y = 0; y < height; y++) {
  const filter = raw[p++];
  const row = raw.slice(p, p + stride);
  p += stride;
  const out = px.slice(y * stride, (y + 1) * stride);
  const prev = y > 0 ? px.slice((y - 1) * stride, y * stride) : null;
  for (let x = 0; x < stride; x++) {
    const a = x >= BPP ? out[x - BPP] : 0;
    const b = prev ? prev[x] : 0;
    const c = prev && x >= BPP ? prev[x - BPP] : 0;
    let v = row[x];
    switch (filter) {
      case 0: break;
      case 1: v += a; break;
      case 2: v += b; break;
      case 3: v += (a + b) >> 1; break;
      case 4: {
        const pp = a + b - c;
        const pa = Math.abs(pp - a);
        const pb = Math.abs(pp - b);
        const pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        break;
      }
      default: throw new Error("bad filter type " + filter);
    }
    out[x] = v & 0xff;
  }
}

// White knock-out.
let cleared = 0;
for (let i = 0; i < px.length; i += 4) {
  const r = px[i], g = px[i + 1], b = px[i + 2];
  const a = 255 - Math.min(r, g, b);
  if (a === 0) {
    px[i] = px[i + 1] = px[i + 2] = px[i + 3] = 0;
    cleared++;
    continue;
  }
  const k = 255 - a;
  px[i] = Math.max(0, Math.min(255, Math.round(((r - k) * 255) / a)));
  px[i + 1] = Math.max(0, Math.min(255, Math.round(((g - k) * 255) / a)));
  px[i + 2] = Math.max(0, Math.min(255, Math.round(((b - k) * 255) / a)));
  px[i + 3] = a;
}

// Re-encode with filter type 0 on every row; zlib handles the rest.
const packed = Buffer.alloc(height * (stride + 1));
for (let y = 0; y < height; y++) {
  packed[y * (stride + 1)] = 0;
  px.copy(packed, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(width, 0);
ihdr.writeUInt32BE(height, 4);
ihdr[8] = 8;
ihdr[9] = 6;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const out = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(packed, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

fs.writeFileSync(DST, out);
console.log(
  `${width}x${height} -> ${DST}  ${Math.round(out.length / 1024)} KB, ` +
    `${cleared}/${width * height} px made transparent`,
);
