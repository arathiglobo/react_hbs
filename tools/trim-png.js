/*
 * Report (and optionally write) the alpha bounding box of an 8-bit RGBA,
 * non-interlaced PNG. Used to trim transparent margin off a logo so its CSS
 * width controls the visible mark rather than empty space.
 *
 *   node trim-png.js <src>            -> report only
 *   node trim-png.js <src> <dst>      -> write the cropped file
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
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
};

const src = fs.readFileSync(SRC);
const width = src.readUInt32BE(16);
const height = src.readUInt32BE(20);
if (src[24] !== 8 || src[25] !== 6 || src[28] !== 0) {
  throw new Error(`unsupported PNG: depth=${src[24]} type=${src[25]} interlace=${src[28]}`);
}

const idat = [];
for (let o = 8; o < src.length; ) {
  const len = src.readUInt32BE(o);
  if (src.slice(o + 4, o + 8).toString("ascii") === "IDAT") idat.push(src.slice(o + 8, o + 8 + len));
  o += 12 + len;
}
const raw = zlib.inflateSync(Buffer.concat(idat));

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
    if (filter === 1) v += a;
    else if (filter === 2) v += b;
    else if (filter === 3) v += (a + b) >> 1;
    else if (filter === 4) {
      const pp = a + b - c;
      const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
      v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
    } else if (filter !== 0) throw new Error("bad filter " + filter);
    out[x] = v & 0xff;
  }
}

let minX = width, minY = height, maxX = -1, maxY = -1;
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    if (px[y * stride + x * 4 + 3] <= 8) continue;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
}

console.log(`source      ${width}x${height}`);
console.log(`ink bbox    x ${minX}..${maxX}  y ${minY}..${maxY}  (${maxX - minX + 1}x${maxY - minY + 1})`);
console.log(`margins     left ${minX}  right ${width - 1 - maxX}  top ${minY}  bottom ${height - 1 - maxY}`);
const inkCentre = (minX + maxX) / 2;
console.log(`ink centre  x=${inkCentre.toFixed(1)}  (box centre x=${((width - 1) / 2).toFixed(1)}) -> off by ${(inkCentre - (width - 1) / 2).toFixed(1)}px`);

if (!DST) process.exit(0);

const cw = maxX - minX + 1, ch = maxY - minY + 1;
const cStride = cw * BPP;
const packed = Buffer.alloc(ch * (cStride + 1));
for (let y = 0; y < ch; y++) {
  packed[y * (cStride + 1)] = 0;
  px.copy(packed, y * (cStride + 1) + 1, (minY + y) * stride + minX * 4, (minY + y) * stride + (maxX + 1) * 4);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(cw, 0);
ihdr.writeUInt32BE(ch, 4);
ihdr[8] = 8; ihdr[9] = 6;
fs.writeFileSync(DST, Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(packed, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]));
console.log(`wrote       ${DST}  ${cw}x${ch}  ${Math.round(fs.statSync(DST).size / 1024)} KB`);
